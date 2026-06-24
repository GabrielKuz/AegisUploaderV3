from modules import engine
from modules.models import Base
from sqlalchemy import text

def main():
    with engine.begin() as conn:
        conn.execute(text('CREATE SCHEMA IF NOT EXISTS "LinkDB"'))

    print("Creating tables...")
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_schema = 'LinkDB'
        """))

        print("Tables after create_all:")
        print(result.fetchall())

if __name__ == "__main__":
    main()