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
    public string? Notes { get; set; }

    // Navigation properties
    public SalesOrder SalesOrder { get; set; } = null!;
}

