namespace Spisa.Domain.Entities;

public class ClientDiscount
{
    public long Id { get; set; }
    public long ClientId { get; set; }
    public long CategoryId { get; set; }
    public decimal DiscountPercent { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Client Client { get; set; } = null!;
    public Category Category { get; set; } = null!;
}






