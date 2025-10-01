using Dapper;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Spisa.DataMigration.Services;

public class PostgresDataWriter : IModernDataWriter
{
    private readonly string _connectionString;
    private readonly ILogger<PostgresDataWriter> _logger;
    private readonly bool _dryRun;

    public PostgresDataWriter(IConfiguration configuration, ILogger<PostgresDataWriter> logger)
    {
        _connectionString = configuration["ConnectionStrings:PostgreSQL"] 
            ?? throw new InvalidOperationException("PostgreSQL connection string not found");
        _logger = logger;
        _dryRun = configuration.GetValue<bool>("Migration:DryRun");
    }

    public async Task<int> WriteDataAsync<T>(string tableName, IEnumerable<T> data)
    {
        if (_dryRun)
        {
            _logger.LogInformation("[DRY RUN] Would insert {Count} records into {Table}", 
                data.Count(), tableName);
            return data.Count();
        }

        using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync();

        var count = 0;
        using var transaction = await connection.BeginTransactionAsync();
        
        try
        {
            foreach (var item in data)
            {
                // Include ALL properties including Id to preserve legacy IDs
                var properties = typeof(T).GetProperties();
                
                var columns = string.Join(", ", properties.Select(p => ToSnakeCase(p.Name)));
                
                // Special handling for ENUMs
                var parametersList = new List<string>();
                foreach (var prop in properties)
                {
                    var paramName = "@" + prop.Name;
                    // Cast status to order_status ENUM for sales_orders table
                    if (tableName == "sales_orders" && prop.Name == "Status")
                    {
                        parametersList.Add($"{paramName}::order_status");
                    }
                    else
                    {
                        parametersList.Add(paramName);
                    }
                }
                var parameters = string.Join(", ", parametersList);
                
                var sql = $"INSERT INTO {tableName} ({columns}) VALUES ({parameters})";
                
                await connection.ExecuteAsync(sql, item, transaction);
                count++;
            }
            
            await transaction.CommitAsync();
            _logger.LogInformation("Inserted {Count} records into {Table}", count, tableName);
            
            return count;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Error inserting data into {Table}", tableName);
            throw;
        }
    }

    public async Task TruncateTableAsync(string tableName)
    {
        if (_dryRun)
        {
            _logger.LogInformation("[DRY RUN] Would truncate table {Table}", tableName);
            return;
        }

        using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync();
        
        await connection.ExecuteAsync($"TRUNCATE TABLE {tableName} CASCADE");
        _logger.LogInformation("Truncated table {Table}", tableName);
    }

    public async Task ResetSequenceAsync(string tableName, string sequenceName)
    {
        if (_dryRun)
        {
            _logger.LogInformation("[DRY RUN] Would reset sequence {Sequence}", sequenceName);
            return;
        }

        using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync();
        
        var sql = $"SELECT setval('{sequenceName}', COALESCE((SELECT MAX(id) FROM {tableName}), 1))";
        await connection.ExecuteAsync(sql);
        
        _logger.LogInformation("Reset sequence {Sequence} for table {Table}", sequenceName, tableName);
    }

    public async Task TestConnectionAsync()
    {
        using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync();
        _logger.LogInformation("Successfully connected to PostgreSQL");
    }

    public async Task ExecuteRawSqlAsync(string sql)
    {
        if (_dryRun)
        {
            _logger.LogInformation("[DRY RUN] Would execute SQL: {Sql}", sql);
            return;
        }

        using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync();
        await connection.ExecuteAsync(sql);
    }

    public async Task<int> GetRecordCountAsync(string tableName)
    {
        using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync();
        
        var sql = $"SELECT COUNT(*) FROM {tableName} WHERE deleted_at IS NULL";
        var count = await connection.ExecuteScalarAsync<int>(sql);
        
        return count;
    }

    public async Task<HashSet<int>> GetValidIdsAsync(string tableName)
    {
        using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync();
        
        var sql = $"SELECT id FROM {tableName}";
        var ids = await connection.QueryAsync<int>(sql);
        
        return ids.ToHashSet();
    }

    private static string ToSnakeCase(string input)
    {
        return string.Concat(input.Select((x, i) => i > 0 && char.IsUpper(x) 
            ? "_" + x.ToString() 
            : x.ToString())).ToLower();
    }
}

