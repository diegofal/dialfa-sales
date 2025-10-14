using MediatR;

namespace Spisa.Application.Features.SalesOrders.Commands.CancelSalesOrder;

public class CancelSalesOrderCommand : IRequest<Unit>
{
    public long Id { get; set; }
}

