using AutoMapper;
using MediatR;
using Spisa.Application.DTOs;
using Spisa.Domain.Entities;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.SalesOrders.Queries.GetSalesOrderById;

public class GetSalesOrderByIdQueryHandler : IRequestHandler<GetSalesOrderByIdQuery, SalesOrderDto?>
{
    private readonly IRepository<SalesOrder> _salesOrderRepository;
    private readonly IMapper _mapper;

    public GetSalesOrderByIdQueryHandler(
        IRepository<SalesOrder> salesOrderRepository,
        IMapper mapper)
    {
        _salesOrderRepository = salesOrderRepository;
        _mapper = mapper;
    }

    public async Task<SalesOrderDto?> Handle(GetSalesOrderByIdQuery request, CancellationToken cancellationToken)
    {
        var salesOrder = await _salesOrderRepository.GetByIdAsync(request.Id);

        if (salesOrder == null)
        {
            return null;
        }

        return _mapper.Map<SalesOrderDto>(salesOrder);
    }
}

