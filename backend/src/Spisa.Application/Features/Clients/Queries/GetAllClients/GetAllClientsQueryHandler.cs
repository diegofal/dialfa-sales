using AutoMapper;
using MediatR;
using Microsoft.Extensions.Logging;
using Spisa.Application.Common.Extensions;
using Spisa.Application.Common.Models;
using Spisa.Application.DTOs;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.Clients.Queries.GetAllClients;

public class GetAllClientsQueryHandler : IRequestHandler<GetAllClientsQuery, PagedResult<ClientDto>>
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

    public async Task<PagedResult<ClientDto>> Handle(GetAllClientsQuery request, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Getting clients. Page: {Page}, PageSize: {PageSize}, SortBy: {SortBy}", 
            request.PageNumber, request.PageSize, request.SortBy);

        var clientsQuery = request.ActiveOnly
            ? (await _unitOfWork.Clients.GetActiveClientsAsync(cancellationToken)).AsQueryable()
            : (await _unitOfWork.Clients.GetAllAsync(cancellationToken)).AsQueryable();

        // Apply search filter if provided
        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchTerm = request.SearchTerm.ToLower();
            clientsQuery = clientsQuery.Where(c =>
                c.Code.ToLower().Contains(searchTerm) ||
                c.BusinessName.ToLower().Contains(searchTerm) ||
                (c.Cuit != null && c.Cuit.Contains(searchTerm)));
        }

        // Apply pagination and sorting
        var paginationParams = new PaginationParams
        {
            PageNumber = request.PageNumber,
            PageSize = request.PageSize,
            SortBy = request.SortBy ?? "BusinessName",
            SortDescending = request.SortDescending
        };

        var pagedResult = await clientsQuery.ToPagedResultAsync(paginationParams, cancellationToken);

        // Map to DTOs
        var clientDtos = _mapper.Map<List<ClientDto>>(pagedResult.Items);

        _logger.LogInformation("Retrieved {Count} of {Total} clients", clientDtos.Count, pagedResult.TotalCount);

        return new PagedResult<ClientDto>(clientDtos, pagedResult.TotalCount, pagedResult.PageNumber, pagedResult.PageSize);
    }
}






