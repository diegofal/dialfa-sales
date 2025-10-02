using MediatR;
using Spisa.Application.DTOs;

namespace Spisa.Application.Features.Clients.Queries.GetAllClients;

public class GetAllClientsQuery : IRequest<List<ClientDto>>
{
    public bool ActiveOnly { get; set; } = false;
}






