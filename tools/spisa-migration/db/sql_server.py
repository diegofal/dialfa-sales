"""SQL Server reader with async wrapper."""
import pyodbc
import asyncio
import logging
from typing import List, Dict, Any, Type, TypeVar
from dataclasses import fields

from models.legacy import *

logger = logging.getLogger(__name__)

T = TypeVar('T')


class SqlServerReader:
    """Sync SQL Server reader wrapped in async interface."""
    
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self._connection = None
        
    def connect(self):
        """Open synchronous connection (for testing only)."""
        if not self._connection:
            self._connection = pyodbc.connect(self.connection_string)
        logger.info("Connected to SQL Server")
        
    def close(self):
        """Close connection."""
        if self._connection:
            self._connection.close()
            self._connection = None
    
    def _get_connection(self):
        """Get a new connection for each operation to avoid concurrency issues."""
        return pyodbc.connect(self.connection_string)
            
    async def test_connection(self):
        """Test database connection."""
        await asyncio.to_thread(self._test_connection_sync)
        
    def _test_connection_sync(self):
        """Sync test connection."""
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT @@VERSION")
            version = cursor.fetchone()[0]
            logger.info(f"SQL Server version: {version[:50]}...")
        finally:
            cursor.close()
            conn.close()
    
    async def read_table(self, table: str, model_class: Type[T]) -> List[T]:
        """
        Read entire table and convert to dataclass instances.
        
        Args:
            table: Table name
            model_class: Dataclass type to convert to
            
        Returns:
            List of dataclass instances
        """
        return await asyncio.to_thread(self._read_table_sync, table, model_class)
    
    def _read_table_sync(self, table: str, model_class: Type[T]) -> List[T]:
        """Sync read table implementation - creates new connection for each call."""
        # Create a new connection for this operation to avoid concurrency issues
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute(f"SELECT * FROM {table}")
            
            # Get column names from cursor description
            columns = [col[0] for col in cursor.description]
            
            # Get field names from dataclass
            field_names = {f.name for f in fields(model_class)}
            
            # Build mapping of DB column -> dataclass field
            # Handle case sensitivity
            col_to_field = {}
            for col in columns:
                # Try exact match first
                if col in field_names:
                    col_to_field[col] = col
                else:
                    # Try case-insensitive match
                    for field_name in field_names:
                        if col.lower() == field_name.lower():
                            col_to_field[col] = field_name
                            break
            
            # Fetch all rows and convert to dataclass instances
            results = []
            for row in cursor.fetchall():
                # Build dict with correct field names
                row_dict = {}
                for i, col in enumerate(columns):
                    if col in col_to_field:
                        field_name = col_to_field[col]
                        row_dict[field_name] = row[i]
                
                # Create dataclass instance
                instance = model_class(**row_dict)
                results.append(instance)
            
            logger.info(f"Read {len(results)} records from {table}")
            return results
            
        finally:
            cursor.close()
            conn.close()
    
    async def get_record_count(self, table: str) -> int:
        """Get count of records in table."""
        return await asyncio.to_thread(self._get_record_count_sync, table)
    
    def _get_record_count_sync(self, table: str) -> int:
        """Sync get count implementation."""
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            return count
        finally:
            cursor.close()
            conn.close()

