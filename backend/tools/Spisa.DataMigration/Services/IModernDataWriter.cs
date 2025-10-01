namespace Spisa.DataMigration.Services;

/// <summary>
/// Interface for writing data to modern PostgreSQL database
/// </summary>
public interface IModernDataWriter
{
    Task<int> WriteDataAsync<T>(string tableName, IEnumerable<T> data);
    Task TruncateTableAsync(string tableName);
    Task ResetSequenceAsync(string tableName, string sequenceName);
    Task TestConnectionAsync();
    Task ExecuteRawSqlAsync(string sql);
}

