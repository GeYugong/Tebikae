// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from '../src/domain/types';
import { SavedSessionStore } from '../src/security/saved-session';

const connection: Connection = {
  scopeId: 'github.com:1:2',
  viewerId: 1,
  login: 'owner',
  repoId: 2,
  owner: 'owner',
  repo: 'notes',
  lastConnectedAt: '2026-09-16T00:00:00Z',
};
const token = 'test-only-sensitive-token';
let store: SavedSessionStore;
beforeEach(() => {
  store = new SavedSessionStore(`session-test-${crypto.randomUUID()}`);
});
afterEach(async () => {
  await store.delete();
});

describe('encrypted browser session', () => {
  it('survives reopening IndexedDB with an unexportable key and no plaintext token', async () => {
    await store.save(connection, token);
    const record = await store.table('sessions').get('active');
    expect(record.key.extractable).toBe(false);
    expect(record.key.algorithm).toEqual({ name: 'AES-GCM', length: 256 });
    await expect(crypto.subtle.exportKey('raw', record.key)).rejects.toThrow();
    expect(record.iv.byteLength).toBe(12);
    expect(JSON.stringify(record)).not.toContain(token);
    expect(new TextDecoder().decode(record.ciphertext)).not.toContain(token);
    store.close();
    store = new SavedSessionStore(store.name);
    expect(await store.restore()).toEqual({ connection, token, revision: record.revision });
  });

  it('atomically replaces the previous session and forgets both ciphertext and key', async () => {
    await store.save(connection, token);
    const previous = (await store.restore())!;
    await store.save({ ...connection, repo: 'renamed' }, 'replacement-token');
    expect(await store.isCurrent(previous.revision)).toBe(false);
    await store.forget(previous.revision);
    expect((await store.restore())?.token).toBe('replacement-token');
    expect(await store.table('sessions').count()).toBe(1);
    await store.forget();
    expect(await store.restore()).toBeNull();
    expect(await store.table('sessions').count()).toBe(0);
  });

  it.each(['ciphertext', 'key', 'version', 'scopeId'])(
    'discards a damaged %s without exposing decrypted data',
    async (field) => {
      await store.save(connection, token);
      const record = await store.table('sessions').get('active');
      if (field === 'ciphertext') new Uint8Array(record.ciphertext)[0] ^= 1;
      else if (field === 'key') record.key = null;
      else if (field === 'version') record.version = 999;
      else record.scopeId = 'github.com:3:4';
      await store.table('sessions').put(record);
      await expect(store.restore()).rejects.toThrow('Saved session could not be restored');
      expect(await store.restore()).toBeNull();
    },
  );

  it('never falls back to plaintext if crypto or persistence fails', async () => {
    vi.spyOn(crypto.subtle, 'encrypt').mockRejectedValueOnce(new Error('Unavailable'));
    await expect(store.save(connection, token)).rejects.toThrow();
    expect(await store.restore()).toBeNull();
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    });
    await expect(store.save(connection, token)).rejects.toThrow();
    expect(await store.restore()).toBeNull();
  });

  it('does not restore a session after disconnect invalidates a pending encryption', async () => {
    let active = true;
    const pending = store.save(connection, token, () => active);
    active = false;
    await store.forget();
    await pending;
    expect(await store.restore()).toBeNull();
  });
});
