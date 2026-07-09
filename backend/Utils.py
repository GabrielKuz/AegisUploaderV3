import re

def IsCaseID(caseID: str) -> bool:
    return bool(re.compile("^AIS-\d{4,6}$").match(caseID))

def IsUUID(uuid: str) -> bool:
    return bool(re.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",re.IGNORECASE).match(uuid))