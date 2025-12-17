"""Configuration management using Pydantic Settings."""
import os
import sys
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # SQL Server settings
    sqlserver_host: str = "localhost"
    sqlserver_port: int = 1433
    sqlserver_database: str = "SPISA"
    sqlserver_user: str = "sa"
    sqlserver_password: Optional[str] = None
    sqlserver_driver: str = "ODBC Driver 17 for SQL Server"
    
    # PostgreSQL settings
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_database: str = "spisa"
    postgres_user: str = "postgres"
    postgres_password: Optional[str] = None
    
    # Migration settings
    migration_dry_run: bool = False
    migration_batch_size: int = 1000
    migration_generate_report: bool = True
    migration_report_path: str = "./migration-reports"
    
    @property
    def sqlserver_connection_string(self) -> str:
        """Build SQL Server connection string for pyodbc."""
        if not self.sqlserver_password:
            raise ValueError(
                "SQL Server password not configured. "
                "Please set SQLSERVER_PASSWORD in your .env file."
            )
        return (
            f"DRIVER={{{self.sqlserver_driver}}};"
            f"SERVER={self.sqlserver_host},{self.sqlserver_port};"
            f"DATABASE={self.sqlserver_database};"
            f"UID={self.sqlserver_user};"
            f"PWD={self.sqlserver_password};"
            "TrustServerCertificate=yes;"
        )
    
    @property
    def postgres_dsn(self) -> str:
        """Build PostgreSQL DSN for asyncpg."""
        if not self.postgres_password:
            raise ValueError(
                "PostgreSQL password not configured. "
                "Please set POSTGRES_PASSWORD in your .env file."
            )
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_database}"
        )
    
    def validate_config(self) -> tuple[bool, list[str]]:
        """Validate configuration and return status and errors."""
        errors = []
        
        # Check .env file exists
        env_file = Path(".env")
        if not env_file.exists():
            errors.append(".env file not found. Copy .env.example to .env and configure it.")
        
        # Check required fields
        if not self.sqlserver_password:
            errors.append("SQLSERVER_PASSWORD is not set in .env")
        
        if not self.postgres_password:
            errors.append("POSTGRES_PASSWORD is not set in .env")
        
        return len(errors) == 0, errors


def _check_env_file():
    """Check if .env file exists and show helpful message if not."""
    env_file = Path(".env")
    if not env_file.exists():
        print("\n❌ Configuration Error: .env file not found!\n")
        print("Please create a .env file with your database credentials:")
        print("\n1. Copy the example file:")
        print("   cp .env.example .env     # Linux/Mac")
        print("   copy .env.example .env   # Windows")
        print("\n2. Edit .env and set your passwords:")
        print("   SQLSERVER_PASSWORD=your_sql_server_password")
        print("   POSTGRES_PASSWORD=your_postgres_password")
        print("\n3. Optionally configure hosts and other settings")
        print("\nSee QUICKSTART.md for detailed setup instructions.\n")
        sys.exit(1)


# Check for .env file before loading
_check_env_file()

# Global settings instance
try:
    settings = Settings()
except Exception as e:
    print(f"\n❌ Configuration Error: {e}\n")
    print("Please check your .env file has all required settings.")
    print("See .env.example for the required format.\n")
    sys.exit(1)

