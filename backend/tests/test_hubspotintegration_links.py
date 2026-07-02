from pathlib import Path
import sys
from types import SimpleNamespace

import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from modules import HubSpotIntegration_Links as hs


class DummyTicket:
    def __init__(self, properties=None, **kwargs):
        self.properties = properties or {}
        for name, value in kwargs.items():
            setattr(self, name, value)


def _patch_api_client(monkeypatch, response):
    fake_search_api = SimpleNamespace(do_search=lambda *args, **kwargs: response)
    fake_api_client = SimpleNamespace(
        crm=SimpleNamespace(tickets=SimpleNamespace(search_api=fake_search_api))
    )
    monkeypatch.setattr(hs, "api_client", fake_api_client)


def test_get_link_case_id_returns_case_id_when_match_found(monkeypatch):
    ticket = DummyTicket(properties={"case_id": "AIS-123"})
    response = SimpleNamespace(results=[ticket])

    _patch_api_client(monkeypatch, response)

    assert hs.get_link_case_id("https://example.test/link") == "AIS-123"


def test_get_link_case_id_returns_none_when_no_matches(monkeypatch):
    response = SimpleNamespace(results=[])
    _patch_api_client(monkeypatch, response)

    assert hs.get_link_case_id("https://example.test/missing") is None


def test_get_link_case_status_returns_status_when_match_found(monkeypatch):
    ticket = DummyTicket(properties={"case_status": "Resolved"})
    response = SimpleNamespace(results=[ticket])

    _patch_api_client(monkeypatch, response)

    assert hs.get_link_case_status("https://example.test/link") == "Resolved"


def test_is_link_case_expirable_returns_true_for_expirable_status(monkeypatch):
    monkeypatch.setattr(hs, "get_link_case_status", lambda _link: "Closed")

    assert hs.is_link_case_expirable("https://example.test/link") is True


def test_is_link_case_expirable_returns_false_for_non_expirable_status(monkeypatch):
    monkeypatch.setattr(hs, "get_link_case_status", lambda _link: "Open")

    assert hs.is_link_case_expirable("https://example.test/link") is False


def test_get_ticket_by_link_returns_ticket_when_match_found(monkeypatch):
    ticket = DummyTicket(properties={"case_id": "AIS-700"})
    response = SimpleNamespace(results=[ticket])

    _patch_api_client(monkeypatch, response)

    assert hs.get_ticket_by_link("https://example.test/link") is ticket


def test_helpers_return_none_on_api_exception(monkeypatch):
    def fake_do_search(*args, **kwargs):
        raise hs.ApiException("boom")

    fake_search_api = SimpleNamespace(do_search=fake_do_search)
    fake_api_client = SimpleNamespace(
        crm=SimpleNamespace(tickets=SimpleNamespace(search_api=fake_search_api))
    )
    monkeypatch.setattr(hs, "api_client", fake_api_client)

    assert hs.get_link_case_id("https://example.test/link") is None
    assert hs.get_link_case_status("https://example.test/link") is None
    assert hs.get_ticket_by_link("https://example.test/link") is None
