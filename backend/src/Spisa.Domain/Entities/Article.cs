using Spisa.Domain.Common;

namespace Spisa.Domain.Entities;

public class Article : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public long CategoryId { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal? CostPrice { get; set; }
    public decimal Stock { get; set; } = 0;
    public decimal MinimumStock { get; set; } = 0;
    public string? DisplayOrder { get; set; }
    public bool IsDiscontinued { get; set; } = false;
    public bool IsActive { get; set; } = true;
    public string? Type { get; set; }
    public int? Series { get; set; }
    public string? Thickness { get; set; }
    public string? Size { get; set; }
    public int? SupplierId { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? HistoricalPrice1 { get; set; }
    public string? Location { get; set; }
    public string? Notes { get; set; }

    // Navigation properties
    public Category Category { get; set; } = null!;
    public ICollection<SalesOrderItem> SalesOrderItems { get; set; } = new List<SalesOrderItem>();
    public ICollection<StockMovement> StockMovements { get; set; } = new List<StockMovement>();
}






