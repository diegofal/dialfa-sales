using Spisa.Domain.Common;

namespace Spisa.Domain.Entities;

public class AccountMovement : BaseEntity
{
    public long ClientId { get; set; }
    public MovementType MovementType { get; set; }
    public decimal Amount { get; set; }
    public int? PaymentMethodId { get; set; }
    public DateTime MovementDate { get; set; }
    public string? ReferenceDocument { get; set; }
    public string? CheckNumber { get; set; }
    public DateTime? CheckDueDate { get; set; }
    public string? BankName { get; set; }
    public string? Notes { get; set; }

    // Navigation properties
    public Client Client { get; set; } = null!;
    public PaymentMethod? PaymentMethod { get; set; }
}

