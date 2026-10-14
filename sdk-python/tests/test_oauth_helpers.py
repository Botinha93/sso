from nexusid_sdk import create_code_challenge, create_code_verifier, generate_pkce_pair


def test_code_verifier_has_value() -> None:
    verifier = create_code_verifier()
    assert isinstance(verifier, str)
    assert len(verifier) >= 40


def test_code_challenge_deterministic() -> None:
    verifier = "test-verifier"
    challenge = create_code_challenge(verifier)
    assert isinstance(challenge, str)
    assert len(challenge) > 10


def test_generate_pkce_pair() -> None:
    pair = generate_pkce_pair()
    assert pair.code_verifier
    assert pair.code_challenge
    assert pair.code_challenge_method == "S256"
