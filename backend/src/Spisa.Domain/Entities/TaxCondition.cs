namespace Spisa.Domain.Entities;

public class TaxCondition
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<Client> Clients { get; set; } = new List<Client>();
}






