using MediatR;
using Spisa.Application.Common.Models;
using Spisa.Application.DTOs;

namespace Spisa.Application.Features.Clients.Queries.GetAllClients;

public class GetAllClientsQuery : IRequest<PagedResult<ClientDto>>
{
    public bool ActiveOnly { get; set; } = false;
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public string? SortBy { get; set; }
    public bool SortDescending { get; set; } = false;
    public string? SearchTerm { get; set; }
}






