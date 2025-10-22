using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Spisa.Domain.Entities;

namespace Spisa.Infrastructure.Persistence.Configurations;

public class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> builder)
    {
        builder.HasKey(i => i.Id);

        builder.Property(i => i.InvoiceNumber)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(i => i.InvoiceDate)
            .IsRequired();

        builder.Property(i => i.NetAmount)
            .HasColumnName("net_amount")
            .HasPrecision(18, 4);

        builder.Property(i => i.TaxAmount)
            .HasColumnName("tax_amount")
            .HasPrecision(18, 4);

        builder.Property(i => i.TotalAmount)
            .HasColumnName("total_amount")
            .HasPrecision(18, 4);

        builder.Property(i => i.UsdExchangeRate)
            .HasColumnName("usd_exchange_rate")
            .HasPrecision(10, 4);

        builder.Property(i => i.IsPrinted)
            .HasColumnName("is_printed")
            .HasDefaultValue(false);

        builder.Property(i => i.PrintedAt)
            .HasColumnName("printed_at");

        builder.Property(i => i.IsCancelled)
            .HasColumnName("is_cancelled")
            .HasDefaultValue(false);

        builder.Property(i => i.CancelledAt)
            .HasColumnName("cancelled_at");

        builder.Property(i => i.CancellationReason)
            .HasColumnName("cancellation_reason");

        builder.Property(i => i.IsCreditNote)
            .HasColumnName("is_credit_note")
            .HasDefaultValue(false);

        builder.Property(i => i.IsQuotation)
            .HasColumnName("is_quotation")
            .HasDefaultValue(false);

        builder.Property(i => i.Notes)
            .HasColumnType("text");

        // Foreign keys
        builder.HasOne(i => i.SalesOrder)
            .WithMany(s => s.Invoices)
            .HasForeignKey(i => i.SalesOrderId)
            .OnDelete(DeleteBehavior.Restrict);

        // Indexes
        // NOTE: IsUnique() temporarily removed to allow migration of legacy duplicate invoice numbers
        builder.HasIndex(i => i.InvoiceNumber)
            .HasFilter("deleted_at IS NULL");

        builder.HasIndex(i => i.SalesOrderId)
            .HasFilter("deleted_at IS NULL");

        builder.HasIndex(i => i.InvoiceDate)
            .HasFilter("deleted_at IS NULL");

        builder.HasQueryFilter(i => i.DeletedAt == null);
    }
}

