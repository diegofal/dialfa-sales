using Spisa.Domain.Common;

namespace Spisa.Domain.Entities;

public class Category : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal DefaultDiscountPercent { get; set; } = 0;

    // Navigation properties
    public ICollection<Article> Articles { get; set; } = new List<Article>();
    public ICollection<ClientDiscount> ClientDiscounts { get; set; } = new List<ClientDiscount>();
}






