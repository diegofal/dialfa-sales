using AutoMapper;
using MediatR;
using Spisa.Application.DTOs;
using Spisa.Domain.Common;
using Spisa.Domain.Entities;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.SalesOrders.Queries.GetAllSalesOrders;

public class GetAllSalesOrdersQueryHandler : IRequestHandler<GetAllSalesOrdersQuery, List<SalesOrderListDto>>
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

    public async Task<List<SalesOrderListDto>> Handle(GetAllSalesOrdersQuery request, CancellationToken cancellationToken)
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

        var salesOrders = query
            .OrderByDescending(o => o.OrderDate)
            .ThenByDescending(o => o.Id)
            .ToList();

        return _mapper.Map<List<SalesOrderListDto>>(salesOrders);
    }
}

