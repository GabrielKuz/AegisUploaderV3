import os
from typing import Optional

from hubspot import HubSpot
from hubspot.crm.tickets import ApiException
from hubspot.crm.tickets.models import Filter, FilterGroup, PublicObjectSearchRequest

api_client = HubSpot(access_token=os.getenv("HUBSPOT_ACCESS_TOKEN"))

def get_link_case_id(link: str) -> Optional[str]:
    """
    Given a link, retrieve the associated case ID from HubSpot.
    """
    try:
        # Create a filter to search for the link
        filter = Filter(property_name="link", operator="EQ", value=link)
        filter_group = FilterGroup(filters=[filter])
        search_request = PublicObjectSearchRequest(filter_groups=[filter_group], properties=["case_id"])

        # Perform the search
        response = api_client.crm.tickets.search_api.do_search(public_object_search_request=search_request)

        # Check if any results were returned
        if response.results:
            return response.results[0].properties.get("case_id")
        else:
            return None

    except ApiException as e:
        print(f"Exception when calling HubSpot API: {e}")
        return None
    
def get_link_case_status(link: str) -> Optional[str]:
    """
    Given a link, retrieve the associated case status from HubSpot.
    """
    try:
        # Create a filter to search for the link
        filter = Filter(property_name="link", operator="EQ", value=link)
        filter_group = FilterGroup(filters=[filter])
        search_request = PublicObjectSearchRequest(filter_groups=[filter_group], properties=["case_status"])

        # Perform the search
        response = api_client.crm.tickets.search_api.do_search(public_object_search_request=search_request)

        # Check if any results were returned
        if response.results:
            return response.results[0].properties.get("case_status")
        else:
            return None

    except ApiException as e:
        print(f"Exception when calling HubSpot API: {e}")
        return None
    
def is_link_case_expirable(link: str) -> bool:
    """
    Given a link, determine if the associated case is expirable based on its status in HubSpot.
    """
    case_status = get_link_case_status(link)
    if case_status is None:
        return False  # If we can't find the case status, assume it's not expirable

    # Define statuses that are considered expirable
    expirable_statuses = {"Closed", "Resolved", "Completed"}  # Adjust based on your business logic

    return case_status in expirable_statuses

def get_ticket_by_link(link: str):
    """
    Given a link, retrieve the associated ticket from HubSpot.
    """
    try:
        # Create a filter to search for the link
        filter = Filter(property_name="link", operator="EQ", value=link)
        filter_group = FilterGroup(filters=[filter])
        search_request = PublicObjectSearchRequest(filter_groups=[filter_group])

        # Perform the search
        response = api_client.crm.tickets.search_api.do_search(public_object_search_request=search_request)

        # Check if any results were returned
        if response.results:
            return response.results[0]  # Return the first matching ticket
        else:
            return None

    except ApiException as e:
        print(f"Exception when calling HubSpot API: {e}")
        return None