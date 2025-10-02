using MediatR;
using Spisa.Application.DTOs;

namespace Spisa.Application.Features.Clients.Commands.UpdateClient;

public class UpdateClientCommand : IRequest<ClientDto>
{
    public long Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string BusinessName { get; set; } = string.Empty;
    public string? Cuit { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? PostalCode { get; set; }
    public int? ProvinceId { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public int? TaxConditionId { get; set; }
    public int? OperationTypeId { get; set; }
    public int? TransporterId { get; set; }
    public decimal? CreditLimit { get; set; }
    public bool IsActive { get; set; }
}

