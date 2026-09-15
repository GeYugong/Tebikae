export interface Credential {
  token: string;
  generation: number;
}
/** Runtime-only credentials. Never serialize this provider. */
export class CredentialProvider {
  #token: string | null = null;
  #generation = 0;
  get = (): Credential | null => (this.#token ? { token: this.#token, generation: this.#generation } : null);
  set(token: string): void {
    this.#generation += 1;
    this.#token = token.trim() || null;
  }
  clear(): void {
    this.#generation += 1;
    this.#token = null;
  }
  get generation(): number {
    return this.#generation;
  }
}
