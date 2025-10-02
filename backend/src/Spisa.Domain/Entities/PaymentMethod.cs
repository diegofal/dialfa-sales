namespace Spisa.Domain.Entities;

public class PaymentMethod
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool RequiresCheckData { get; set; } = false;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<AccountMovement> AccountMovements { get; set; } = new List<AccountMovement>();
}






