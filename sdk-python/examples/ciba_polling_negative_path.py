from __future__ import annotations

import time

from nexusid_sdk import create_auth_api, create_client
from nexusid_sdk.errors import APIResponseError

BASE_URL = "http://127.0.0.1:4000"
CLIENT_ID = "enterprise-client"
CLIENT_SECRET = "replace-with-client-secret"


def oauth_error_code(error: APIResponseError) -> str | None:
    if isinstance(error.details, dict):
        code = error.details.get("error")
        if isinstance(code, str):
            return code
    return None


def main() -> None:
    auth = create_auth_api(create_client(base_url=BASE_URL))

    ciba_start = auth.start_ciba_authentication(
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
        login_hint="user@example.com",
        scope=["openid", "profile"],
        binding_message="Approve sign-in from support console",
    )

    auth_req_id = str(ciba_start["auth_req_id"])
    delay_seconds = int(ciba_start.get("interval", 5))

    for attempt in range(1, 9):
        time.sleep(delay_seconds)

        try:
            token = auth.exchange_ciba_token(
                client_id=CLIENT_ID,
                client_secret=CLIENT_SECRET,
                auth_req_id=auth_req_id,
            )
            print("CIBA approved; access token:", token["access_token"])
            return
        except APIResponseError as error:
            oauth_error = oauth_error_code(error)

            if oauth_error == "authorization_pending":
                print(f"Attempt {attempt}: authorization is still pending.")
                continue

            if oauth_error == "slow_down":
                delay_seconds += 1
                print(f"Attempt {attempt}: server requested slower polling. New interval {delay_seconds}s.")
                continue

            # access_denied, expired_token, invalid_grant, or any other terminal error
            raise

    print("No terminal result yet; continue polling or request user action.")


if __name__ == "__main__":
    main()
