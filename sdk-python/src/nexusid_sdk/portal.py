from __future__ import annotations

from pathlib import Path
from typing import cast

from .client import NexusIDClient
from .generated import models as gm


class PortalAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def me(self) -> gm.GetApiPortalMeResponse:
        return cast(gm.GetApiPortalMeResponse, self._client.get("/api/portal/me"))

    def update_profile(self, payload: gm.PatchApiPortalProfileRequestBody) -> gm.PatchApiPortalProfileResponse:
        return cast(gm.PatchApiPortalProfileResponse, self._client.patch("/api/portal/profile", body=payload))

    def change_password(self, *, current_password: str, new_password: str) -> gm.PostApiPortalChangePasswordResponse:
        payload: gm.PostApiPortalChangePasswordRequestBody = {
            "currentPassword": current_password,
            "newPassword": new_password,
        }

        return cast(gm.PostApiPortalChangePasswordResponse, self._client.post(
            "/api/portal/change-password",
            body=payload,
        ))

    def delete_account(self, *, current_password: str | None = None) -> gm.DeleteApiPortalAccountResponse:
        payload: gm.DeleteApiPortalAccountRequestBody | None = None
        if current_password is not None:
            payload = {"currentPassword": current_password}

        self._client.delete(
            "/api/portal/account",
            body=payload,
        )
        return None

    def upload_avatar(self, file_path: str | Path) -> gm.PostApiPortalAvatarResponse:
        path = Path(file_path)
        with path.open("rb") as stream:
            return cast(gm.PostApiPortalAvatarResponse, self._client.post(
                "/api/portal/avatar",
                files={"file": (path.name, stream, "application/octet-stream")},
                parse_as="json",
            ))


def create_portal_api(client: NexusIDClient) -> PortalAPI:
    return PortalAPI(client)
