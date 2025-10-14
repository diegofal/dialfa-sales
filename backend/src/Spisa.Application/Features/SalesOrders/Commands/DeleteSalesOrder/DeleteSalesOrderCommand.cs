using MediatR;

namespace Spisa.Application.Features.SalesOrders.Commands.DeleteSalesOrder;

public class DeleteSalesOrderCommand : IRequest<Unit>
{
    public long Id { get; set; }
}

