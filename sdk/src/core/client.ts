import { APIClientError, APIRequestTimeoutError, APIResponseError } from "./errors.js";
import type { APIErrorPayload, AuthConfig, ClientInstance, ClientOptions, QueryValue, RequestOptions } from "./types.js";

const DEFAULT_RETRYABLE_STATUS_CODES = [408, 425, 429, 500, 502, 503, 504];

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, "");

const resolvePath = (baseUrl: string, path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`;
};

const appendQueryValue = (params: URLSearchParams, key: string, value: QueryValue): void => {
  if (value === undefined || value === null) {
    return;
  }

  params.append(key, String(value));
};

const buildUrl = (baseUrl: string, path: string, query?: RequestOptions["query"]): string => {
  const url = new URL(resolvePath(baseUrl, path));

  if (!query) {
    return url.toString();
  }

  for (const [key, rawValue] of Object.entries(query)) {
    if (Array.isArray(rawValue)) {
      for (const value of rawValue) {
        appendQueryValue(url.searchParams, key, value);
      }
      continue;
    }

    appendQueryValue(url.searchParams, key, rawValue);
  }

  return url.toString();
};

const resolveAuthHeaders = async (auth?: AuthConfig): Promise<HeadersInit | undefined> => {
  if (!auth || auth.type === "none" || auth.type === undefined) {
    return undefined;
  }

  if (auth.type === "bearer") {
    const token = typeof auth.token === "function" ? await auth.token() : auth.token;
    return { authorization: `Bearer ${token}` };
  }

  if (auth.type === "session") {
    const cookie = typeof auth.cookie === "function" ? await auth.cookie() : auth.cookie;
    return { cookie };
  }

  if (auth.type === "headers") {
    return typeof auth.headers === "function" ? await auth.headers() : auth.headers;
  }

  return undefined;
};

const mergeSignals = (timeoutSignal: AbortSignal, requestSignal?: AbortSignal): AbortSignal => {
  if (!requestSignal) {
    return timeoutSignal;
  }

  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([timeoutSignal, requestSignal]);
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  timeoutSignal.addEventListener("abort", abort, { once: true });
  requestSignal.addEventListener("abort", abort, { once: true });
  return controller.signal;
};

const serializeBody = (body: RequestOptions["body"]): { body: BodyInit | null | undefined; contentType?: string } => {
  if (body === undefined || body === null) {
    return { body };
  }

  if (
    typeof body === "string"
    || body instanceof Blob
    || body instanceof FormData
    || body instanceof URLSearchParams
    || body instanceof ArrayBuffer
    || ArrayBuffer.isView(body)
    || body instanceof ReadableStream
  ) {
    return { body: body as BodyInit };
  }

  if (Array.isArray(body) || isPlainObject(body)) {
    return { body: JSON.stringify(body), contentType: "application/json" };
  }

  return { body: body as BodyInit };
};

const shouldRetry = (attempt: number, maxAttempts: number, status: number | undefined, error: unknown, retryableStatusCodes: number[]): boolean => {
  if (attempt >= maxAttempts) {
    return false;
  }

  if (status !== undefined) {
    return retryableStatusCodes.includes(status);
  }

  return error instanceof APIClientError || error instanceof TypeError;
};

const parseResponseBody = async (response: Response, parseAs: RequestOptions["parseAs"]): Promise<unknown> => {
  if (parseAs === "response") {
    return response;
  }

  if (response.status === 204) {
    return undefined;
  }

  if (parseAs === "text") {
    return response.text();
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.length > 0 ? text : undefined;
};

const createRequestMethod = (options: ClientOptions): ClientInstance["request"] => {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetchImpl = options.fetch ?? fetch;
  const maxAttempts = Math.max(1, options.retry?.maxAttempts ?? 1);
  const retryableStatusCodes = options.retry?.retryableStatusCodes ?? DEFAULT_RETRYABLE_STATUS_CODES;

  return async <T>(requestOptions: RequestOptions): Promise<T> => {
    const method = requestOptions.method ?? "GET";
    const url = buildUrl(baseUrl, requestOptions.path, requestOptions.query);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutMs = options.timeoutMs ?? 30_000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const authHeaders = await resolveAuthHeaders(options.auth);
        const serialized = serializeBody(requestOptions.body);
        const headers = new Headers(options.defaultHeaders);

        if (authHeaders) {
          new Headers(authHeaders).forEach((value, key) => headers.set(key, value));
        }

        if (requestOptions.headers) {
          new Headers(requestOptions.headers).forEach((value, key) => headers.set(key, value));
        }

        if (serialized.contentType && !headers.has("content-type")) {
          headers.set("content-type", serialized.contentType);
        }

        const response = await fetchImpl(url, {
          method,
          headers,
          body: serialized.body,
          signal: mergeSignals(controller.signal, requestOptions.signal)
        });

        const acceptedStatuses = requestOptions.acceptStatuses ?? [];
        const isSuccess = response.ok || acceptedStatuses.includes(response.status);

        if (!isSuccess) {
          const errorBody = await parseResponseBody(response, "json").catch(() => undefined) as APIErrorPayload | undefined;
          const error = new APIResponseError(
            errorBody?.message || errorBody?.error || `Request failed with status ${response.status}`,
            {
              code: errorBody?.code,
              details: errorBody?.details ?? errorBody,
              requestId: response.headers.get("x-request-id") ?? undefined,
              status: response.status
            }
          );

          if (shouldRetry(attempt, maxAttempts, response.status, error, retryableStatusCodes)) {
            continue;
          }

          throw error;
        }

        return await parseResponseBody(response, requestOptions.parseAs ?? "json") as T;
      } catch (error) {
        if (controller.signal.aborted && !(requestOptions.signal?.aborted)) {
          const timeoutError = new APIRequestTimeoutError(undefined, { cause: error });
          if (shouldRetry(attempt, maxAttempts, undefined, timeoutError, retryableStatusCodes)) {
            continue;
          }
          throw timeoutError;
        }

        if (shouldRetry(attempt, maxAttempts, undefined, error, retryableStatusCodes)) {
          continue;
        }

        if (error instanceof APIClientError) {
          throw error;
        }

        throw new APIClientError("Request failed", { cause: error });
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new APIClientError("Request failed after exhausting retry attempts");
  };
};

/**
 * Creates the base SDK HTTP client.
 *
 * Use this for direct platform endpoint calls and as the foundation for higher-level
 * modules such as auth and admin clients.
 *
 * @param options Client configuration including base URL, auth, timeout, retry policy, headers, and optional fetch implementation.
 * @returns A typed client instance with request helpers for all HTTP verbs and auth rebinding via `withAuth`.
 */
export const createClient = (options: ClientOptions): ClientInstance => {
  const request = createRequestMethod(options);

  return {
    request,
    get: (path, requestOptions) => request({ ...requestOptions, method: "GET", path }),
    post: (path, requestOptions) => request({ ...requestOptions, method: "POST", path }),
    put: (path, requestOptions) => request({ ...requestOptions, method: "PUT", path }),
    patch: (path, requestOptions) => request({ ...requestOptions, method: "PATCH", path }),
    delete: (path, requestOptions) => request({ ...requestOptions, method: "DELETE", path }),
    withAuth: (auth) => createClient({ ...options, auth })
  };
};