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

            // Step 3: Clear ALL tables in PostgreSQL (once, at the beginning)
            var clearTask = ctx.AddTask("[red]Clearing target database[/]");
            await _modernWriter.TruncateAllTablesAsync();
            clearTask.Value = 100;

            // Step 4: Migrate lookup tables
            await MigrateLookupTables(ctx, result);

            // Step 5: Migrate categories
            await MigrateCategories(ctx, result);

            // Step 6: Migrate articles
            await MigrateArticles(ctx, result);

            // Step 7: Migrate clients
            await MigrateClients(ctx, result);

            // Step 8: Migrate sales orders
            await MigrateSalesOrders(ctx, result);

            // Step 9: Migrate invoices
            await MigrateInvoices(ctx, result);

            // Step 10: Migrate delivery notes
            await MigrateDeliveryNotes(ctx, result);

            // Step 11: Seed admin user
            await SeedAdminUser(ctx, result);

            // Note: Materialized views not created by EF migrations, skipping refresh

            // Step 12: Post-migration validation
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
        var stopwatch = Stopwatch.StartNew();
        
        try
        {
            // Migrate Provinces
            var provincesTask = ctx.AddTask("[blue]Migrating provinces[/]");
            var legacyProvinces = await _legacyReader.ReadDataAsync<LegacyProvincia>("Provincias");
            var modernProvinces = legacyProvinces.Select(ProvinceMapper.Map).ToList();
            provincesTask.MaxValue = modernProvinces.Count;
            var provinceMigrated = await _modernWriter.WriteDataAsync("provinces", modernProvinces);
            provincesTask.Value = provinceMigrated;
            await _modernWriter.ResetSequenceAsync("provinces", "provinces_id_seq");
            
            // Migrate Tax Conditions
            var taxTask = ctx.AddTask("[blue]Migrating tax conditions[/]");
            var legacyTaxConditions = await _legacyReader.ReadDataAsync<LegacyCondicionIVA>("CondicionesIVA");
            var modernTaxConditions = legacyTaxConditions.Select(TaxConditionMapper.Map).ToList();
            taxTask.MaxValue = modernTaxConditions.Count;
            var taxMigrated = await _modernWriter.WriteDataAsync("tax_conditions", modernTaxConditions);
            taxTask.Value = taxMigrated;
            await _modernWriter.ResetSequenceAsync("tax_conditions", "tax_conditions_id_seq");
            
            // Migrate Operation Types
            var operationTask = ctx.AddTask("[blue]Migrating operation types[/]");
            var legacyOperations = await _legacyReader.ReadDataAsync<LegacyOperatoria>("Operatorias");
            var modernOperations = legacyOperations.Select(OperationTypeMapper.Map).ToList();
            operationTask.MaxValue = modernOperations.Count;
            var operationMigrated = await _modernWriter.WriteDataAsync("operation_types", modernOperations);
            operationTask.Value = operationMigrated;
            await _modernWriter.ResetSequenceAsync("operation_types", "operation_types_id_seq");
            
            // Migrate Payment Methods
            var paymentTask = ctx.AddTask("[blue]Migrating payment methods[/]");
            var legacyPaymentMethods = await _legacyReader.ReadDataAsync<LegacyFormaDePago>("FormasDePago");
            var modernPaymentMethods = legacyPaymentMethods.Select(PaymentMethodMapper.Map).ToList();
            paymentTask.MaxValue = modernPaymentMethods.Count;
            var paymentMigrated = await _modernWriter.WriteDataAsync("payment_methods", modernPaymentMethods);
            paymentTask.Value = paymentMigrated;
            await _modernWriter.ResetSequenceAsync("payment_methods", "payment_methods_id_seq");
            
            // Migrate Transporters
            var transporterTask = ctx.AddTask("[blue]Migrating transporters[/]");
            var legacyTransporters = await _legacyReader.ReadDataAsync<LegacyTransportista>("Transportistas");
            var modernTransporters = legacyTransporters.Select(TransporterMapper.Map).ToList();
            transporterTask.MaxValue = modernTransporters.Count;
            var transporterMigrated = await _modernWriter.WriteDataAsync("transporters", modernTransporters);
            transporterTask.Value = transporterMigrated;
            await _modernWriter.ResetSequenceAsync("transporters", "transporters_id_seq");
            
            result.EntityResults.Add(new EntityMigrationResult
            {
                EntityName = "Lookup Tables",
                MigratedCount = provinceMigrated + taxMigrated + operationMigrated + paymentMigrated + transporterMigrated,
                Duration = stopwatch.Elapsed
            });
            
            _logger.LogInformation("Migrated all lookup tables: {Provinces} provinces, {Tax} tax conditions, {Operations} operations, {Payments} payment methods, {Transporters} transporters",
                provinceMigrated, taxMigrated, operationMigrated, paymentMigrated, transporterMigrated);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to migrate lookup tables");
            result.EntityResults.Add(new EntityMigrationResult
            {
                EntityName = "Lookup Tables",
                FailedCount = 1,
                Errors = new List<string> { ex.Message }
            });
        }
    }

    private async Task MigrateCategories(ProgressContext ctx, MigrationResult result)
    {
        var task = ctx.AddTask("[blue]Migrating categories[/]");
        var stopwatch = Stopwatch.StartNew();
        
        try
        {
            // Reset category code cache to ensure unique codes
            CategoryMapper.ResetCodeCache();
            
            // Check if categories already exist (manually migrated)
            var existingCount = await _modernWriter.GetRecordCountAsync("categories");
            if (existingCount > 0)
            {
                _logger.LogInformation("Categories already exist ({Count} records), skipping migration", existingCount);
                task.Value = 100;
                result.EntityResults.Add(new EntityMigrationResult
                {
                    EntityName = "Categories",
                    MigratedCount = existingCount,
                    Duration = stopwatch.Elapsed
                });
                return;
            }
            
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
            
            // Migrate client discounts (filter orphaned records by client AND category)
            var legacyDiscounts = await _legacyReader.ReadDataAsync<LegacyDescuento>("Descuentos");
            var legacyCategories = await _legacyReader.ReadDataAsync<LegacyCategoria>("Categorias");
            
            var validClientIds = legacyClients.Select(c => c.IdCliente).ToHashSet();
            var validCategoryIds = legacyCategories.Select(c => c.IdCategoria).ToHashSet();
            
            var validDiscounts = legacyDiscounts
                .Where(d => validClientIds.Contains(d.IdCliente) && validCategoryIds.Contains(d.IdCategoria))
                .ToList();
            
            var filteredCount = legacyDiscounts.Count() - validDiscounts.Count;
            if (filteredCount > 0)
            {
                _logger.LogWarning("Filtered {Orphaned} orphaned client discounts (invalid client/category FKs)", filteredCount);
            }
            
            var modernDiscounts = validDiscounts.Select(ClientDiscountMapper.Map).ToList();
            if (modernDiscounts.Any())
            {
                await _modernWriter.WriteDataAsync("client_discounts", modernDiscounts);
            }
            
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
            var legacyClients = await _legacyReader.ReadDataAsync<LegacyCliente>("Clientes");
            
            // Filter orders with invalid client references
            var validClientIds = legacyClients.Select(c => c.IdCliente).ToHashSet();
            var validOrders = legacyOrders.Where(o => validClientIds.Contains(o.IdCliente)).ToList();
            
            var filteredOrdersCount = legacyOrders.Count() - validOrders.Count;
            if (filteredOrdersCount > 0)
            {
                _logger.LogWarning("Filtered {Orphaned} sales orders with invalid client FKs", filteredOrdersCount);
            }
            
            var modernOrders = validOrders.Select(SalesOrderMapper.Map).ToList();
            
            task.MaxValue = validOrders.Count;
            var migrated = await _modernWriter.WriteDataAsync("sales_orders", modernOrders);
            task.Value = migrated;
            
            await _modernWriter.ResetSequenceAsync("sales_orders", "sales_orders_id_seq");
            
            // Migrate order items (filter by valid orders and articles)
            var legacyItems = await _legacyReader.ReadDataAsync<LegacyNotaPedidoItem>("NotaPedido_Items");
            var legacyArticles = await _legacyReader.ReadDataAsync<LegacyArticulo>("Articulos");
            
            var validOrderIds = validOrders.Select(o => o.IdNotaPedido).ToHashSet();
            var validArticleIds = legacyArticles.Select(a => a.idArticulo).ToHashSet();
            
            var validItems = legacyItems
                .Where(i => validOrderIds.Contains(i.IdNotaPedido) && validArticleIds.Contains(i.IdArticulo))
                .ToList();
            
            var filteredItemsCount = legacyItems.Count() - validItems.Count;
            if (filteredItemsCount > 0)
            {
                _logger.LogWarning("Filtered {Orphaned} order items with invalid FK references", filteredItemsCount);
            }
            
            var modernItems = validItems.Select(SalesOrderItemMapper.Map).ToList();
            if (modernItems.Any())
            {
                await _modernWriter.WriteDataAsync("sales_order_items", modernItems);
            }
            
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
            var legacyOrders = await _legacyReader.ReadDataAsync<LegacyNotaPedido>("NotaPedidos");
            
            // Filter invoices with invalid sales_order references
            var validOrderIds = legacyOrders.Select(o => o.IdNotaPedido).ToHashSet();
            var validInvoices = legacyInvoices.Where(inv => validOrderIds.Contains(inv.IdNotaPedido)).ToList();
            
            var filteredCount = legacyInvoices.Count() - validInvoices.Count;
            if (filteredCount > 0)
            {
                _logger.LogWarning("Filtered {Orphaned} invoices with invalid sales_order FKs", filteredCount);
            }
            
            var modernInvoices = validInvoices.Select(InvoiceMapper.Map).ToList();
            
            task.MaxValue = validInvoices.Count;
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
            var legacyOrders = await _legacyReader.ReadDataAsync<LegacyNotaPedido>("NotaPedidos");
            
            // Get valid transporter IDs from PostgreSQL (already migrated)
            var validTransporterIds = await _modernWriter.GetValidIdsAsync("transporters");
            
            // Filter delivery notes with invalid sales_order references
            var validOrderIds = legacyOrders.Select(o => o.IdNotaPedido).ToHashSet();
            var validRemitos = legacyRemitos.Where(r => validOrderIds.Contains(r.IdNotaPedido)).ToList();
            
            var filteredCount = legacyRemitos.Count() - validRemitos.Count;
            if (filteredCount > 0)
            {
                _logger.LogWarning("Filtered {Orphaned} delivery notes with invalid sales_order FKs", filteredCount);
            }
            
            // Map and fix invalid transporter FKs
            var modernDeliveryNotes = validRemitos.Select(r =>
            {
                var note = DeliveryNoteMapper.Map(r);
                // Set transporter to NULL if it doesn't exist
                if (note.TransporterId.HasValue && !validTransporterIds.Contains(note.TransporterId.Value))
                {
                    note.TransporterId = null;
                }
                return note;
            }).ToList();
            
            var invalidTransporterCount = validRemitos.Count(r => r.IdTransportista.HasValue && !validTransporterIds.Contains(r.IdTransportista.Value));
            if (invalidTransporterCount > 0)
            {
                _logger.LogWarning("Set {Count} delivery notes with invalid transporter FKs to NULL", invalidTransporterCount);
            }
            
            task.MaxValue = validRemitos.Count;
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

    private async Task SeedAdminUser(ProgressContext ctx, MigrationResult result)
    {
        var task = ctx.AddTask("[blue]Seeding admin user[/]");
        var stopwatch = Stopwatch.StartNew();
        
        try
        {
            // Check if admin user already exists (users table has no deleted_at column)
            var existingCount = await _modernWriter.GetRecordCountAsync("users", checkDeletedAt: false);
            if (existingCount > 0)
            {
                _logger.LogInformation("Users already exist ({Count} records), skipping admin user seeding", existingCount);
                task.Value = 100;
                return;
            }

            // Hash password using BCrypt
            var passwordHash = BCrypt.Net.BCrypt.HashPassword("admin123");
            
            var adminUser = new
            {
                Username = "admin",
                Email = "admin@spisa.local",
                PasswordHash = passwordHash,
                FullName = "System Administrator",
                Role = "Admin",
                IsActive = true,
                LastLoginAt = (DateTime?)null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            var users = new[] { adminUser };
            var migrated = await _modernWriter.WriteDataAsync("users", users);
            task.Value = 100;
            
            await _modernWriter.ResetSequenceAsync("users", "users_id_seq");
            
            _logger.LogInformation("Seeded admin user: {Username}", adminUser.Username);
            
            result.EntityResults.Add(new EntityMigrationResult
            {
                EntityName = "Users (Seeded)",
                MigratedCount = migrated,
                Duration = stopwatch.Elapsed
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to seed admin user");
            result.EntityResults.Add(new EntityMigrationResult
            {
                EntityName = "Users (Seeded)",
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

