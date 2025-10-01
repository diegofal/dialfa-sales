using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Spectre.Console;
using Spisa.DataMigration.Mappers;
using System.Diagnostics;
using System.Text;

namespace Spisa.DataMigration.Services;

public class MigrationOrchestrator
{
    private readonly ILegacyDataReader _legacyReader;
    private readonly IModernDataWriter _modernWriter;
    private readonly IMigrationValidator _validator;
    private readonly IConfiguration _configuration;
    private readonly ILogger<MigrationOrchestrator> _logger;

    public MigrationOrchestrator(
        ILegacyDataReader legacyReader,
        IModernDataWriter modernWriter,
        IMigrationValidator validator,
        IConfiguration configuration,
        ILogger<MigrationOrchestrator> logger)
    {
        _legacyReader = legacyReader;
        _modernWriter = modernWriter;
        _validator = validator;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<MigrationResult> ExecuteMigration(ProgressContext ctx)
    {
        var result = new MigrationResult
        {
            StartTime = DateTime.UtcNow
        };

        try
        {
            // Step 1: Pre-migration validation
            var validationTask = ctx.AddTask("[yellow]Validating legacy data[/]");
            var validationResult = await _validator.ValidateLegacyDataAsync();
            validationTask.Value = 100;
            
            if (!validationResult.IsValid)
            {
                _logger.LogWarning("Legacy data validation found issues: {Issues}", 
                    string.Join(", ", validationResult.Issues));
                
                if (!_configuration.GetValue<bool>("Migration:ContinueOnError"))
                {
                    result.Success = false;
                    result.Errors.AddRange(validationResult.Issues);
                    return result;
                }
            }

            // Step 2: Test connections
            var connTask = ctx.AddTask("[yellow]Testing database connections[/]");
            await _legacyReader.TestConnectionAsync();
            await _modernWriter.TestConnectionAsync();
            connTask.Value = 100;

            // Step 3: Migrate lookup tables
            await MigrateLookupTables(ctx, result);

            // Step 4: Migrate categories
            await MigrateCategories(ctx, result);

            // Step 5: Migrate articles
            await MigrateArticles(ctx, result);

            // Step 6: Migrate clients
            await MigrateClients(ctx, result);

            // Step 7: Migrate sales orders
            await MigrateSalesOrders(ctx, result);

            // Step 8: Migrate invoices
            await MigrateInvoices(ctx, result);

            // Step 9: Migrate delivery notes
            await MigrateDeliveryNotes(ctx, result);

            // Step 10: Refresh materialized views
            var refreshTask = ctx.AddTask("[yellow]Refreshing materialized views[/]");
            await _modernWriter.ExecuteRawSqlAsync("REFRESH MATERIALIZED VIEW client_balances");
            await _modernWriter.ExecuteRawSqlAsync("REFRESH MATERIALIZED VIEW article_stock_levels");
            refreshTask.Value = 100;

            // Step 11: Post-migration validation
            var postValidTask = ctx.AddTask("[yellow]Validating migrated data[/]");
            var recordCountValidation = await _validator.ValidateRecordCountsAsync();
            var integrityValidation = await _validator.ValidateReferentialIntegrityAsync();
            postValidTask.Value = 100;

            if (!recordCountValidation.IsValid || !integrityValidation.IsValid)
            {
                result.Success = false;
                result.Errors.AddRange(recordCountValidation.Issues);
                result.Errors.AddRange(integrityValidation.Issues);
            }
            else
            {
                result.Success = result.EntityResults.All(e => e.Success);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Migration failed with exception");
            result.Success = false;
            result.Errors.Add($"Critical error: {ex.Message}");
        }
        finally
        {
            result.EndTime = DateTime.UtcNow;
        }

        return result;
    }

    private async Task MigrateLookupTables(ProgressContext ctx, MigrationResult result)
    {
        // Provinces already seeded, skip
        _logger.LogInformation("Lookup tables (provinces, tax_conditions, etc.) already seeded via seed.sql");
    }

    private async Task MigrateCategories(ProgressContext ctx, MigrationResult result)
    {
        var task = ctx.AddTask("[blue]Migrating categories[/]");
        var stopwatch = Stopwatch.StartNew();
        
        try
        {
            var legacyCategories = await _legacyReader.ReadDataAsync<LegacyCategoria>("Categorias");
            var totalCount = legacyCategories.Count();
            
            var modernCategories = legacyCategories.Select(CategoryMapper.Map).ToList();
            
            task.MaxValue = totalCount;
            var migrated = await _modernWriter.WriteDataAsync("categories", modernCategories);
            task.Value = migrated;
            
            await _modernWriter.ResetSequenceAsync("categories", "categories_id_seq");
            
            result.EntityResults.Add(new EntityMigrationResult
            {
                EntityName = "Categories",
                MigratedCount = migrated,
                Duration = stopwatch.Elapsed
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to migrate categories");
            result.EntityResults.Add(new EntityMigrationResult
            {
                EntityName = "Categories",
                FailedCount = 1,
                Errors = new List<string> { ex.Message }
            });
        }
    }

    private async Task MigrateArticles(ProgressContext ctx, MigrationResult result)
    {
        var task = ctx.AddTask("[blue]Migrating articles[/]");
        var stopwatch = Stopwatch.StartNew();
        
        try
        {
            var legacyArticles = await _legacyReader.ReadDataAsync<LegacyArticulo>("Articulos");
            var totalCount = legacyArticles.Count();
            
            var modernArticles = legacyArticles.Select(ArticleMapper.Map).ToList();
            
            task.MaxValue = totalCount;
            var migrated = await _modernWriter.WriteDataAsync("articles", modernArticles);
            task.Value = migrated;
            
            await _modernWriter.ResetSequenceAsync("articles", "articles_id_seq");
            
            result.EntityResults.Add(new EntityMigrationResult
            {
                EntityName = "Articles",
                MigratedCount = migrated,
                Duration = stopwatch.Elapsed
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to migrate articles");
            result.EntityResults.Add(new EntityMigrationResult
            {
                EntityName = "Articles",
                FailedCount = 1,
                Errors = new List<string> { ex.Message }
            });
        }
    }

    private async Task MigrateClients(ProgressContext ctx, MigrationResult result)
    {
        var task = ctx.AddTask("[blue]Migrating clients[/]");
        var stopwatch = Stopwatch.StartNew();
        
        try
        {
            var legacyClients = await _legacyReader.ReadDataAsync<LegacyCliente>("Clientes");
            var totalCount = legacyClients.Count();
            
            var modernClients = legacyClients.Select(ClientMapper.Map).ToList();
            
            task.MaxValue = totalCount;
            var migrated = await _modernWriter.WriteDataAsync("clients", modernClients);
            task.Value = migrated;
            
            await _modernWriter.ResetSequenceAsync("clients", "clients_id_seq");
            
            // Migrate client discounts
            var legacyDiscounts = await _legacyReader.ReadDataAsync<LegacyDescuento>("Descuentos");
            var modernDiscounts = legacyDiscounts.Select(ClientDiscountMapper.Map).ToList();
            await _modernWriter.WriteDataAsync("client_discounts", modernDiscounts);
            
            result.EntityResults.Add(new EntityMigrationResult
            {
                EntityName = "Clients",
                MigratedCount = migrated,
                Duration = stopwatch.Elapsed
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to migrate clients");
            result.EntityResults.Add(new EntityMigrationResult
            {
                EntityName = "Clients",
                FailedCount = 1,
                Errors = new List<string> { ex.Message }
            });
        }
    }

    private async Task MigrateSalesOrders(ProgressContext ctx, MigrationResult result)
    {
        var task = ctx.AddTask("[blue]Migrating sales orders[/]");
        var stopwatch = Stopwatch.StartNew();
        
        try
        {
            var legacyOrders = await _legacyReader.ReadDataAsync<LegacyNotaPedido>("NotaPedidos");
            var totalCount = legacyOrders.Count();
            
            var modernOrders = legacyOrders.Select(SalesOrderMapper.Map).ToList();
            
            task.MaxValue = totalCount;
            var migrated = await _modernWriter.WriteDataAsync("sales_orders", modernOrders);
            task.Value = migrated;
            
            await _modernWriter.ResetSequenceAsync("sales_orders", "sales_orders_id_seq");
            
            // Migrate order items
            var legacyItems = await _legacyReader.ReadDataAsync<LegacyNotaPedidoItem>("NotaPedido_Items");
            var modernItems = legacyItems.Select(SalesOrderItemMapper.Map).ToList();
            await _modernWriter.WriteDataAsync("sales_order_items", modernItems);
            
            result.EntityResults.Add(new EntityMigrationResult
            {
                EntityName = "SalesOrders",
                MigratedCount = migrated,
                Duration = stopwatch.Elapsed
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to migrate sales orders");
            result.EntityResults.Add(new EntityMigrationResult
            {
                EntityName = "SalesOrders",
                FailedCount = 1,
                Errors = new List<string> { ex.Message }
            });
        }
    }

    private async Task MigrateInvoices(ProgressContext ctx, MigrationResult result)
    {
        var task = ctx.AddTask("[blue]Migrating invoices[/]");
        var stopwatch = Stopwatch.StartNew();
        
        try
        {
            var legacyInvoices = await _legacyReader.ReadDataAsync<LegacyFactura>("Facturas");
            var totalCount = legacyInvoices.Count();
            
            var modernInvoices = legacyInvoices.Select(InvoiceMapper.Map).ToList();
            
            task.MaxValue = totalCount;
            var migrated = await _modernWriter.WriteDataAsync("invoices", modernInvoices);
            task.Value = migrated;
            
            await _modernWriter.ResetSequenceAsync("invoices", "invoices_id_seq");
            
            result.EntityResults.Add(new EntityMigrationResult
            {
                EntityName = "Invoices",
                MigratedCount = migrated,
                Duration = stopwatch.Elapsed
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to migrate invoices");
            result.EntityResults.Add(new EntityMigrationResult
            {
                EntityName = "Invoices",
                FailedCount = 1,
                Errors = new List<string> { ex.Message }
            });
        }
    }

    private async Task MigrateDeliveryNotes(ProgressContext ctx, MigrationResult result)
    {
        var task = ctx.AddTask("[blue]Migrating delivery notes[/]");
        var stopwatch = Stopwatch.StartNew();
        
        try
        {
            var legacyRemitos = await _legacyReader.ReadDataAsync<LegacyRemito>("Remitos");
            var totalCount = legacyRemitos.Count();
            
            var modernDeliveryNotes = legacyRemitos.Select(DeliveryNoteMapper.Map).ToList();
            
            task.MaxValue = totalCount;
            var migrated = await _modernWriter.WriteDataAsync("delivery_notes", modernDeliveryNotes);
            task.Value = migrated;
            
            await _modernWriter.ResetSequenceAsync("delivery_notes", "delivery_notes_id_seq");
            
            result.EntityResults.Add(new EntityMigrationResult
            {
                EntityName = "DeliveryNotes",
                MigratedCount = migrated,
                Duration = stopwatch.Elapsed
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to migrate delivery notes");
            result.EntityResults.Add(new EntityMigrationResult
            {
                EntityName = "DeliveryNotes",
                FailedCount = 1,
                Errors = new List<string> { ex.Message }
            });
        }
    }

    public async Task<string> GenerateReport(MigrationResult result)
    {
        var reportPath = _configuration["Migration:ReportOutputPath"] ?? "./migration-reports";
        Directory.CreateDirectory(reportPath);
        
        var fileName = $"migration-report-{DateTime.Now:yyyyMMdd-HHmmss}.txt";
        var fullPath = Path.Combine(reportPath, fileName);
        
        var report = new StringBuilder();
        report.AppendLine("═══════════════════════════════════════════════════════════════");
        report.AppendLine("                SPISA DATA MIGRATION REPORT                    ");
        report.AppendLine("═══════════════════════════════════════════════════════════════");
        report.AppendLine();
        report.AppendLine($"Start Time:  {result.StartTime:yyyy-MM-dd HH:mm:ss}");
        report.AppendLine($"End Time:    {result.EndTime:yyyy-MM-dd HH:mm:ss}");
        report.AppendLine($"Duration:    {result.Duration}");
        report.AppendLine($"Status:      {(result.Success ? "SUCCESS" : "FAILED")}");
        report.AppendLine();
        report.AppendLine("Entity Migration Results:");
        report.AppendLine("───────────────────────────────────────────────────────────────");
        
        foreach (var entity in result.EntityResults)
        {
            report.AppendLine($"{entity.EntityName,-20} Migrated: {entity.MigratedCount,6}  Failed: {entity.FailedCount,6}  Duration: {entity.Duration}");
        }
        
        if (result.Errors.Any())
        {
            report.AppendLine();
            report.AppendLine("Errors:");
            report.AppendLine("───────────────────────────────────────────────────────────────");
            foreach (var error in result.Errors)
            {
                report.AppendLine($"• {error}");
            }
        }
        
        report.AppendLine();
        report.AppendLine("═══════════════════════════════════════════════════════════════");
        
        await File.WriteAllTextAsync(fullPath, report.ToString());
        
        return fullPath;
    }
}

