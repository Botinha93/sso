from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Literal, Mapping
from urllib.parse import urlencode

import httpx

from .errors import APIClientError, APIRequestTimeoutError, APIResponseError

JSONScalar = str | int | float | bool | None
JSONValue = JSONScalar | list["JSONValue"] | dict[str, "JSONValue"]
QueryValue = JSONScalar | list[JSONScalar]
AuthType = Literal["none", "bearer", "session", "headers"]
BodyFormat = Literal["json", "form", "raw"]
ParseAs = Literal["json", "text", "response"]


@dataclass(slots=True)
class RetryPolicy:
    max_attempts: int = 1
    retryable_status_codes: tuple[int, ...] = (408, 425, 429, 500, 502, 503, 504)
    backoff_seconds: float = 0.15


class NexusIDClient:
    def __init__(
        self,
        *,
        base_url: str,
        auth: Mapping[str, Any] | None = None,
        timeout_seconds: float = 30.0,
        retry: RetryPolicy | None = None,
        default_headers: Mapping[str, str] | None = None,
        http_client: httpx.Client | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._auth = dict(auth or {})
        self._timeout_seconds = timeout_seconds
        self._retry = retry or RetryPolicy()
        self._default_headers = dict(default_headers or {})
        self._http = http_client or httpx.Client(timeout=timeout_seconds)

    @property
    def base_url(self) -> str:
        return self._base_url

    def with_auth(self, auth: Mapping[str, Any]) -> "NexusIDClient":
        return NexusIDClient(
            base_url=self._base_url,
            auth=auth,
            timeout_seconds=self._timeout_seconds,
            retry=self._retry,
            default_headers=self._default_headers,
            http_client=self._http,
        )

    def close(self) -> None:
        self._http.close()

    def request(
        self,
        method: str,
        path: str,
        *,
        query: Mapping[str, QueryValue] | None = None,
        headers: Mapping[str, str] | None = None,
        body: Any = None,
        body_format: BodyFormat = "json",
        files: Mapping[str, Any] | None = None,
        parse_as: ParseAs = "json",
        timeout_seconds: float | None = None,
    ) -> Any:
        url = self._build_url(path, query)
        req_headers = self._resolve_headers(headers)
        timeout = timeout_seconds if timeout_seconds is not None else self._timeout_seconds

        max_attempts = max(1, self._retry.max_attempts)

        for attempt in range(1, max_attempts + 1):
            try:
                response = self._send(
                    method=method,
                    url=url,
                    headers=req_headers,
                    body=body,
                    body_format=body_format,
                    files=files,
                    timeout=timeout,
                )

                if response.status_code >= 400:
                    error = self._response_error(response)
                    if self._should_retry(attempt, response.status_code):
                        self._sleep_before_retry(attempt)
                        continue
                    raise error

                return self._parse_response(response, parse_as)
            except httpx.TimeoutException as exc:
                timeout_error = APIRequestTimeoutError(f"Request timed out after {timeout}s")
                if self._should_retry(attempt, None):
                    self._sleep_before_retry(attempt)
                    continue
                raise timeout_error from exc
            except httpx.HTTPError as exc:
                if self._should_retry(attempt, None):
                    self._sleep_before_retry(attempt)
                    continue
                raise APIClientError("Request failed") from exc

        raise APIClientError("Request failed after exhausting retry attempts")

    def get(self, path: str, **kwargs: Any) -> Any:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs: Any) -> Any:
        return self.request("POST", path, **kwargs)

    def put(self, path: str, **kwargs: Any) -> Any:
        return self.request("PUT", path, **kwargs)

    def patch(self, path: str, **kwargs: Any) -> Any:
        return self.request("PATCH", path, **kwargs)

    def delete(self, path: str, **kwargs: Any) -> Any:
        return self.request("DELETE", path, **kwargs)

    def _build_url(self, path: str, query: Mapping[str, QueryValue] | None = None) -> str:
        normalized_path = path if path.startswith("/") else f"/{path}"
        url = f"{self._base_url}{normalized_path}"
        if not query:
            return url

        parts: list[tuple[str, str]] = []
        for key, value in query.items():
            if value is None:
                continue
            if isinstance(value, list):
                for item in value:
                    if item is not None:
                        parts.append((key, str(item)))
            else:
                parts.append((key, str(value)))

        if not parts:
            return url
        return f"{url}?{urlencode(parts)}"

    def _resolve_headers(self, request_headers: Mapping[str, str] | None) -> dict[str, str]:
        headers = dict(self._default_headers)
        headers.update(self._resolve_auth_headers())
        if request_headers:
            headers.update(request_headers)
        return headers

    def _resolve_auth_headers(self) -> dict[str, str]:
        auth_type: AuthType = self._auth.get("type", "none")
        if auth_type in ("none", None):
            return {}

        if auth_type == "bearer":
            token = self._resolve_auth_value(self._auth.get("token"))
            return {"authorization": f"Bearer {token}"}

        if auth_type == "session":
            cookie = self._resolve_auth_value(self._auth.get("cookie"))
            return {"cookie": str(cookie)}

        if auth_type == "headers":
            raw = self._resolve_auth_value(self._auth.get("headers"))
            if isinstance(raw, Mapping):
                return {str(k): str(v) for k, v in raw.items()}
            return {}

        return {}

    @staticmethod
    def _resolve_auth_value(value: Any) -> Any:
        if callable(value):
            return value()
        return value

    def _send(
        self,
        *,
        method: str,
        url: str,
        headers: Mapping[str, str],
        body: Any,
        body_format: BodyFormat,
        files: Mapping[str, Any] | None,
        timeout: float,
    ) -> httpx.Response:
        kwargs: dict[str, Any] = {
            "method": method,
            "url": url,
            "headers": headers,
            "timeout": timeout,
        }

        if files is not None:
            kwargs["files"] = files
            if body is not None:
                kwargs["data"] = body
        elif body is not None:
            if body_format == "json":
                kwargs["json"] = body
            elif body_format == "form":
                kwargs["data"] = body
            else:
                kwargs["content"] = body

        return self._http.request(**kwargs)

    def _response_error(self, response: httpx.Response) -> APIResponseError:
        payload: Any = None
        message = f"Request failed with status {response.status_code}"

        try:
            payload = response.json()
            if isinstance(payload, dict):
                message = str(payload.get("message") or payload.get("error") or message)
        except ValueError:
            payload = response.text
            if payload:
                message = payload

        code = payload.get("code") if isinstance(payload, dict) else None
        request_id = response.headers.get("x-request-id")

        return APIResponseError(
            message,
            status_code=response.status_code,
            code=code,
            details=payload,
            request_id=request_id,
        )

    def _should_retry(self, attempt: int, status_code: int | None) -> bool:
        if attempt >= max(1, self._retry.max_attempts):
            return False
        if status_code is None:
            return True
        return status_code in self._retry.retryable_status_codes

    def _sleep_before_retry(self, attempt: int) -> None:
        sleep_seconds = self._retry.backoff_seconds * attempt
        if sleep_seconds > 0:
            time.sleep(sleep_seconds)

    @staticmethod
    def _parse_response(response: httpx.Response, parse_as: ParseAs) -> Any:
        if parse_as == "response":
            return response

        if response.status_code == 204:
            return None

        if parse_as == "text":
            return response.text

        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            return response.json()

        text = response.text
        return text if text else None


def create_client(
    *,
    base_url: str,
    auth: Mapping[str, Any] | None = None,
    timeout_seconds: float = 30.0,
    retry: RetryPolicy | None = None,
    default_headers: Mapping[str, str] | None = None,
) -> NexusIDClient:
    return NexusIDClient(
        base_url=base_url,
        auth=auth,
        timeout_seconds=timeout_seconds,
        retry=retry,
        default_headers=default_headers,
    )
