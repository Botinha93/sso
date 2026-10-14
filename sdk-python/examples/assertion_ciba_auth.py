from __future__ import annotations

import base64

from nexusid_sdk import create_auth_api, create_client

BASE_URL = "http://127.0.0.1:4000"
CLIENT_ID = "enterprise-client"
CLIENT_SECRET = "replace-with-client-secret"


def main() -> None:
    auth = create_auth_api(create_client(base_url=BASE_URL))

    jwt_token = auth.exchange_jwt_bearer(
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
        assertion="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
        scope=["openid", "profile", "email"],
    )
    print("JWT bearer access token:", jwt_token["access_token"])

    saml_assertion_xml = (
        "<saml:Assertion xmlns:saml=\"urn:oasis:names:tc:SAML:2.0:assertion\">"
        "<saml:Subject><saml:NameID>user@example.com</saml:NameID></saml:Subject>"
        "</saml:Assertion>"
    )
    saml_token = auth.exchange_saml2_bearer(
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
        assertion=base64.b64encode(saml_assertion_xml.encode("utf-8")).decode("ascii"),
        scope=["openid", "profile"],
    )
    print("SAML2 bearer access token:", saml_token["access_token"])

    ciba_start = auth.start_ciba_authentication(
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
        login_hint="user@example.com",
        scope=["openid", "profile"],
        binding_message="Approve sign-in from support console",
    )

    # In real deployments approval is decoupled and handled by a user-facing channel.
    auth.approve_ciba_authentication(
        auth_req_id=str(ciba_start["auth_req_id"]),
        username="user@example.com",
        password="replace-with-user-password",
        approve=True,
    )

    ciba_token = auth.exchange_ciba_token(
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
        auth_req_id=str(ciba_start["auth_req_id"]),
    )
    print("CIBA access token:", ciba_token["access_token"])


if __name__ == "__main__":
    main()
