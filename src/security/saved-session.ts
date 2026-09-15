import Dexie, { type Table } from 'dexie';
import { z } from 'zod';
import type { Connection } from '../domain/types';

const payloadSchema = z.object({
  token: z.string().trim().min(1),
  connection: z.object({
    scopeId: z.string(),
    viewerId: z.number().int().positive(),
    login: z.string(),
    repoId: z.number().int().positive(),
    owner: z.string().min(1),
    repo: z.string().min(1),
    lastConnectedAt: z.string(),
    readOnly: z.boolean().optional(),
  }),
});

interface EncryptedSession {
  id: 'active';
  version: 1;
  revision: string;
  scopeId: string;
  key: CryptoKey;
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
}
export interface SavedSession {
  revision: string;
  connection: Connection;
  token: string;
}

/** Separate from notebook data so keys and ciphertext never enter note exports. */
export class SavedSessionStore extends Dexie {
  private sessions!: Table<EncryptedSession, string>;

  constructor(name = 'tebikae-session') {
    super(name);
    this.version(1).stores({ sessions: 'id' });
  }

  async save(connection: Connection, token: string, active: () => boolean = () => true): Promise<void> {
    const payload = payloadSchema.parse({ connection, token });
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: this.context(connection.scopeId) },
      key,
      new TextEncoder().encode(JSON.stringify(payload)),
    );
    // Crypto runs outside the transaction; disconnect can invalidate it while it is pending.
    await this.transaction('rw', this.sessions, async () => {
      if (!active()) return;
      await this.sessions.put({
        id: 'active',
        version: 1,
        revision: crypto.randomUUID(),
        scopeId: connection.scopeId,
        key,
        iv,
        ciphertext,
      });
    });
  }

  async restore(): Promise<SavedSession | null> {
    const stored = await this.sessions.get('active');
    if (!stored) return null;
    try {
      if (stored.version !== 1 || stored.key.extractable || stored.iv.byteLength !== 12)
        throw new Error('Invalid saved session');
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: stored.iv, additionalData: this.context(stored.scopeId) },
        stored.key,
        stored.ciphertext,
      );
      const payload = payloadSchema.parse(JSON.parse(new TextDecoder().decode(plaintext)));
      const { connection } = payload;
      if (
        connection.scopeId !== stored.scopeId ||
        connection.scopeId !== `github.com:${connection.viewerId}:${connection.repoId}`
      )
        throw new Error('Invalid saved session');
      return { ...payload, revision: stored.revision };
    } catch {
      await this.forget(stored.revision);
      // Never propagate parser errors that could include decrypted credentials.
      throw new Error('Saved session could not be restored');
    }
  }

  async isCurrent(revision: string): Promise<boolean> {
    return (await this.sessions.get('active'))?.revision === revision;
  }

  async forget(revision?: string): Promise<void> {
    await this.transaction('rw', this.sessions, async () => {
      const stored = await this.sessions.get('active');
      if (!revision || stored?.revision === revision) await this.sessions.delete('active');
    });
  }

  private context(scopeId: string): Uint8Array<ArrayBuffer> {
    return new TextEncoder().encode(`tebikae-session:1:${scopeId}`);
  }
}

export const savedSessionStore = new SavedSessionStore();
