using Spisa.Domain.Common;

namespace Spisa.Domain.Entities;

public class StockMovement : BaseEntity
{
    public long ArticleId { get; set; }
    public StockMovementType MovementType { get; set; }
    public int Quantity { get; set; }
    public string? ReferenceDocument { get; set; }
    public DateTime MovementDate { get; set; }
    public string? Notes { get; set; }

    // Navigation properties
    public Article Article { get; set; } = null!;
}

