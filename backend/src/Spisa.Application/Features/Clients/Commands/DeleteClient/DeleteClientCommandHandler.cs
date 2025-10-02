using MediatR;
using Microsoft.Extensions.Logging;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.Clients.Commands.DeleteClient;

public class DeleteClientCommandHandler : IRequestHandler<DeleteClientCommand, bool>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<DeleteClientCommandHandler> _logger;

    public DeleteClientCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<DeleteClientCommandHandler> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<bool> Handle(DeleteClientCommand request, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Deleting client {ClientId}", request.Id);

        var client = await _unitOfWork.Clients.GetByIdAsync(request.Id, cancellationToken);
        if (client == null)
        {
            _logger.LogWarning("Client {ClientId} not found", request.Id);
            throw new KeyNotFoundException($"No se encontró el cliente con ID {request.Id}");
        }

        // Soft delete
        client.DeletedAt = DateTime.UtcNow;
        client.UpdatedAt = DateTime.UtcNow;
        
        _unitOfWork.Clients.Update(client);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Successfully soft-deleted client {ClientId} - {BusinessName}", client.Id, client.BusinessName);

        return true;
    }
}






