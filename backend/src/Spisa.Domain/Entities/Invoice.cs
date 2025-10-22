using Spisa.Domain.Common;

namespace Spisa.Domain.Entities;

public class Invoice : BaseEntity
{
    public string InvoiceNumber { get; set; } = string.Empty;
    public long SalesOrderId { get; set; }
    public DateTime InvoiceDate { get; set; }
    public decimal NetAmount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal? UsdExchangeRate { get; set; }
    public bool IsPrinted { get; set; } = false;
    public DateTime? PrintedAt { get; set; }
    public bool IsCancelled { get; set; } = false;
    public DateTime? CancelledAt { get; set; }
    public string? CancellationReason { get; set; }
    public string? Notes { get; set; }

    // Navigation properties
    public SalesOrder SalesOrder { get; set; } = null!;
}






