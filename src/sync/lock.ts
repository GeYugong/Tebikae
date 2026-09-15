export interface ScopeLock {
  state: 'acquired' | 'busy' | 'unsupported';
  release(): void;
}

/** Hold a browser-wide lock until explicit release or tab termination. */
export async function acquireScopeLock(scopeId: string): Promise<ScopeLock> {
  if (typeof navigator === 'undefined' || !navigator.locks) return { state: 'unsupported', release() {} };
  return new Promise((resolve) => {
    void navigator.locks
      .request(`tebikae:${scopeId}`, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
        if (!lock) {
          resolve({ state: 'busy', release() {} });
          return;
        }
        await new Promise<void>((release) => resolve({ state: 'acquired', release }));
      })
      .catch(() => resolve({ state: 'unsupported', release() {} }));
  });
}
