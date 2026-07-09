#__init__.py
import os

from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from modules.StorageProvider import LocalStorageProvider
engine = create_engine(os.environ['DATABASE_URL'],)
Session = sessionmaker(bind=engine) # Create a main session factory to prevent multiple engine instances

STORAGE_ROOT = os.getenv("STORAGE_ROOT", ".storage") # Default to .storage if not set
usFileStorageProvider = LocalStorageProvider(base_path=STORAGE_ROOT + "/us")
euFileStorageProvider = LocalStorageProvider(base_path=STORAGE_ROOT + "/eu")
itarFileStorageProvider = LocalStorageProvider(base_path=STORAGE_ROOT + "/itar")