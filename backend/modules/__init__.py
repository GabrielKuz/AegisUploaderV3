#__init__.py
import os

from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from modules.StorageProvider import LocalStorageProvider, AzureFileStorageProvider
engine = create_engine(os.environ['DATABASE_URL'],)
Session = sessionmaker(bind=engine) # Create a main session factory to prevent multiple engine instances

if os.getenv("BUILD_TYPE", "dev") == "dev":
    STORAGE_ROOT = os.getenv("STORAGE_ROOT", "./storage") # Default to .storage if not set
    usFileStorageProvider = LocalStorageProvider(base_path=STORAGE_ROOT + "/us")
    euFileStorageProvider = LocalStorageProvider(base_path=STORAGE_ROOT + "/eu")
    itarFileStorageProvider = LocalStorageProvider(base_path=STORAGE_ROOT + "/itar")
else:
    usFileStorageProvider = AzureFileStorageProvider(connection_string=os.getenv("AZURE_STORAGE_CONNECTION_STRING_US"), share_name=os.getenv("AZURE_SHARE_NAME"), base_path=os.getenv("AZURE_SHARE_NAME"))
    euFileStorageProvider = AzureFileStorageProvider(connection_string=os.getenv("AZURE_STORAGE_CONNECTION_STRING_EU"), share_name=os.getenv("AZURE_SHARE_NAME"), storage_region=os.getenv("AZURE_SHARE_NAME"))
    itarFileStorageProvider = AzureFileStorageProvider(connection_string=os.getenv("AZURE_STORAGE_CONNECTION_STRING_ITAR"), share_name=os.getenv("AZURE_SHARE_NAME"), storage_region=os.getenv("AZURE_SHARE_NAME"))

"""
   def __init__(self, connection_string: str, share_name: str, base_path: str = "",):
        super().__init__(base_path)

        self.connection_string = connection_string
        self.share_name = share_name"""