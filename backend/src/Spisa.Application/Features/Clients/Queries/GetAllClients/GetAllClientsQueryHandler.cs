using AutoMapper;
using MediatR;
using Microsoft.Extensions.Logging;
using Spisa.Application.DTOs;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.Clients.Queries.GetAllClients;

public class GetAllClientsQueryHandler : IRequestHandler<GetAllClientsQuery, List<ClientDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly ILogger<GetAllClientsQueryHandler> _logger;

    public GetAllClientsQueryHandler(
        IUnitOfWork unitOfWork,
        IMapper mapper,
        ILogger<GetAllClientsQueryHandler> logger)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<List<ClientDto>> Handle(GetAllClientsQuery request, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Getting all clients. ActiveOnly: {ActiveOnly}", request.ActiveOnly);

        var clients = request.ActiveOnly
            ? await _unitOfWork.Clients.GetActiveClientsAsync(cancellationToken)
            : await _unitOfWork.Clients.GetAllAsync(cancellationToken);

        var clientDtos = _mapper.Map<List<ClientDto>>(clients);

        _logger.LogInformation("Retrieved {Count} clients", clientDtos.Count);

        return clientDtos;
    }
}

