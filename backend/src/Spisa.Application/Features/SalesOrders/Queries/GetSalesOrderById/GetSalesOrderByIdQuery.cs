using MediatR;
using Spisa.Application.DTOs;

namespace Spisa.Application.Features.SalesOrders.Queries.GetSalesOrderById;

public class GetSalesOrderByIdQuery : IRequest<SalesOrderDto?>
{
    public long Id { get; set; }
}


