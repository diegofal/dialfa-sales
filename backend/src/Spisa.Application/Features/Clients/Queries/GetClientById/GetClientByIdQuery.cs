using MediatR;
using Spisa.Application.DTOs;

namespace Spisa.Application.Features.Clients.Queries.GetClientById;

public class GetClientByIdQuery : IRequest<ClientDto?>
{
    public long Id { get; set; }

    public GetClientByIdQuery(long id)
    {
        Id = id;
    }
}

