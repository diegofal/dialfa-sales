using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Spisa.Domain.Entities;

namespace Spisa.Infrastructure.Persistence.Configurations;

public class SalesOrderItemConfiguration : IEntityTypeConfiguration<SalesOrderItem>
{
    public void Configure(EntityTypeBuilder<SalesOrderItem> builder)
    {
        builder.HasKey(i => i.Id);

        builder.Property(i => i.UnitPrice)
            .HasPrecision(18, 4);

        builder.Property(i => i.DiscountPercent)
            .HasPrecision(5, 2);

        builder.Property(i => i.LineTotal)
            .HasPrecision(18, 2);

        builder.HasOne(i => i.Article)
            .WithMany(a => a.SalesOrderItems)
            .HasForeignKey(i => i.ArticleId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(i => new { i.SalesOrderId, i.ArticleId });
    }
}

