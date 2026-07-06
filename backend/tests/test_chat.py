"""
Chat endpoint tests.

Covers: graceful fallback when ANTHROPIC_API_KEY is unset, and the happy path
with the Anthropic client mocked (no real API calls).
"""

from unittest.mock import MagicMock, patch


def test_chat_fallback_when_api_key_missing(client):
    r = client.post("/chat", json={"messages": [{"role": "user", "content": "Hi"}]})
    assert r.status_code == 200
    assert "Divya" in r.json()["message"]


def test_chat_empty_messages_allowed(client):
    r = client.post("/chat", json={"messages": []})
    assert r.status_code == 200


def test_chat_invalid_role_rejected(client):
    r = client.post("/chat", json={"messages": [{"role": "bot", "content": "Hi"}]})
    assert r.status_code == 422


def test_chat_success_with_configured_api_key(client):
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="Hello! How can I help you today?")]

    mock_anthropic_client = MagicMock()
    mock_anthropic_client.messages.create.return_value = mock_response

    with patch("app.routers.chat.settings.ANTHROPIC_API_KEY", "fake-key"), \
         patch("anthropic.Anthropic", return_value=mock_anthropic_client):
        r = client.post("/chat", json={"messages": [{"role": "user", "content": "What seafood do you have?"}]})

    assert r.status_code == 200
    assert r.json()["message"] == "Hello! How can I help you today?"


def test_chat_truncates_to_last_12_messages(client):
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="Reply")]
    mock_anthropic_client = MagicMock()
    mock_anthropic_client.messages.create.return_value = mock_response

    messages = [{"role": "user" if i % 2 == 0 else "assistant", "content": f"msg{i}"} for i in range(20)]

    with patch("app.routers.chat.settings.ANTHROPIC_API_KEY", "fake-key"), \
         patch("anthropic.Anthropic", return_value=mock_anthropic_client):
        r = client.post("/chat", json={"messages": messages})

    assert r.status_code == 200
    sent_messages = mock_anthropic_client.messages.create.call_args.kwargs["messages"]
    assert len(sent_messages) == 12
    assert sent_messages[0]["content"] == "msg8"
    assert sent_messages[-1]["content"] == "msg19"
