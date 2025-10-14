using MediatR;
using Spisa.Domain.Common;
using Spisa.Domain.Entities;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.SalesOrders.Commands.CancelSalesOrder;

public class CancelSalesOrderCommandHandler : IRequestHandler<CancelSalesOrderCommand, Unit>
{
    private readonly IRepository<SalesOrder> _salesOrderRepository;
    private readonly IUnitOfWork _unitOfWork;

    public CancelSalesOrderCommandHandler(
        IRepository<SalesOrder> salesOrderRepository,
        IUnitOfWork unitOfWork)
    {
        _salesOrderRepository = salesOrderRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<Unit> Handle(CancelSalesOrderCommand request, CancellationToken cancellationToken)
    {
        var salesOrder = await _salesOrderRepository.GetByIdAsync(request.Id);
        
        if (salesOrder == null)
        {
            throw new ArgumentException($"SalesOrder with ID {request.Id} not found");
        }

        // Only allow cancellation if order is PENDING
        if (salesOrder.Status != OrderStatus.PENDING)
        {
            throw new InvalidOperationException($"Cannot cancel order with status {salesOrder.Status}. Only PENDING orders can be cancelled.");
        }

        // Update status to CANCELLED
        salesOrder.Status = OrderStatus.CANCELLED;

        _salesOrderRepository.Update(salesOrder);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}

