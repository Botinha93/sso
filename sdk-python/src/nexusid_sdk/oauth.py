from __future__ import annotations

import base64
import hashlib
import os
from dataclasses import dataclass
from urllib.parse import urlencode


def _base64url_no_pad(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


@dataclass(frozen=True, slots=True)
class PKCEPair:
    code_verifier: str
    code_challenge: str
    code_challenge_method: str = "S256"


def create_code_verifier(length_bytes: int = 64) -> str:
    return _base64url_no_pad(os.urandom(length_bytes))


def create_code_challenge(code_verifier: str) -> str:
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return _base64url_no_pad(digest)


def generate_pkce_pair() -> PKCEPair:
    verifier = create_code_verifier()
    return PKCEPair(
        code_verifier=verifier,
        code_challenge=create_code_challenge(verifier),
    )


def build_authorize_url(base_url: str, *, params: dict[str, str | list[str] | None]) -> str:
    normalized = base_url.rstrip("/")
    query: list[tuple[str, str]] = []

    for key, value in params.items():
        if value is None:
            continue
        if isinstance(value, list):
            query.append((key, " ".join(value)))
        else:
            query.append((key, value))

    suffix = urlencode(query)
    if suffix:
        return f"{normalized}/oauth/authorize?{suffix}"
    return f"{normalized}/oauth/authorize"
