import os
from typing import Optional

from hubspot import HubSpot
from hubspot.crm.tickets import ApiException, PublicObjectSearchRequest
from hubspot.crm.tickets.models import Filter, FilterGroup

api_client = HubSpot(access_token=os.getenv("HUBSPOT_ACCESS_TOKEN"))

#=======================================================================================================
# Main Functions
#=======================================================================================================

def get_ticket(ais_id: str):
    return advancedSearchThroughHubSpot(ais_id, "ais_ticket_number")


def get_AIS_Id(ticket_id: str) -> Optional[str]:
    ticket = advancedSearchThroughHubSpot(ticket_id, "hs_object_id")
    return (ticket.properties or {}).get("ais_ticket_number") if ticket else None

#=======================================================================================================
# quik Systems
#=======================================================================================================

# creates ticket object from ais id and then allows an input of search item to be found attached to the ticket object
def quikSrch(ais_id: str, searchTerm: str) -> Optional[str]:
    ticket = get_ticket(ais_id)
    if not ticket:
        return None
    return (ticket.properties or {}).get(searchTerm)

def quikAtrbt(ais_id: str, searchTerm: str) -> Optional[str]:
    ticket = get_ticket(ais_id)
    return getattr(ticket, searchTerm, None)

#=======================================================================================================
# Attribute functions 
#=======================================================================================================

def get_ticket_id(ais_id: str) -> Optional[str]:
    return quikAtrbt(ais_id, 'id')

def is_ticket_archived(ais_id: str) -> Optional[str]:
    return quikAtrbt(ais_id, 'archived')

def ticket_archive_location(ais_id: str) -> Optional[str]:
    return quikAtrbt(ais_id, 'archived_at')

def ticket_updated_at(ais_id: str) -> Optional[str]:
    return quikAtrbt(ais_id, 'updated at')

#=======================================================================================================
# Property functions 
#=======================================================================================================

def get_caseCreateDate(ais_id: str) -> Optional[str]:
    return quikSrch(ais_id,"createdate")

def get_caseCloseDate(ais_id: str) -> Optional[str]:
    return quikSrch(ais_id,"closedate")

#def get_caseStatus(ais_id: str) -> Optional[str]:
#    return quikSrch(ais_id,"case_status")

#def get_caseSource(ais_id: str) -> Optional[str]:
#    return quikSrch(ais_id,"case_source")

#def get_caseITARstatus(ais_id: str) -> Optional[str]:
#    return quikSrch(ais_id,"itar")

#def get_caseIssue(ais_id: str) -> Optional[str]:
#    return quikSrch(ais_id,"category")

def get_caseCompany(ais_id: str) -> Optional[str]:
    return quikSrch(ais_id,"company_name")

def get_caseSQLServer(ais_id: str) -> Optional[str]:
    return quikSrch(ais_id,"sql_server")

#=======================================================================================================
# Miscellaneous functions 
#=======================================================================================================

def advancedSearchThroughHubSpot(searchTerm: str, searchTermHS_name: str):
    if not searchTerm:
        return None
    search_request = PublicObjectSearchRequest(
        filter_groups=[
            FilterGroup(
                filters=[
                    Filter(
                        property_name=searchTermHS_name,
                        operator="EQ",
                        value=searchTerm,
                    )
                ]
            )
        ],
        properties=["ais_ticket_number", "hs_object_id", "createdate", "sql_server", "company_name", "hs_lastmodifieddate","closedate","case_status(fill with correct data later)","source_type(fill with correct data later)","itar(fill with correct data later)","issue(fill with correct data later)"],
    )

    try:
        response = api_client.crm.tickets.search_api.do_search(search_request)
    except ApiException:
        return None

    results = getattr(response, "results", None) or []
    return results[0] if results else None

#       ||| USED FOR TESTING |||  if __name__ == "__main__":  ||| USED FOR TESTING |||  