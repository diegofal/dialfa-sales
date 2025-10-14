using MediatR;
using Spisa.Domain.Common;
using Spisa.Domain.Entities;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.SalesOrders.Commands.DeleteSalesOrder;

public class DeleteSalesOrderCommandHandler : IRequestHandler<DeleteSalesOrderCommand, Unit>
{
    private readonly IRepository<SalesOrder> _salesOrderRepository;
    private readonly IUnitOfWork _unitOfWork;

    public DeleteSalesOrderCommandHandler(
        IRepository<SalesOrder> salesOrderRepository,
        IUnitOfWork unitOfWork)
    {
        _salesOrderRepository = salesOrderRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<Unit> Handle(DeleteSalesOrderCommand request, CancellationToken cancellationToken)
    {
        var salesOrder = await _salesOrderRepository.GetByIdAsync(request.Id);
        
        if (salesOrder == null)
        {
            throw new ArgumentException($"SalesOrder with ID {request.Id} not found");
        }

        // Soft delete
        salesOrder.DeletedAt = DateTime.UtcNow;

        _salesOrderRepository.Update(salesOrder);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}

