using Microsoft.Extensions.Logging;
using Npgsql;
using System.Data.SqlClient;
using Dapper;

namespace Spisa.DataMigration.Services;

public class MigrationValidator : IMigrationValidator
{
    private readonly ILegacyDataReader _legacyReader;
    private readonly string _sqlServerConnection;
    private readonly string _postgresConnection;
    private readonly ILogger<MigrationValidator> _logger;

    public MigrationValidator(
        ILegacyDataReader legacyReader,
        Microsoft.Extensions.Configuration.IConfiguration configuration,
        ILogger<MigrationValidator> logger)
    {
        _legacyReader = legacyReader;
        _sqlServerConnection = configuration["ConnectionStrings:SqlServer"]!;
        _postgresConnection = configuration["ConnectionStrings:PostgreSQL"]!;
        _logger = logger;
    }

    public async Task<ValidationResult> ValidateLegacyDataAsync()
    {
        var result = new ValidationResult { IsValid = true };
        
        using var connection = new SqlConnection(_sqlServerConnection);
        await connection.OpenAsync();

        // Check for orphaned records
        var orphanedArticles = await connection.ExecuteScalarAsync<int>(@"
            SELECT COUNT(*) FROM Articulos a 
            LEFT JOIN Categorias c ON a.IdCategoria = c.IdCategoria 
            WHERE c.IdCategoria IS NULL");
        
        if (orphanedArticles > 0)
        {
            result.Issues.Add($"Found {orphanedArticles} articles without valid category");
        }

        var orphanedClients = await connection.ExecuteScalarAsync<int>(@"
            SELECT COUNT(*) FROM Clientes cl 
            LEFT JOIN Provincias p ON cl.IdProvincia = p.IdProvincia 
            WHERE p.IdProvincia IS NULL");
        
        if (orphanedClients > 0)
        {
            result.Issues.Add($"Found {orphanedClients} clients without valid province");
        }

        // Check for invalid CUITs
        var invalidCuits = await connection.ExecuteScalarAsync<int>(@"
            SELECT COUNT(*) FROM Clientes 
            WHERE LEN(CUIT) != 11 OR CUIT LIKE '%[^0-9]%'");
        
        if (invalidCuits > 0)
        {
            result.Issues.Add($"Found {invalidCuits} clients with invalid CUIT format");
        }

        // Check for negative stock
        var negativeStock = await connection.ExecuteScalarAsync<int>(@"
            SELECT COUNT(*) FROM Articulos WHERE cantidad < 0");
        
        if (negativeStock > 0)
        {
            result.Issues.Add($"Found {negativeStock} articles with negative stock");
        }

        result.IsValid = result.Issues.Count == 0;
        
        if (!result.IsValid)
        {
            _logger.LogWarning("Legacy data validation found {Count} issues", result.Issues.Count);
        }
        
        return result;
    }

    public async Task<ValidationResult> ValidateMigratedDataAsync()
    {
        var result = new ValidationResult { IsValid = true };
        
        using var connection = new NpgsqlConnection(_postgresConnection);
        await connection.OpenAsync();

        // Validate CUIT format
        var invalidCuits = await connection.ExecuteScalarAsync<int>(@"
            SELECT COUNT(*) FROM clients 
            WHERE cuit !~ '^\d{11}$' AND deleted_at IS NULL");
        
        if (invalidCuits > 0)
        {
            result.Issues.Add($"Found {invalidCuits} clients with invalid CUIT in PostgreSQL");
            result.IsValid = false;
        }

        // Check for negative prices
        var negativePrices = await connection.ExecuteScalarAsync<int>(@"
            SELECT COUNT(*) FROM articles 
            WHERE unit_price < 0 AND deleted_at IS NULL");
        
        if (negativePrices > 0)
        {
            result.Issues.Add($"Found {negativePrices} articles with negative prices");
            result.IsValid = false;
        }

        return result;
    }

    public async Task<ValidationResult> ValidateReferentialIntegrityAsync()
    {
        var result = new ValidationResult { IsValid = true };
        
        using var connection = new NpgsqlConnection(_postgresConnection);
        await connection.OpenAsync();

        // Check articles → categories
        var orphanedArticles = await connection.ExecuteScalarAsync<int>(@"
            SELECT COUNT(*) FROM articles a 
            LEFT JOIN categories c ON a.category_id = c.id 
            WHERE c.id IS NULL AND a.deleted_at IS NULL");
        
        if (orphanedArticles > 0)
        {
            result.Issues.Add($"Found {orphanedArticles} orphaned articles");
            result.IsValid = false;
        }

        // Check clients → provinces
        var orphanedClients = await connection.ExecuteScalarAsync<int>(@"
            SELECT COUNT(*) FROM clients cl 
            LEFT JOIN provinces p ON cl.province_id = p.id 
            WHERE p.id IS NULL AND cl.deleted_at IS NULL");
        
        if (orphanedClients > 0)
        {
            result.Issues.Add($"Found {orphanedClients} orphaned clients");
            result.IsValid = false;
        }

        // Check sales_orders → clients
        var orphanedOrders = await connection.ExecuteScalarAsync<int>(@"
            SELECT COUNT(*) FROM sales_orders so 
            LEFT JOIN clients c ON so.client_id = c.id 
            WHERE c.id IS NULL AND so.deleted_at IS NULL");
        
        if (orphanedOrders > 0)
        {
            result.Issues.Add($"Found {orphanedOrders} orphaned sales orders");
            result.IsValid = false;
        }

        return result;
    }

    public async Task<ValidationResult> ValidateRecordCountsAsync()
    {
        var result = new ValidationResult { IsValid = true };
        
        var comparisons = new Dictionary<string, (string sqlTable, string pgTable)>
        {
            ["Categories"] = ("Categorias", "categories"),
            ["Articles"] = ("Articulos", "articles"),
            ["Clients"] = ("Clientes", "clients"),
            ["SalesOrders"] = ("NotaPedidos", "sales_orders"),
            ["Invoices"] = ("Facturas", "invoices")
        };

        using var sqlConnection = new SqlConnection(_sqlServerConnection);
        using var pgConnection = new NpgsqlConnection(_postgresConnection);
        
        await sqlConnection.OpenAsync();
        await pgConnection.OpenAsync();

        foreach (var (entity, tables) in comparisons)
        {
            var sqlCount = await sqlConnection.ExecuteScalarAsync<int>(
                $"SELECT COUNT(*) FROM {tables.sqlTable}");
            
            var pgCount = await pgConnection.ExecuteScalarAsync<int>(
                $"SELECT COUNT(*) FROM {tables.pgTable} WHERE deleted_at IS NULL");

            if (sqlCount != pgCount)
            {
                result.Issues.Add($"{entity}: SQL Server={sqlCount}, PostgreSQL={pgCount} (mismatch!)");
                result.IsValid = false;
            }
            else
            {
                _logger.LogInformation("{Entity}: {Count} records match", entity, sqlCount);
            }
        }

        return result;
    }
}

