export interface APIClientErrorOptions {
  cause?: unknown;
  code?: string;
  details?: unknown;
  requestId?: string;
  status?: number;
}

export class APIClientError extends Error {
  readonly cause?: unknown;
  readonly code?: string;
  readonly details?: unknown;
  readonly requestId?: string;
  readonly status?: number;

  constructor(message: string, options: APIClientErrorOptions = {}) {
    super(message);
    this.name = "APIClientError";
    this.cause = options.cause;
    this.code = options.code;
    this.details = options.details;
    this.requestId = options.requestId;
    this.status = options.status;
  }
}

export class APIResponseError extends APIClientError {
  constructor(message: string, options: APIClientErrorOptions = {}) {
    super(message, options);
    this.name = "APIResponseError";
  }
}

export class APIRequestTimeoutError extends APIClientError {
  constructor(message = "Request timed out", options: APIClientErrorOptions = {}) {
    super(message, options);
    this.name = "APIRequestTimeoutError";
  }
}