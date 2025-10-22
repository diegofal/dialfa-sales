using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Spisa.Domain.Entities;

namespace Spisa.Infrastructure.Persistence.Configurations;

public class ClientConfiguration : IEntityTypeConfiguration<Client>
{
    public void Configure(EntityTypeBuilder<Client> builder)
    {
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Code)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(c => c.BusinessName)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(c => c.Cuit)
            .HasMaxLength(11);

        builder.Property(c => c.Address)
            .HasMaxLength(200);

        builder.Property(c => c.City)
            .HasMaxLength(100);

        builder.Property(c => c.PostalCode)
            .HasMaxLength(10);

        builder.Property(c => c.Phone)
            .HasMaxLength(50);

        builder.Property(c => c.Email)
            .HasMaxLength(100);

        builder.Property(c => c.SellerId)
            .HasColumnName("seller_id");

        builder.Property(c => c.CreditLimit)
            .HasPrecision(18, 2);

        builder.Property(c => c.CurrentBalance)
            .HasPrecision(18, 2);

        // Foreign keys
        builder.HasOne(c => c.TaxCondition)
            .WithMany(t => t.Clients)
            .HasForeignKey(c => c.TaxConditionId)
            .IsRequired()
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(c => c.Province)
            .WithMany(p => p.Clients)
            .HasForeignKey(c => c.ProvinceId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(c => c.OperationType)
            .WithMany(o => o.Clients)
            .HasForeignKey(c => c.OperationTypeId)
            .IsRequired()
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(c => c.Transporter)
            .WithMany(t => t.Clients)
            .HasForeignKey(c => c.TransporterId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(c => c.Code)
            .IsUnique()
            .HasFilter("deleted_at IS NULL");

        builder.HasIndex(c => c.Cuit)
            .HasFilter("deleted_at IS NULL");

        builder.HasQueryFilter(c => c.DeletedAt == null);
    }
}






