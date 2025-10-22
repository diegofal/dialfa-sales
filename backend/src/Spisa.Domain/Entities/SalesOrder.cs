using Spisa.Domain.Common;

namespace Spisa.Domain.Entities;

public class SalesOrder : BaseEntity
{
    public long ClientId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public DateTime OrderDate { get; set; }
    public DateTime? DeliveryDate { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.PENDING;
    public decimal SpecialDiscountPercent { get; set; } = 0;
    public decimal Total { get; set; }
    public string? Notes { get; set; }

    // Navigation properties
    public Client Client { get; set; } = null!;
    public ICollection<SalesOrderItem> Items { get; set; } = new List<SalesOrderItem>();
    public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
    public ICollection<DeliveryNote> DeliveryNotes { get; set; } = new List<DeliveryNote>();
}






