from __future__ import annotations

from typing import Any


class APIClientError(Exception):
    """Base SDK client error."""


class APIRequestTimeoutError(APIClientError):
    """Raised when a request times out."""


class APIResponseError(APIClientError):
    """Raised for non-2xx API responses."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int,
        code: str | None = None,
        details: Any = None,
        request_id: str | None = None,
        retry_after: float | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.details = details
        self.request_id = request_id
        # Seconds to wait before retrying, parsed from the ``Retry-After``
        # response header (or a ``retryAfterSeconds`` body hint). ``None`` when
        # the server gave no guidance.
        self.retry_after = retry_after
