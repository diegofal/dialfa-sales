namespace Spisa.Domain.Entities;

public class Province
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<Client> Clients { get; set; } = new List<Client>();
}

