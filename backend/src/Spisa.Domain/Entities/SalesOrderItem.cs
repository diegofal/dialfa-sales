namespace Spisa.Domain.Entities;

public class SalesOrderItem
{
    public long Id { get; set; }
    public long SalesOrderId { get; set; }
    public long ArticleId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal DiscountPercent { get; set; } = 0;
    public decimal LineTotal { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public SalesOrder SalesOrder { get; set; } = null!;
    public Article Article { get; set; } = null!;
}






