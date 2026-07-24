import os
import time
import logging

from hubspot import HubSpot
from typing import Optional
from hubspot.crm.tickets import ApiException, PublicObjectSearchRequest
from hubspot.crm.tickets.models import Filter, FilterGroup

logger = logging.getLogger(__name__)
token = os.getenv("HUBSPOT_ACCESS_TOKEN")
api_client = HubSpot(access_token=token)
logger.warning(f"HubSpot token loaded: {bool(token)}, length={len(token) if token else 0}")
del token  # Remove token from memory for security reasons
#=======================================================================================================
# Main Functions
#=======================================================================================================

def caseIDExists(case_id: str) -> bool:
    logger.debug(f"Checking if case ID exists: {case_id}")
    ticket = advancedSearchThroughHubSpot(case_id, "ais_ticket_number")
    return ticket is not None

def get_ticket(ais_id: str):
    logger.debug(f"Retrieving ticket for AIS ID: {ais_id}")
    return advancedSearchThroughHubSpot(ais_id, "ais_ticket_number")


def get_AIS_Id(ticket_id: str) -> Optional[str]:
    logger.debug(f"Retrieving AIS ID for ticket ID: {ticket_id}")
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
    value = quikSrch(ais_id,"itar")
    match value:
        case "true":
            return True
        case "false":
            return False
        case _:
            return None

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
    except ApiException as e:
        logger.error(f"Failed to retrieve pipelines from HubSpot: {e}")
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

def is_caseExpirable(ais_id: str) -> Optional[bool]:
    status = get_caseStatus(ais_id)
    if status is None:
        return None
    return status.lower() == "Closed"

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

#=======================================================================================================
# Scheduler optimized status lookup
#=======================================================================================================
_scheduler_pipeline_cache = None
_scheduler_pipeline_cache_time = 0
_SCHEDULER_PIPELINE_CACHE_TTL = 3600  # refresh every hour
_SCHEDULER_REQUEST_INTERVAL = 0.6
_scheduler_last_request_time = 0

def _scheduler_rate_limit():
    global _scheduler_last_request_time

    now = time.time()
    elapsed = now - _scheduler_last_request_time

    if elapsed < _SCHEDULER_REQUEST_INTERVAL:
        time.sleep(_SCHEDULER_REQUEST_INTERVAL - elapsed)

    _scheduler_last_request_time = time.time()

def _scheduler_get_pipelines():
    global _scheduler_pipeline_cache, _scheduler_pipeline_cache_time

    now = time.time()

    if _scheduler_pipeline_cache is None or now - _scheduler_pipeline_cache_time > _SCHEDULER_PIPELINE_CACHE_TTL:
        try:
            _scheduler_pipeline_cache = api_client.crm.pipelines.pipelines_api.get_all(object_type="tickets")
            _scheduler_pipeline_cache_time = now

        except ApiException as e:
            logger.error(
                f"Failed retrieving HubSpot pipelines: "
                f"status={getattr(e, 'status', None)} "
                f"body={getattr(e, 'body', None)}"
            )
            return None

    return _scheduler_pipeline_cache


def _scheduler_hubspot_search(case_id: str):
    if not case_id:
        return None

    search_request = PublicObjectSearchRequest(
        filter_groups=[
            FilterGroup(
                filters=[
                    Filter(
                        property_name="ais_ticket_number",
                        operator="EQ",
                        value=case_id,
                    )
                ]
            )
        ],
        properties=[
            "hs_pipeline",
            "hs_pipeline_stage",
        ],
    )

    retries = 4

    for attempt in range(retries):
        try:
            return api_client.crm.tickets.search_api.do_search(
                search_request
            )

        except ApiException as e:
            status_code = getattr(e, "status", None)
            _scheduler_rate_limit() # sleep to avoid rate limiting

            if status_code == 429:
                wait = 2 ** (attempt + 1)  
                logger.warning(
                    f"HubSpot rate limited for case {case_id}. "
                    f"Retrying in {wait}s..."
                )
                time.sleep(wait)
                continue

            logger.error(
                f"HubSpot search failed for {case_id}: "
                f"status={status_code} "
                f"body={getattr(e, 'body', None)}"
            )
            return None

    logger.error(f"HubSpot rate limit exceeded after retries for {case_id}")
    return None


def get_caseStatus_scheduler(case_id: str) -> Optional[str]:
    response = _scheduler_hubspot_search(case_id)

    if not response:
        return None

    results = getattr(response, "results", None)

    if not results:
        return None

    ticket = results[0]

    props = getattr(ticket, "properties", {}) or {}

    pipeline_id = props.get("hs_pipeline")
    stage_id = props.get("hs_pipeline_stage")

    if not pipeline_id or not stage_id:
        return None

    pipelines = _scheduler_get_pipelines()

    if not pipelines:
        return None

    for pipeline in pipelines.results:
        if str(pipeline.id) == str(pipeline_id):
            for stage in pipeline.stages:
                if str(stage.id) == str(stage_id):
                    return stage.label

    return None