import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from modules import HubSpotIntegration as hs


class DummyTicket:
    def __init__(self, properties=None, **kwargs):
        self.properties = properties or {}
        for name, value in kwargs.items():
            setattr(self, name, value)


def test_advancedSearchThroughHubSpot_builds_search_request_and_returns_first_result(monkeypatch):
    ticket = DummyTicket(properties={"ais_ticket_number": "AIS-0000", "company_name": "Acme"}, id="123")
    response = SimpleNamespace(results=[ticket])

    captured = {}

    def fake_do_search(self, request):
        captured["request"] = request
        return response

    monkeypatch.setattr(
        hs.api_client.crm.tickets.search_api.__class__,
        "do_search",
        fake_do_search,
    )

    result = hs.advancedSearchThroughHubSpot("AIS-0000", "ais_ticket_number")

    assert result is ticket
    assert captured["request"].filter_groups[0].filters[0].property_name == "ais_ticket_number"
    assert captured["request"].filter_groups[0].filters[0].value == "AIS-0000"
    assert "ais_ticket_number" in captured["request"].properties


def test_advancedSearchThroughHubSpot_returns_none_if_search_term_empty():
    assert hs.advancedSearchThroughHubSpot("", "ais_ticket_number") is None


def test_advancedSearchThroughHubSpot_returns_none_on_api_exception(monkeypatch):
    def fake_do_search(_):
        raise hs.ApiException("search failure")

    monkeypatch.setattr(hs.api_client.crm.tickets.search_api, "do_search", fake_do_search)
    assert hs.advancedSearchThroughHubSpot("AIS-0000", "ais_ticket_number") is None


def test_advancedSearchThroughHubSpot_returns_none_when_no_results(monkeypatch):
    response = SimpleNamespace(results=[])
    monkeypatch.setattr(hs.api_client.crm.tickets.search_api, "do_search", lambda _req: response)
    assert hs.advancedSearchThroughHubSpot("AIS-0000", "ais_ticket_number") is None


def test_get_ticket_delegates_to_advanced_search(monkeypatch):
    ticket = DummyTicket(properties={"ais_ticket_number": "AIS-0000"})
    monkeypatch.setattr(hs, "advancedSearchThroughHubSpot", lambda value, field: ticket if value == "AIS-0000" else None)

    assert hs.get_ticket("AIS-0000") is ticket
    assert hs.get_ticket("MISSING") is None


def test_get_AIS_Id_returns_ais_ticket_number(monkeypatch):
    ticket = DummyTicket(properties={"ais_ticket_number": "AIS-0000"})
    monkeypatch.setattr(hs, "advancedSearchThroughHubSpot", lambda value, field: ticket)

    assert hs.get_AIS_Id("123") == "AIS-0000"


def test_get_AIS_Id_returns_none_when_ticket_not_found(monkeypatch):
    monkeypatch.setattr(hs, "advancedSearchThroughHubSpot", lambda value, field: None)
    assert hs.get_AIS_Id("123") is None


def test_quikSrch_returns_ticket_property(monkeypatch):
    ticket = DummyTicket(properties={"company_name": "Doofenshmirtz Evil Incorporated", "createdate": "2026-06-30"})
    monkeypatch.setattr(hs, "get_ticket", lambda value: ticket)

    assert hs.quikSrch("AIS-0000", "company_name") == "Doofenshmirtz Evil Incorporated"
    assert hs.quikSrch("AIS-0000", "createdate") == "2026-06-30"


def test_quikSrch_returns_none_when_ticket_missing(monkeypatch):
    monkeypatch.setattr(hs, "get_ticket", lambda value: None)
    assert hs.quikSrch("AIS-0000", "company_name") is None


def test_quikAtrbt_returns_ticket_attribute(monkeypatch):
    ticket = DummyTicket(properties={"ais_ticket_number": "AIS-0000"}, id="12345", archived=True)
    monkeypatch.setattr(hs, "get_ticket", lambda value: ticket)

    assert hs.quikAtrbt("AIS-0000", "id") == "12345"
    assert hs.quikAtrbt("AIS-0000", "archived") is True


def test_quikAtrbt_returns_none_for_missing_attribute(monkeypatch):
    ticket = DummyTicket(properties={"ais_ticket_number": "AIS-0000"})
    monkeypatch.setattr(hs, "get_ticket", lambda value: ticket)
    assert hs.quikAtrbt("AIS-0000", "archived_at") is None


def test_get_caseStatus_returns_pipeline_stage(monkeypatch):
    monkeypatch.setattr(hs, "get_pipeline_stage_id", lambda value: "stage-1")
    monkeypatch.setattr(hs, "get_pipeline_id", lambda value: "pipeline-1")

    class DummyStage:
        def __init__(self, stage_id, label):
            self.id = stage_id
            self.label = label

    class DummyPipeline:
        def __init__(self, pipeline_id, stage_id, label):
            self.id = pipeline_id
            self.stages = [DummyStage(stage_id, label)]

    class DummyResponse:
        def __init__(self, pipelines):
            self.results = pipelines

    monkeypatch.setattr(
        hs.api_client.crm.pipelines.pipelines_api.__class__,
        "get_all",
        lambda self, object_type="tickets": DummyResponse([DummyPipeline("pipeline-1", "stage-1", "Closed Won")]),
    )

    assert hs.search_pipeline("AIS-0000",1) == "Closed Won"


def test_get_caseStatus_returns_none_when_ticket_missing(monkeypatch):
    monkeypatch.setattr(hs, "get_pipeline_stage_id", lambda value: None)
    monkeypatch.setattr(hs, "get_pipeline_id", lambda value: None)

    assert hs.search_pipeline("AIS-0000",1) is None


def test_get_caseITARstatus_returns_itar_value(monkeypatch):
    ticket = DummyTicket(properties={"itar": "true"})
    monkeypatch.setattr(hs, "get_ticket", lambda value: ticket)

    assert hs.get_caseITARstatus("AIS-0000") == "true"


def test_get_caseITARstatus_returns_none_when_property_missing(monkeypatch):
    ticket = DummyTicket(properties={"company_name": "Acme"})
    monkeypatch.setattr(hs, "get_ticket", lambda value: ticket)

    assert hs.get_caseITARstatus("AIS-0000") is None


@pytest.mark.parametrize(
    "function_name,expected_value,attribute_name,attribute_value",
    [
        ("get_ticket_id", "12345", "id", "12345"),
        ("is_ticket_archived", True, "archived", True),
        ("ticket_archive_location", None, "archived_at", None),
    ],
)
def test_attribute_accessors(function_name, expected_value, attribute_name, attribute_value, monkeypatch):
    ticket = DummyTicket(properties={})
    setattr(ticket, attribute_name, attribute_value)
    monkeypatch.setattr(hs, "get_ticket", lambda value: ticket)
    assert getattr(hs, function_name)("AIS-0000") == expected_value


@pytest.mark.parametrize(
    "function_name,property_name,expected_value",
    [
        ("get_caseCreateDate", "createdate", "2026-06-30"),
        ("get_caseCloseDate", "closedate", "2026-07-01"),
        ("get_caseCompany", "company_name", "Acme"),
        ("get_caseSQLServer", "sql_server", "sql01"),
    ],
)
def test_property_accessors(function_name, property_name, expected_value, monkeypatch):
    ticket = DummyTicket(properties={property_name: expected_value})
    monkeypatch.setattr(hs, "get_ticket", lambda value: ticket)
    assert getattr(hs, function_name)("AIS-0000") == expected_value
