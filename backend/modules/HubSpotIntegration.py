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

def is_ticket_archived(ais_id: str) -> Optional[bool]:
    return quikAtrbt(ais_id, 'archived')

def ticket_archive_location(ais_id: str) -> Optional[str]:
    return quikAtrbt(ais_id, 'archived_at')

#=======================================================================================================
# Property functions 
#=======================================================================================================

def get_caseCreateDate(ais_id: str) -> Optional[str]:
    return quikSrch(ais_id,"createdate")

def get_caseCloseDate(ais_id: str) -> Optional[str]:
    return quikSrch(ais_id,"closedate")

def get_caseITARstatus(ais_id: str) -> Optional[bool]:
    return quikSrch(ais_id,"itar")

def get_caseCompany(ais_id: str) -> Optional[str]:
    return quikSrch(ais_id,"company_name")

def get_caseSQLServer(ais_id: str) -> Optional[str]:
    return quikSrch(ais_id,"sql_server")

#=======================================================================================================
# Pipeline get functions 
#=======================================================================================================

def get_pipeline_stage_id(ais_id: str) -> Optional[str]:
    return quikSrch(ais_id,"hs_pipeline_stage")

def get_pipeline_id(ais_id: str) -> Optional[str]:
    return quikSrch(ais_id,"hs_pipeline")

def get_caseTier(ais_id: str) -> Optional[str]:
    return search_pipeline(ais_id,0)

def get_caseStatus(ais_id: str) -> Optional[str]:
    return search_pipeline(ais_id,1)

#=======================================================================================================
# Pipeline search function
#=======================================================================================================

def search_pipeline(ais_id: str, operationProtocolNumber: int) -> Optional[str]:
    stage_id = get_pipeline_stage_id(ais_id)
    pipeline_id = get_pipeline_id(ais_id)

    if not stage_id or not pipeline_id:
        return None

    # build lookup here
    lookup = {}

    try:
        response = api_client.crm.pipelines.pipelines_api.get_all(
            object_type="tickets"
        )
    except ApiException:
        return None
    
    if operationProtocolNumber == 0:

        for pipeline in response.results:
            lookup[pipeline.id] = pipeline.label

        return lookup.get((pipeline_id))
    
    if operationProtocolNumber == 1:

        for pipeline in response.results:
            for stage in pipeline.stages:
                lookup[(pipeline.id, stage.id)] = stage.label

        return lookup.get((pipeline_id, stage_id))
    
    return None

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
        properties=["ais_ticket_number", "hs_object_id", "createdate", "sql_server", "company_name", "hs_lastmodifieddate","closedate","hs_pipeline_stage","hs_pipeline","itar",],
    )

    try:
        response = api_client.crm.tickets.search_api.do_search(search_request)
    except ApiException:
        return None

    results = getattr(response, "results", None) or []
    return results[0] if results else None