namespace Spisa.DataMigration.Services;

/// <summary>
/// Interface for reading data from legacy SQL Server database
/// </summary>
public interface ILegacyDataReader
{
    Task<IEnumerable<T>> ReadDataAsync<T>(string tableName, string? whereClause = null);
    Task<int> GetRecordCountAsync(string tableName);
    Task TestConnectionAsync();
}

