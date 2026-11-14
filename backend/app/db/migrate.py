import asyncio
import re
import sys
from pathlib import Path
import asyncpg
from app.config import PROJECT_ROOT, get_settings

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

settings = get_settings()

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


async def ensure_database_exists() -> None:
    """
    On native Windows PostgreSQL, only the default 'postgres' database exists at first.
    Connects to 'postgres' and creates 'naija_pulse' automatically if missing.
    (CREATE DATABASE cannot run inside a transaction block in PostgreSQL.)
    """
    db_name = settings.POSTGRES_DB
    if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", db_name):
        raise ValueError(f"Unsafe database identifier: {db_name}")

    admin_conn = await asyncpg.connect(
        user=settings.POSTGRES_USER,
        password=settings.POSTGRES_PASSWORD,
        database="postgres",
        host=settings.POSTGRES_HOST,
        port=settings.POSTGRES_PORT,
    )
    try:
        exists = await admin_conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1;", db_name
        )
        if not exists:
            print(f"  [→] Database '{db_name}' does not exist yet — creating it now...")
            await admin_conn.execute(f'CREATE DATABASE "{db_name}";')
            print(f"  [✓] Database '{db_name}' created!")
    finally:
        await admin_conn.close()


async def run_migrations():
    """
    Applies all unapplied SQL migrations in numerical order.
    """
    print(
        f"Connecting to PostgreSQL at {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB} "
        f"(user: {settings.POSTGRES_USER})..."
    )

    try:
        await ensure_database_exists()
        conn = await asyncpg.connect(
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            database=settings.POSTGRES_DB,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
        )
    except asyncpg.InvalidPasswordError:
        print(
            f"\n[✗] Password authentication failed for PostgreSQL user '{settings.POSTGRES_USER}'.\n"
            f"    Fix: Open {PROJECT_ROOT / '.env'} and set POSTGRES_PASSWORD= to the password\n"
            f"    you chose when installing PostgreSQL 18 on Windows, then re-run this command."
        )
        sys.exit(1)

    try:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)

        rows = await conn.fetch("SELECT version FROM schema_migrations;")
        applied = {r["version"] for r in rows}

        migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
        if not migration_files:
            print("No migration files found in", MIGRATIONS_DIR)
            return

        applied_count = 0
        for m_file in migration_files:
            filename = m_file.name
            if filename in applied:
                print(f"  [✓] {filename} (already applied)")
                continue

            print(f"  [→] Applying {filename}...")
            sql_content = m_file.read_text(encoding="utf-8")

            try:
                async with conn.transaction():
                    await conn.execute(sql_content)
                    await conn.execute(
                        "INSERT INTO schema_migrations (version) VALUES ($1);",
                        filename,
                    )
            except asyncpg.UndefinedFileError as err:
                if "postgis" in str(err).lower():
                    print(
                        "\n[✗] PostGIS extension is not installed yet in PostgreSQL 18.\n"
                        "    Fix: Run Stack Builder at C:\\Program Files\\PostgreSQL\\18\\bin\\stackbuilder.exe\n"
                        "    -> Select 'PostgreSQL 18 (x64) on port 5432' -> Spatial Extensions -> PostGIS Bundle."
                    )
                    sys.exit(1)
                raise

            print(f"  [✓] {filename} applied successfully!")
            applied_count += 1

        print(f"\nMigration complete! Applied {applied_count} new migration(s).")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run_migrations())
