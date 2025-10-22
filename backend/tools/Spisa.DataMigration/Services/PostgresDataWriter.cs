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
        
        // Set longer command timeout for large inserts (10 minutes)
        var commandTimeout = 600;
        
        try
        {
            foreach (var item in data)
            {
                // Include ALL properties including Id to preserve legacy IDs
                var properties = typeof(T).GetProperties();
                
                var columns = string.Join(", ", properties.Select(p => ToSnakeCase(p.Name)));
                
                // Note: EF Core stores enums as strings, not PostgreSQL ENUMs
                var parameters = string.Join(", ", properties.Select(p => "@" + p.Name));
                
                var sql = $"INSERT INTO {tableName} ({columns}) VALUES ({parameters})";
                
                await connection.ExecuteAsync(sql, item, transaction, commandTimeout: commandTimeout);
                count++;
                
                // Log progress every 100 records
                if (count % 100 == 0)
                {
                    _logger.LogDebug("Inserted {Count} records into {Table}", count, tableName);
                }
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
        
        await connection.ExecuteAsync($"TRUNCATE TABLE {tableName} RESTART IDENTITY CASCADE");
        _logger.LogInformation("Truncated table {Table}", tableName);
    }

    public async Task TruncateAllTablesAsync()
    {
        if (_dryRun)
        {
            _logger.LogInformation("[DRY RUN] Would truncate all tables");
            return;
        }

        using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync();
        
        try
        {
            // Truncate all tables in reverse dependency order (children first)
            var sql = @"
                TRUNCATE TABLE 
                    delivery_notes,
                    invoices,
                    sales_order_items,
                    sales_orders,
                    client_discounts,
                    clients,
                    articles,
                    categories,
                    transporters,
                    payment_methods,
                    operation_types,
                    tax_conditions,
                    provinces
                RESTART IDENTITY CASCADE";
            
            // Set long timeout for TRUNCATE (10 minutes)
            await connection.ExecuteAsync(sql, commandTimeout: 600);
            _logger.LogInformation("Truncated all tables");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error truncating all tables");
            throw;
        }
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

