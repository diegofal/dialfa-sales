using AutoMapper;
using MediatR;
using Microsoft.Extensions.Logging;
using Spisa.Application.DTOs;
using Spisa.Domain.Entities;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.Clients.Commands.CreateClient;

public class CreateClientCommandHandler : IRequestHandler<CreateClientCommand, ClientDto>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly ILogger<CreateClientCommandHandler> _logger;

    public CreateClientCommandHandler(
        IUnitOfWork unitOfWork,
        IMapper mapper,
        ILogger<CreateClientCommandHandler> logger)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<ClientDto> Handle(CreateClientCommand request, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Creating new client with code: {Code}", request.Code);

        // Check if code already exists
        var existingClient = await _unitOfWork.Clients.GetByCodeAsync(request.Code, cancellationToken);
        if (existingClient != null)
        {
            _logger.LogWarning("Client with code {Code} already exists", request.Code);
            throw new InvalidOperationException($"Ya existe un cliente con el código {request.Code}");
        }

        // Check if CUIT already exists (if provided)
        if (!string.IsNullOrEmpty(request.Cuit))
        {
            var existingCuit = await _unitOfWork.Clients.GetByCuitAsync(request.Cuit, cancellationToken);
            if (existingCuit != null)
            {
                _logger.LogWarning("Client with CUIT {Cuit} already exists", request.Cuit);
                throw new InvalidOperationException($"Ya existe un cliente con el CUIT {request.Cuit}");
            }
        }

        // Create new client
        var client = new Client
        {
            Code = request.Code.Trim(),
            BusinessName = request.BusinessName.Trim(),
            Cuit = request.Cuit?.Trim(),
            Address = request.Address?.Trim(),
            City = request.City?.Trim(),
            PostalCode = request.PostalCode?.Trim(),
            ProvinceId = request.ProvinceId,
            Phone = request.Phone?.Trim(),
            Email = request.Email?.Trim(),
            TaxConditionId = request.TaxConditionId,
            OperationTypeId = request.OperationTypeId,
            TransporterId = request.TransporterId,
            CreditLimit = request.CreditLimit,
            CurrentBalance = request.CurrentBalance,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.Clients.AddAsync(client, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Successfully created client {ClientId} - {BusinessName}", client.Id, client.BusinessName);

        var clientDto = _mapper.Map<ClientDto>(client);
        return clientDto;
    }
}

