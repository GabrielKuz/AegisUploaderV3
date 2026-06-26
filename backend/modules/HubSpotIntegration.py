import os
from typing import Optional

from hubspot import HubSpot
from hubspot.crm.tickets import ApiException, PublicObjectSearchRequest
from hubspot.crm.tickets.models import Filter, FilterGroup

api_client = HubSpot(access_token=os.getenv("HUBSPOT_ACCESS_TOKEN"))


def get_ticket(ais_id: str):
    if not ais_id:
        return None

    search_request = PublicObjectSearchRequest(
        filter_groups=[
            FilterGroup(
                filters=[
                    Filter(
                        property_name="ais_ticket_number",
                        operator="EQ",
                        value=ais_id,
                    )
                ]
            )
        ],
        properties=["ais_ticket_number", "subject", "caseID", "caseStatus", "expiration_date"],
    )

    try:
        response = api_client.crm.tickets.search_api.do_search(search_request)
    except ApiException:
        return None

    results = getattr(response, "results", None) or []
    return results[0] if results else None


def get_ticket_id(ais_id: str) -> Optional[str]:
    ticket = get_ticket(ais_id)
    return getattr(ticket, "id", None)


def get_caseID(ais_id: str) -> Optional[str]:
    ticket = get_ticket(ais_id)
    if not ticket:
        return None
    return (ticket.properties or {}).get("caseID")


def get_caseStatus(ais_id: str) -> Optional[str]:
    ticket = get_ticket(ais_id)
    if not ticket:
        return None
    return (ticket.properties or {}).get("caseStatus")


def is_caseExpirable(ais_id: str) -> bool:
    ticket = get_ticket(ais_id)
    if not ticket:
        return False

    expiration_date = (ticket.properties or {}).get("expiration_date")
    return bool(expiration_date)