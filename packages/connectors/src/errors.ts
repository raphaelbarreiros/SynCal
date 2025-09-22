export class ConnectorError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'ConnectorError';
  }
}

export class OAuthStateMismatchError extends ConnectorError {
  constructor(message = 'OAuth state mismatch') {
    super(message);
    this.name = 'OAuthStateMismatchError';
  }
}

export class ProviderRequestError extends ConnectorError {
  constructor(
    message: string,
    readonly status?: number,
    readonly responseBody?: unknown
  ) {
    super(message);
    this.name = 'ProviderRequestError';
  }
}
