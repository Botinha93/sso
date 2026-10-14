import httpx
import pytest

import nexusid_sdk.client as client_module
from nexusid_sdk.client import NexusIDClient, RetryPolicy
from nexusid_sdk.errors import APIResponseError


def _sequenced_transport(responses: list[httpx.Response]) -> httpx.MockTransport:
    """A transport that returns the given responses in order, one per request."""
    calls = {"n": 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        index = min(calls["n"], len(responses) - 1)
        calls["n"] += 1
        return responses[index]

    return httpx.MockTransport(handler)


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


def test_retry_on_429_honors_retry_after_header(monkeypatch) -> None:
    sleeps: list[float] = []
    monkeypatch.setattr(client_module.time, "sleep", sleeps.append)

    transport = _sequenced_transport(
        [
            httpx.Response(429, headers={"Retry-After": "2"}, json={"error": "rate_limited"}),
            httpx.Response(200, json={"ok": True}),
        ]
    )
    client = NexusIDClient(
        base_url="https://nexusid.test",
        retry=RetryPolicy(max_attempts=2, backoff_seconds=0.15),
        http_client=httpx.Client(transport=transport),
    )

    try:
        assert client.get("/thing") == {"ok": True}
    finally:
        client.close()

    assert sleeps == [pytest.approx(2.0, abs=0.01)]


def test_retry_after_from_body_hint(monkeypatch) -> None:
    sleeps: list[float] = []
    monkeypatch.setattr(client_module.time, "sleep", sleeps.append)

    transport = _sequenced_transport(
        [
            httpx.Response(429, json={"error": "rate_limited", "retryAfterSeconds": 3}),
            httpx.Response(200, json={"ok": True}),
        ]
    )
    client = NexusIDClient(
        base_url="https://nexusid.test",
        retry=RetryPolicy(max_attempts=2, backoff_seconds=0.15),
        http_client=httpx.Client(transport=transport),
    )

    try:
        assert client.get("/thing") == {"ok": True}
    finally:
        client.close()

    assert sleeps == [pytest.approx(3.0, abs=0.01)]


def test_retry_after_is_capped(monkeypatch) -> None:
    sleeps: list[float] = []
    monkeypatch.setattr(client_module.time, "sleep", sleeps.append)

    transport = _sequenced_transport(
        [
            httpx.Response(429, headers={"Retry-After": "100"}, json={}),
            httpx.Response(200, json={"ok": True}),
        ]
    )
    client = NexusIDClient(
        base_url="https://nexusid.test",
        retry=RetryPolicy(max_attempts=2, max_retry_after_seconds=5.0),
        http_client=httpx.Client(transport=transport),
    )

    try:
        assert client.get("/thing") == {"ok": True}
    finally:
        client.close()

    assert sleeps == [pytest.approx(5.0, abs=0.01)]


def test_retryable_status_uses_linear_backoff_without_retry_after(monkeypatch) -> None:
    sleeps: list[float] = []
    monkeypatch.setattr(client_module.time, "sleep", sleeps.append)

    transport = _sequenced_transport(
        [
            httpx.Response(503, json={}),
            httpx.Response(200, json={"ok": True}),
        ]
    )
    client = NexusIDClient(
        base_url="https://nexusid.test",
        retry=RetryPolicy(max_attempts=2, backoff_seconds=0.2),
        http_client=httpx.Client(transport=transport),
    )

    try:
        assert client.get("/thing") == {"ok": True}
    finally:
        client.close()

    assert sleeps == [pytest.approx(0.2, abs=0.01)]


def test_respect_retry_after_false_uses_backoff(monkeypatch) -> None:
    sleeps: list[float] = []
    monkeypatch.setattr(client_module.time, "sleep", sleeps.append)

    transport = _sequenced_transport(
        [
            httpx.Response(429, headers={"Retry-After": "9"}, json={}),
            httpx.Response(200, json={"ok": True}),
        ]
    )
    client = NexusIDClient(
        base_url="https://nexusid.test",
        retry=RetryPolicy(max_attempts=2, backoff_seconds=0.25, respect_retry_after=False),
        http_client=httpx.Client(transport=transport),
    )

    try:
        assert client.get("/thing") == {"ok": True}
    finally:
        client.close()

    assert sleeps == [pytest.approx(0.25, abs=0.01)]


def test_no_retry_when_max_attempts_one_sets_retry_after_on_error(monkeypatch) -> None:
    sleeps: list[float] = []
    monkeypatch.setattr(client_module.time, "sleep", sleeps.append)

    transport = _sequenced_transport(
        [httpx.Response(429, headers={"Retry-After": "7"}, json={"error": "rate_limited"})]
    )
    client = NexusIDClient(
        base_url="https://nexusid.test",
        retry=RetryPolicy(max_attempts=1),
        http_client=httpx.Client(transport=transport),
    )

    try:
        with pytest.raises(APIResponseError) as excinfo:
            client.get("/thing")
    finally:
        client.close()

    assert excinfo.value.status_code == 429
    assert excinfo.value.retry_after == pytest.approx(7.0, abs=0.01)
    assert sleeps == []
