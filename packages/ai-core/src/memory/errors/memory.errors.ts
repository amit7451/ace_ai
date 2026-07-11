export class MemoryProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'MemoryProviderError';
  }
}

export class SessionNotFoundError extends MemoryProviderError {
  constructor(provider: string, sessionId: string) {
    super(`Session "${sessionId}" not found in memory store.`, provider);
    this.name = 'SessionNotFoundError';
  }
}
