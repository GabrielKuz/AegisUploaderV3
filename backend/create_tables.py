from modules import engine
from modules.models import Base
from sqlalchemy import text

def main():
    with engine.begin() as conn: # Using begin to ensure that the schema is committed before tables are created
        conn.execute(text('CREATE SCHEMA IF NOT EXISTS "LinkDB"'))

    Base.metadata.create_all(bind=engine) # idempotent

    with engine.connect() as conn: # Check what tables exist in the LinkDB schema after creation to allow for verification 
        result = conn.execute(text("""
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_schema = 'LinkDB'
        """))


if __name__ == "__main__":
    main()