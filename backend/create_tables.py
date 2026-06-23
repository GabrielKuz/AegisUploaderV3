from modules import engine
from modules.models import Base
from sqlalchemy import text


def main() -> None:
    with engine.connect() as conn:
        conn.execute(text('CREATE SCHEMA IF NOT EXISTS "LinkDB"'))
        conn.commit()
        Base.metadata.create_all(bind=conn)

    print("Created UploadRecord and LinkRecord tables")


if __name__ == "__main__":
    main()
