import httpx
import pytest

import nexusid_sdk.client as client_module
from nexusid_sdk.client import NexusIDClient, RetryPolicy


def test_retry_policy_accepts_inter_request_delay_seconds() -> None:
    policy = RetryPolicy(inter_request_delay_seconds=0.5)
    assert policy.inter_request_delay_seconds == 0.5


def test_inter_request_delay_throttles_between_requests(monkeypatch) -> None:
    sleeps: list[float] = []
    monkeypatch.setattr(client_module.time, "sleep", sleeps.append)

    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"ok": True}))
    client = NexusIDClient(
        base_url="https://nexusid.test",
        retry=RetryPolicy(inter_request_delay_seconds=0.5),
        http_client=httpx.Client(transport=transport),
    )

    try:
        assert client.get("/first") == {"ok": True}
        assert client.get("/second") == {"ok": True}
    finally:
        client.close()

    assert len(sleeps) == 1
    assert sleeps[0] == pytest.approx(0.5, abs=0.1)


def test_no_delay_without_inter_request_delay(monkeypatch) -> None:
    sleeps: list[float] = []
    monkeypatch.setattr(client_module.time, "sleep", sleeps.append)

    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"ok": True}))
    client = NexusIDClient(
        base_url="https://nexusid.test",
        http_client=httpx.Client(transport=transport),
    )

    try:
        client.get("/first")
        client.get("/second")
    finally:
        client.close()

    assert sleeps == []
