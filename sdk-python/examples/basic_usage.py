from nexusid_sdk import create_admin_client, create_auth_api, create_client

BASE_URL = "http://127.0.0.1:4000"
CLIENT_ID = "example-client"
CLIENT_SECRET = "example-secret"


def main() -> None:
    client = create_client(base_url=BASE_URL)
    auth = create_auth_api(client)

    token = auth.exchange_client_credentials(
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
        scope=["openid", "profile"],
    )

    admin = create_admin_client(
        base_url=BASE_URL,
        auth={"type": "bearer", "token": token["access_token"]},
    )

    print(admin.users.list(limit=5, offset=0))


if __name__ == "__main__":
    main()
