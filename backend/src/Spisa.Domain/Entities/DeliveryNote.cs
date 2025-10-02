using Spisa.Domain.Common;

namespace Spisa.Domain.Entities;

public class DeliveryNote : BaseEntity
{
    public string DeliveryNumber { get; set; } = string.Empty;
    public long SalesOrderId { get; set; }
    public DateTime DeliveryDate { get; set; }
    public int? TransporterId { get; set; }
    public decimal? WeightKg { get; set; }
    public int? PackagesCount { get; set; }
    public decimal? DeclaredValue { get; set; }
    public string? Notes { get; set; }

    // Navigation properties
    public SalesOrder SalesOrder { get; set; } = null!;
    public Transporter? Transporter { get; set; }
}

