namespace Spisa.DataMigration.Mappers;

// Modern PostgreSQL entity models (for data writing)

public class ModernCategory
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal DefaultDiscountPercent { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class ModernArticle
{
    public long Id { get; set; }
    public int CategoryId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal? CostPrice { get; set; }
    public decimal MinimumStock { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class ModernClient
{
    public long Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string BusinessName { get; set; } = string.Empty;
    public string Cuit { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? City { get; set; }
    public int ProvinceId { get; set; }
    public string? PostalCode { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public int TaxConditionId { get; set; }
    public int OperationTypeId { get; set; }
    public int? TransporterId { get; set; }
    public decimal? CreditLimit { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class ModernClientDiscount
{
    public long ClientId { get; set; }
    public int CategoryId { get; set; }
    public decimal DiscountPercent { get; set; }
    public DateTime ValidFrom { get; set; }
    public DateTime? ValidUntil { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ModernSalesOrder
{
    public long Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public long ClientId { get; set; }
    public DateTime OrderDate { get; set; }
    public DateTime? DeliveryDate { get; set; }
    public decimal SpecialDiscountPercent { get; set; }
    public string? Notes { get; set; }
    public string Status { get; set; } = "PENDING";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class ModernSalesOrderItem
{
    public long SalesOrderId { get; set; }
    public long ArticleId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal LineTotal { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ModernInvoice
{
    public long Id { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public long SalesOrderId { get; set; }
    public DateTime InvoiceDate { get; set; }
    public decimal? UsdExchangeRate { get; set; }
    public string? Notes { get; set; }
    public bool IsPrinted { get; set; }
    public DateTime? PrintedAt { get; set; }
    public bool IsCancelled { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancellationReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class ModernDeliveryNote
{
    public long Id { get; set; }
    public string DeliveryNumber { get; set; } = string.Empty;
    public long SalesOrderId { get; set; }
    public DateTime DeliveryDate { get; set; }
    public int? TransporterId { get; set; }
    public decimal? WeightKg { get; set; }
    public int? PackagesCount { get; set; }
    public decimal? DeclaredValue { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

