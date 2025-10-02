using Microsoft.EntityFrameworkCore;
using Spisa.Domain.Common;
using Spisa.Domain.Entities;

namespace Spisa.Infrastructure.Persistence;

public class SpisaDbContext : DbContext
{
    public SpisaDbContext(DbContextOptions<SpisaDbContext> options) : base(options)
    {
    }

    // Users & Auth
    public DbSet<User> Users => Set<User>();

    // Lookup Tables
    public DbSet<Province> Provinces => Set<Province>();
    public DbSet<TaxCondition> TaxConditions => Set<TaxCondition>();
    public DbSet<OperationType> OperationTypes => Set<OperationType>();
    public DbSet<PaymentMethod> PaymentMethods => Set<PaymentMethod>();
    public DbSet<Transporter> Transporters => Set<Transporter>();

    // Master Data
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Article> Articles => Set<Article>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<ClientDiscount> ClientDiscounts => Set<ClientDiscount>();

    // Sales
    public DbSet<SalesOrder> SalesOrders => Set<SalesOrder>();
    public DbSet<SalesOrderItem> SalesOrderItems => Set<SalesOrderItem>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<DeliveryNote> DeliveryNotes => Set<DeliveryNote>();

    // Stock & Accounting
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<AccountMovement> AccountMovements => Set<AccountMovement>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Apply all entity configurations
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SpisaDbContext).Assembly);

        // Configure PostgreSQL naming convention (snake_case)
        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            // Table names to snake_case
            entity.SetTableName(ToSnakeCase(entity.GetTableName() ?? entity.ClrType.Name));

            // Column names to snake_case
            foreach (var property in entity.GetProperties())
            {
                property.SetColumnName(ToSnakeCase(property.Name));
            }

            // Foreign key names to snake_case
            foreach (var key in entity.GetForeignKeys())
            {
                key.SetConstraintName(ToSnakeCase(key.GetConstraintName() ?? ""));
            }
        }
    }

    private static string ToSnakeCase(string input)
    {
        if (string.IsNullOrEmpty(input)) return input;
        
        var result = new System.Text.StringBuilder();
        result.Append(char.ToLower(input[0]));

        for (int i = 1; i < input.Length; i++)
        {
            if (char.IsUpper(input[i]))
            {
                result.Append('_');
                result.Append(char.ToLower(input[i]));
            }
            else
            {
                result.Append(input[i]);
            }
        }

        return result.ToString();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        UpdateAuditFields();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void UpdateAuditFields()
    {
        var entries = ChangeTracker.Entries<BaseEntity>();

        foreach (var entry in entries)
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = DateTime.UtcNow;
                entry.Entity.UpdatedAt = DateTime.UtcNow;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = DateTime.UtcNow;
            }
        }
    }
}

