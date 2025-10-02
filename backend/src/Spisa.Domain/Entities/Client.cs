using Spisa.Domain.Common;

namespace Spisa.Domain.Entities;

public class Client : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string BusinessName { get; set; } = string.Empty;
    public string? Cuit { get; set; }
    public int? TaxConditionId { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? PostalCode { get; set; }
    public int? ProvinceId { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public int? OperationTypeId { get; set; }
    public int? TransporterId { get; set; }
    public decimal? CreditLimit { get; set; }
    public decimal CurrentBalance { get; set; } = 0;
    public bool IsActive { get; set; } = true;

    // Navigation properties
    public TaxCondition? TaxCondition { get; set; }
    public Province? Province { get; set; }
    public OperationType? OperationType { get; set; }
    public Transporter? Transporter { get; set; }
    public ICollection<ClientDiscount> ClientDiscounts { get; set; } = new List<ClientDiscount>();
    public ICollection<SalesOrder> SalesOrders { get; set; } = new List<SalesOrder>();
    public ICollection<AccountMovement> AccountMovements { get; set; } = new List<AccountMovement>();
}

