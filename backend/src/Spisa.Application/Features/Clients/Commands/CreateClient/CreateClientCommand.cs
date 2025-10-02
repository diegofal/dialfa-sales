using MediatR;
using Spisa.Application.DTOs;

namespace Spisa.Application.Features.Clients.Commands.CreateClient;

public class CreateClientCommand : IRequest<ClientDto>
{
    public string Code { get; set; } = string.Empty;
    public string BusinessName { get; set; } = string.Empty;
    public string? Cuit { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? PostalCode { get; set; }
    public int? ProvinceId { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public int TaxConditionId { get; set; }  // Required field
    public int OperationTypeId { get; set; }  // Required field
    public int? TransporterId { get; set; }
    public decimal? CreditLimit { get; set; }
    public decimal CurrentBalance { get; set; } = 0;
}





