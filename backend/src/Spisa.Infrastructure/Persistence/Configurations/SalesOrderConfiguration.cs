using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Spisa.Domain.Entities;

namespace Spisa.Infrastructure.Persistence.Configurations;

public class SalesOrderConfiguration : IEntityTypeConfiguration<SalesOrder>
{
    public void Configure(EntityTypeBuilder<SalesOrder> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.OrderNumber)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(s => s.TotalAmount)
            .HasPrecision(18, 2);

        builder.Property(s => s.Status)
            .IsRequired()
            .HasConversion<string>();

        builder.HasOne(s => s.Client)
            .WithMany(c => c.SalesOrders)
            .HasForeignKey(s => s.ClientId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(s => s.Items)
            .WithOne(i => i.SalesOrder)
            .HasForeignKey(i => i.SalesOrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => s.OrderNumber)
            .IsUnique();

        builder.HasIndex(s => s.ClientId);

        builder.HasQueryFilter(s => s.DeletedAt == null);
    }
}






