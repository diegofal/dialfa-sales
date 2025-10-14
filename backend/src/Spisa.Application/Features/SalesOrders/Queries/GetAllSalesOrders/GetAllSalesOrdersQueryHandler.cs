using AutoMapper;
using MediatR;
using Spisa.Application.Common.Extensions;
using Spisa.Application.Common.Models;
using Spisa.Application.DTOs;
using Spisa.Domain.Common;
using Spisa.Domain.Entities;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.SalesOrders.Queries.GetAllSalesOrders;

public class GetAllSalesOrdersQueryHandler : IRequestHandler<GetAllSalesOrdersQuery, PagedResult<SalesOrderListDto>>
{
    private readonly IRepository<SalesOrder> _salesOrderRepository;
    private readonly IMapper _mapper;

    public GetAllSalesOrdersQueryHandler(
        IRepository<SalesOrder> salesOrderRepository,
        IMapper mapper)
    {
        _salesOrderRepository = salesOrderRepository;
        _mapper = mapper;
    }

    public async Task<PagedResult<SalesOrderListDto>> Handle(GetAllSalesOrdersQuery request, CancellationToken cancellationToken)
    {
        var allOrders = (await _salesOrderRepository.GetAllAsync()).ToList();
        var query = allOrders.AsQueryable();

        // Filter by ActiveOnly (not deleted)
        if (request.ActiveOnly)
        {
            query = query.Where(o => o.DeletedAt == null);
        }

        // Filter by ClientId
        if (request.ClientId.HasValue)
        {
            query = query.Where(o => o.ClientId == request.ClientId.Value);
        }

        // Filter by Status
        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            if (Enum.TryParse<OrderStatus>(request.Status, true, out var status))
            {
                query = query.Where(o => o.Status == status);
            }
        }

        // Filter by Date Range
        if (request.FromDate.HasValue)
        {
            query = query.Where(o => o.OrderDate >= request.FromDate.Value);
        }

        if (request.ToDate.HasValue)
        {
            query = query.Where(o => o.OrderDate <= request.ToDate.Value);
        }

        // Apply search filter if provided
        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchTerm = request.SearchTerm.ToLower();
            query = query.Where(o =>
                o.OrderNumber.ToLower().Contains(searchTerm) ||
                (o.Client != null && o.Client.BusinessName.ToLower().Contains(searchTerm)));
        }

        // Apply pagination and sorting
        var paginationParams = new PaginationParams
        {
            PageNumber = request.PageNumber,
            PageSize = request.PageSize,
            SortBy = request.SortBy ?? "OrderDate",
            SortDescending = request.SortDescending ? request.SortDescending : true // Default to descending for orders
        };

        var pagedResult = await query.ToPagedResultAsync(paginationParams, cancellationToken);

        // Map to DTOs
        var salesOrderDtos = _mapper.Map<List<SalesOrderListDto>>(pagedResult.Items);

        return new PagedResult<SalesOrderListDto>(salesOrderDtos, pagedResult.TotalCount, pagedResult.PageNumber, pagedResult.PageSize);
    }
}

