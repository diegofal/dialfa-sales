using AutoMapper;
using MediatR;
using Microsoft.Extensions.Logging;
using Spisa.Application.DTOs;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.Clients.Queries.GetClientById;

public class GetClientByIdQueryHandler : IRequestHandler<GetClientByIdQuery, ClientDto?>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly ILogger<GetClientByIdQueryHandler> _logger;

    public GetClientByIdQueryHandler(
        IUnitOfWork unitOfWork,
        IMapper mapper,
        ILogger<GetClientByIdQueryHandler> logger)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<ClientDto?> Handle(GetClientByIdQuery request, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Getting client by ID: {ClientId}", request.Id);

        var client = await _unitOfWork.Clients.GetByIdAsync(request.Id, cancellationToken);

        if (client == null)
        {
            _logger.LogWarning("Client with ID {ClientId} not found", request.Id);
            return null;
        }

        var clientDto = _mapper.Map<ClientDto>(client);

        _logger.LogInformation("Successfully retrieved client: {BusinessName}", client.BusinessName);

        return clientDto;
    }
}

