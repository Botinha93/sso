import type { APIClientError } from "./errors.js";
export type { ListPageQuery } from "./list-helpers.js";

export type MaybePromise<T> = T | Promise<T>;

export interface RetryPolicy {
  maxAttempts?: number;
  retryableStatusCodes?: number[];
  /**
   * Minimum delay in milliseconds enforced between consecutive requests issued
   * by this client. Useful for throttling bulk operations against rate limits.
   */
  interRequestDelayMs?: number;
}

export type AuthConfig =
  | { type?: "none" }
  | { type: "bearer"; token: string | (() => MaybePromise<string>) }
  | { type: "session"; cookie: string | (() => MaybePromise<string>) }
  | { type: "headers"; headers: HeadersInit | (() => MaybePromise<HeadersInit>) };

export interface ClientOptions {
  /**
   * Authentication strategy applied to all requests from this client.
   */
  auth?: AuthConfig;
  /**
   * Platform base URL, for example `https://iam.example.com`.
   */
  baseUrl: string;
  /**
   * Default headers merged into every request.
   */
  defaultHeaders?: HeadersInit;
  /**
   * Optional custom fetch implementation.
   */
  fetch?: typeof fetch;
  /**
   * Retry behavior for transient failures.
   */
  retry?: RetryPolicy;
  /**
   * Request timeout in milliseconds.
   */
  timeoutMs?: number;
}

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  body?: BodyInit | object | unknown[] | null;
  headers?: HeadersInit;
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  /**
   * Additional HTTP status codes treated as successful responses.
   * Useful for endpoints such as `POST /auth/login` that return `202` for MFA challenges.
   */
  acceptStatuses?: number[];
  parseAs?: "json" | "response" | "text";
  path: string;
  query?: Record<string, QueryValue | QueryValue[]> | object;
  signal?: AbortSignal;
}

export interface APIErrorPayload {
  code?: string;
  details?: unknown;
  error?: string;
  message?: string;
}

export interface RequestContext {
  attempt: number;
  options: RequestOptions;
}

export interface ClientInstance {
  /**
   * Executes a fully customized request.
   *
   * @typeParam T Expected response payload type.
   * @param options Request options including path, method, and payload/query settings.
   * @returns Parsed response payload.
   */
  request<T = unknown>(options: RequestOptions): Promise<T>;
  /**
   * Sends a GET request.
   *
   * @typeParam T Expected response payload type.
   * @param path Endpoint path relative to the configured base URL.
   * @param options Optional request options excluding method/path.
   * @returns Parsed response payload.
   */
  get<T = unknown>(path: string, options?: Omit<RequestOptions, "method" | "path">): Promise<T>;
  /**
   * Sends a POST request.
   *
   * @typeParam T Expected response payload type.
   * @param path Endpoint path relative to the configured base URL.
   * @param options Optional request options excluding method/path.
   * @returns Parsed response payload.
   */
  post<T = unknown>(path: string, options?: Omit<RequestOptions, "method" | "path">): Promise<T>;
  /**
   * Sends a PUT request.
   *
   * @typeParam T Expected response payload type.
   * @param path Endpoint path relative to the configured base URL.
   * @param options Optional request options excluding method/path.
   * @returns Parsed response payload.
   */
  put<T = unknown>(path: string, options?: Omit<RequestOptions, "method" | "path">): Promise<T>;
  /**
   * Sends a PATCH request.
   *
   * @typeParam T Expected response payload type.
   * @param path Endpoint path relative to the configured base URL.
   * @param options Optional request options excluding method/path.
   * @returns Parsed response payload.
   */
  patch<T = unknown>(path: string, options?: Omit<RequestOptions, "method" | "path">): Promise<T>;
  /**
   * Sends a DELETE request.
   *
   * @typeParam T Expected response payload type.
   * @param path Endpoint path relative to the configured base URL.
   * @param options Optional request options excluding method/path.
   * @returns Parsed response payload.
   */
  delete<T = unknown>(path: string, options?: Omit<RequestOptions, "method" | "path">): Promise<T>;
  /**
   * Clones the client with a different auth strategy.
   *
   * @param auth Auth configuration to apply on the returned client.
   * @returns A new client instance with the provided auth configuration.
   */
  withAuth(auth: AuthConfig): ClientInstance;
}

export type ErrorFactory = (message: string, error: APIClientError) => APIClientError;