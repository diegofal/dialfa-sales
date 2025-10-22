using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Spisa.Domain.Entities;

namespace Spisa.Infrastructure.Persistence.Configurations;

public class ArticleConfiguration : IEntityTypeConfiguration<Article>
{
    public void Configure(EntityTypeBuilder<Article> builder)
    {
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Code)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(a => a.Description)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(a => a.UnitPrice)
            .HasPrecision(18, 4);

        builder.Property(a => a.CostPrice)
            .HasPrecision(18, 4);

        builder.Property(a => a.Stock)
            .HasColumnName("stock")
            .HasPrecision(12, 3);

        builder.Property(a => a.MinimumStock)
            .HasColumnName("minimum_stock")
            .HasPrecision(12, 3);

        builder.Property(a => a.DisplayOrder)
            .HasColumnName("display_order")
            .HasMaxLength(20);

        builder.Property(a => a.IsDiscontinued)
            .HasColumnName("is_discontinued")
            .HasDefaultValue(false);

        builder.Property(a => a.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true);

        builder.Property(a => a.Type)
            .HasColumnName("type")
            .HasMaxLength(500);

        builder.Property(a => a.Series)
            .HasColumnName("series");

        builder.Property(a => a.Thickness)
            .HasColumnName("thickness")
            .HasMaxLength(100);

        builder.Property(a => a.Size)
            .HasColumnName("size")
            .HasMaxLength(100);

        builder.Property(a => a.SupplierId)
            .HasColumnName("supplier_id");

        builder.Property(a => a.WeightKg)
            .HasColumnName("weight_kg")
            .HasPrecision(18, 2);

        builder.Property(a => a.HistoricalPrice1)
            .HasColumnName("historical_price1")
            .HasPrecision(18, 2);

        builder.Property(a => a.Location)
            .HasMaxLength(200);

        builder.Property(a => a.Notes)
            .HasColumnType("text");

        builder.HasOne(a => a.Category)
            .WithMany(c => c.Articles)
            .HasForeignKey(a => a.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(a => a.Code)
            .HasFilter("deleted_at IS NULL");

        builder.HasIndex(a => a.CategoryId)
            .HasFilter("deleted_at IS NULL");

        builder.HasQueryFilter(a => a.DeletedAt == null);
    }
}






