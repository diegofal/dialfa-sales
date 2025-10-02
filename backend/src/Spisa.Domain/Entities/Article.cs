using Spisa.Domain.Common;

namespace Spisa.Domain.Entities;

public class Article : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public long CategoryId { get; set; }
    public decimal UnitPrice { get; set; }
    public int Stock { get; set; } = 0;
    public int MinimumStock { get; set; } = 0;
    public string? Location { get; set; }
    public bool IsDiscontinued { get; set; } = false;
    public string? Notes { get; set; }

    // Navigation properties
    public Category Category { get; set; } = null!;
    public ICollection<SalesOrderItem> SalesOrderItems { get; set; } = new List<SalesOrderItem>();
    public ICollection<StockMovement> StockMovements { get; set; } = new List<StockMovement>();
}






