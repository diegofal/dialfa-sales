using System.Data;
using System.Data.SqlClient;
using Dapper;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Spisa.DataMigration.Services;

public class SqlServerDataReader : ILegacyDataReader
{
    private readonly string _connectionString;
    private readonly ILogger<SqlServerDataReader> _logger;

    public SqlServerDataReader(IConfiguration configuration, ILogger<SqlServerDataReader> logger)
    {
        _connectionString = configuration["ConnectionStrings:SqlServer"] 
            ?? throw new InvalidOperationException("SQL Server connection string not found");
        _logger = logger;
    }

    public async Task<IEnumerable<T>> ReadDataAsync<T>(string tableName, string? whereClause = null)
    {
        using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        var query = $"SELECT * FROM {tableName}";
        if (!string.IsNullOrWhiteSpace(whereClause))
        {
            query += $" WHERE {whereClause}";
        }

        _logger.LogDebug("Executing query: {Query}", query);
        
        return await connection.QueryAsync<T>(query);
    }

    public async Task<int> GetRecordCountAsync(string tableName)
    {
        using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        var query = $"SELECT COUNT(*) FROM {tableName}";
        return await connection.ExecuteScalarAsync<int>(query);
    }

    public async Task TestConnectionAsync()
    {
        using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();
        _logger.LogInformation("Successfully connected to SQL Server");
    }
}

