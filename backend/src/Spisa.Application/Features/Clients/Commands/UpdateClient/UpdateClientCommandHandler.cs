using AutoMapper;
using MediatR;
using Microsoft.Extensions.Logging;
using Spisa.Application.DTOs;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.Clients.Commands.UpdateClient;

public class UpdateClientCommandHandler : IRequestHandler<UpdateClientCommand, ClientDto>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly ILogger<UpdateClientCommandHandler> _logger;

    public UpdateClientCommandHandler(
        IUnitOfWork unitOfWork,
        IMapper mapper,
        ILogger<UpdateClientCommandHandler> logger)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<ClientDto> Handle(UpdateClientCommand request, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Updating client {ClientId}", request.Id);

        // Get existing client
        var client = await _unitOfWork.Clients.GetByIdAsync(request.Id, cancellationToken);
        if (client == null)
        {
            _logger.LogWarning("Client {ClientId} not found", request.Id);
            throw new KeyNotFoundException($"No se encontró el cliente con ID {request.Id}");
        }

        // Check if code is being changed and if new code already exists
        if (client.Code != request.Code.Trim())
        {
            var existingClient = await _unitOfWork.Clients.GetByCodeAsync(request.Code, cancellationToken);
            if (existingClient != null && existingClient.Id != request.Id)
            {
                _logger.LogWarning("Cannot update: Client with code {Code} already exists", request.Code);
                throw new InvalidOperationException($"Ya existe otro cliente con el código {request.Code}");
            }
        }

        // Check if CUIT is being changed and if new CUIT already exists
        if (!string.IsNullOrEmpty(request.Cuit) && client.Cuit != request.Cuit.Trim())
        {
            var existingCuit = await _unitOfWork.Clients.GetByCuitAsync(request.Cuit, cancellationToken);
            if (existingCuit != null && existingCuit.Id != request.Id)
            {
                _logger.LogWarning("Cannot update: Client with CUIT {Cuit} already exists", request.Cuit);
                throw new InvalidOperationException($"Ya existe otro cliente con el CUIT {request.Cuit}");
            }
        }

        // Update client properties
        client.Code = request.Code.Trim();
        client.BusinessName = request.BusinessName.Trim();
        client.Cuit = request.Cuit?.Trim();
        client.Address = request.Address?.Trim();
        client.City = request.City?.Trim();
        client.PostalCode = request.PostalCode?.Trim();
        client.ProvinceId = request.ProvinceId;
        client.Phone = request.Phone?.Trim();
        client.Email = request.Email?.Trim();
        client.TaxConditionId = request.TaxConditionId;
        client.OperationTypeId = request.OperationTypeId;
        client.TransporterId = request.TransporterId;
        client.CreditLimit = request.CreditLimit;
        client.IsActive = request.IsActive;
        client.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Clients.Update(client);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Successfully updated client {ClientId} - {BusinessName}", client.Id, client.BusinessName);

        var clientDto = _mapper.Map<ClientDto>(client);
        return clientDto;
    }
}

