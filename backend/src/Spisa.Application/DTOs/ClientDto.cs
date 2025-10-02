namespace Spisa.Application.DTOs;

public class ClientDto
{
    public long Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string BusinessName { get; set; } = string.Empty;
    public string? Cuit { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? PostalCode { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public decimal? CreditLimit { get; set; }
    public decimal CurrentBalance { get; set; }
    public bool IsActive { get; set; }
    
    // Related entities
    public string? TaxConditionName { get; set; }
    public string? ProvinceName { get; set; }
    public string? OperationTypeName { get; set; }
    public string? TransporterName { get; set; }
    
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

