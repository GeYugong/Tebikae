import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Connection } from '../domain/types';
import { GitHubClient, GITHUB_API_VERSION } from '../adapters/github/client';
import { CredentialProvider } from '../security/credentials';
import { db } from '../storage/db';
import { SyncEngine } from '../sync/engine';
import { acquireScopeLock } from '../sync/lock';

interface Session {
  connection: Connection | null;
  connected: boolean;
  writable: boolean;
  lockState: string;
  client: GitHubClient | null;
  engine: SyncEngine | null;
  connect(repository: string, token: string): Promise<void>;
  openOffline(connection: Connection): Promise<void>;
  disconnect(): void;
  leave(): Promise<void>;
  takeLock(): Promise<void>;
}
const Context = createContext<Session>(null!);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [client, setClient] = useState<GitHubClient | null>(null);
  const [engine, setEngine] = useState<SyncEngine | null>(null);
  const [lockState, setLockState] = useState('busy');
  const runtime = useRef({
    credentials: new CredentialProvider(),
    generation: 0,
    engine: null as SyncEngine | null,
    release: () => {},
  });
  function stop() {
    runtime.current.generation++;
    runtime.current.engine?.stop();
    runtime.current.engine = null;
    runtime.current.credentials.clear();
    setClient(null);
    setEngine(null);
  }
  async function lock(next: Connection) {
    runtime.current.release();
    const generation = runtime.current.generation;
    const held = await acquireScopeLock(next.scopeId);
    if (generation !== runtime.current.generation) {
      held.release();
      return false;
    }
    runtime.current.release = held.release;
    setLockState(held.state);
    return held.state === 'acquired';
  }
  async function connect(repository: string, token: string) {
    await flushAllDrafts();
    stop();
    const generation = runtime.current.generation;
    runtime.current.credentials.set(token);
    const adapter = new GitHubClient(runtime.current.credentials, {
      cache: {
        get: (scopeId, url) =>
          db.httpCache.get([scopeId, url, 'application/vnd.github+json', GITHUB_API_VERSION]),
        put: (entry) => db.httpCache.put(entry),
      },
    });
    try {
      const next = await adapter.connect(repository);
      if (generation !== runtime.current.generation) return;
      await db.connections.put(next);
      const acquired =
        connection?.scopeId === next.scopeId && lockState === 'acquired' ? true : await lock(next);
      if (generation !== runtime.current.generation) return;
      setConnection(next);
      setClient(adapter);
      if (acquired) {
        const sync = new SyncEngine(db, adapter, next);
        runtime.current.engine = sync;
        setEngine(sync);
        void sync.start().catch(() => {});
      }
      void navigator.storage?.persist?.().catch(() => false);
    } catch (error) {
      if (generation === runtime.current.generation) runtime.current.credentials.clear();
      throw error;
    }
  }
  async function openOffline(next: Connection) {
    await flushAllDrafts();
    stop();
    const generation = runtime.current.generation;
    await lock(next);
    if (generation === runtime.current.generation) setConnection(next);
  }
  function disconnect() {
    stop();
  }
  async function leave() {
    await flushAllDrafts();
    stop();
    runtime.current.release();
    setLockState('busy');
    setConnection(null);
  }
  const takingLock = useRef(false);
  async function takeLock() {
    if (!connection || lockState === 'acquired' || takingLock.current) return;
    takingLock.current = true;
    try {
      if (!(await lock(connection))) return;
      if (client) {
        const sync = new SyncEngine(db, client, connection);
        runtime.current.engine = sync;
        setEngine(sync);
        void sync.start().catch(() => {});
      }
    } finally {
      takingLock.current = false;
    }
  }
  useEffect(() => {
    const current = runtime.current;
    return () => {
      current.engine?.stop();
      current.credentials.clear();
      current.release();
    };
  }, []);
  return (
    <Context.Provider
      value={{
        connection,
        client,
        engine,
        connected: !!client,
        writable: lockState === 'acquired' && !connection?.readOnly,
        lockState,
        connect,
        openOffline,
        disconnect,
        leave,
        takeLock,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);

const pendingEditors = new Set<() => Promise<void>>();
export function registerDraftFlusher(flush: () => Promise<void>) {
  pendingEditors.add(flush);
  return () => {
    pendingEditors.delete(flush);
  };
}
export async function flushAllDrafts() {
  for (const flush of pendingEditors) await flush();
}
