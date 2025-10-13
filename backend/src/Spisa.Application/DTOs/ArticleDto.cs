namespace Spisa.Application.DTOs;

public class ArticleDto
{
    public long Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public long CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public decimal Stock { get; set; }
    public decimal MinimumStock { get; set; }
    public string? Location { get; set; }
    public bool IsDiscontinued { get; set; }
    public string? Notes { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
    // Computed properties
    public bool IsLowStock => Stock <= MinimumStock && MinimumStock > 0;
    public string StockStatus => IsLowStock ? "Low" : Stock > 0 ? "Available" : "Out of Stock";
}




