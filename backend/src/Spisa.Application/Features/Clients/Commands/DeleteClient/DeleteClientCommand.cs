using MediatR;

namespace Spisa.Application.Features.Clients.Commands.DeleteClient;

public class DeleteClientCommand : IRequest<bool>
{
    public long Id { get; set; }

    public DeleteClientCommand(long id)
    {
        Id = id;
    }
}

