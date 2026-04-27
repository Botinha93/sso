from __future__ import annotations

from typing import cast

from .client import NexusIDClient
from .generated import models as gm


def _serialize_scope(scope: str | list[str] | None) -> str | None:
    if scope is None:
        return None
    if isinstance(scope, list):
        return " ".join(scope)
    return scope


def _serialize_audience(audience: str | list[str] | None) -> str | None:
    if audience is None:
        return None
    if isinstance(audience, list):
        return " ".join(audience)
    return audience


class AuthAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def exchange_authorization_code(
        self,
        *,
        client_id: str,
        client_secret: str,
        code: str,
        redirect_uri: str,
        code_verifier: str | None = None,
    ) -> gm.PostOauthTokenResponse:
        payload: gm.PostOauthTokenRequestBodyOption1 = {
            "grant_type": "authorization_code",
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
        }
        if code_verifier is not None:
            payload["code_verifier"] = code_verifier

        return cast(gm.PostOauthTokenResponse, self._client.post(
            "/oauth/token",
            body=payload,
        ))

    def exchange_refresh_token(
        self,
        *,
        client_id: str,
        client_secret: str,
        refresh_token: str,
    ) -> gm.PostOauthTokenResponse:
        payload: gm.PostOauthTokenRequestBodyOption2 = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": client_id,
            "client_secret": client_secret,
        }

        return cast(gm.PostOauthTokenResponse, self._client.post(
            "/oauth/token",
            body=payload,
        ))

    def exchange_client_credentials(
        self,
        *,
        client_id: str,
        client_secret: str,
        scope: str | list[str] | None = None,
    ) -> gm.PostOauthTokenResponse:
        payload: gm.PostOauthTokenRequestBodyOption3 = {
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        }
        serialized_scope = _serialize_scope(scope)
        if serialized_scope is not None:
            payload["scope"] = serialized_scope

        return cast(gm.PostOauthTokenResponse, self._client.post(
            "/oauth/token",
            body=payload,
        ))

    def exchange_token(
        self,
        *,
        subject_token: str,
        subject_token_type: str,
        requested_token_type: str | None = None,
        audience: str | list[str] | None = None,
        scope: str | list[str] | None = None,
        client_id: str | None = None,
        client_secret: str | None = None,
    ) -> gm.PostOauthTokenExchangeResponse:
        payload: gm.PostOauthTokenExchangeRequestBody = {
            "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
            "subject_token": subject_token,
            "subject_token_type": subject_token_type,
        }

        if requested_token_type is not None:
            payload["requested_token_type"] = requested_token_type

        serialized_audience = _serialize_audience(audience)
        if serialized_audience is not None:
            payload["audience"] = serialized_audience

        serialized_scope = _serialize_scope(scope)
        if serialized_scope is not None:
            payload["scope"] = serialized_scope

        if client_id is not None:
            payload["client_id"] = client_id

        if client_secret is not None:
            payload["client_secret"] = client_secret

        return cast(gm.PostOauthTokenExchangeResponse, self._client.post(
            "/oauth/token/exchange",
            body=payload,
        ))

    def revoke_token(
        self,
        *,
        token: str,
        token_type_hint: str | None = None,
        client_id: str | None = None,
        client_secret: str | None = None,
    ) -> gm.PostOauthTokenRevokeResponse:
        payload: gm.PostOauthTokenRevokeRequestBody = {
            "token": token,
        }

        if token_type_hint is not None:
            payload["token_type_hint"] = token_type_hint

        if client_id is not None:
            payload["client_id"] = client_id

        if client_secret is not None:
            payload["client_secret"] = client_secret

        return cast(gm.PostOauthTokenRevokeResponse, self._client.post(
            "/oauth/token/revoke",
            body=payload,
            body_format="form",
        ))


def create_auth_api(client: NexusIDClient) -> AuthAPI:
    return AuthAPI(client)
