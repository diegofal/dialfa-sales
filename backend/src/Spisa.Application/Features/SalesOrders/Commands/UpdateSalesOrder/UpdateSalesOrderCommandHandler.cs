using MediatR;
using Spisa.Domain.Common;
using Spisa.Domain.Entities;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.SalesOrders.Commands.UpdateSalesOrder;

public class UpdateSalesOrderCommandHandler : IRequestHandler<UpdateSalesOrderCommand, Unit>
{
    private readonly IRepository<SalesOrder> _salesOrderRepository;
    private readonly IRepository<Article> _articleRepository;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateSalesOrderCommandHandler(
        IRepository<SalesOrder> salesOrderRepository,
        IRepository<Article> articleRepository,
        IUnitOfWork unitOfWork)
    {
        _salesOrderRepository = salesOrderRepository;
        _articleRepository = articleRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<Unit> Handle(UpdateSalesOrderCommand request, CancellationToken cancellationToken)
    {
        // Get existing order
        var salesOrder = await _salesOrderRepository.GetByIdAsync(request.Id);

        if (salesOrder == null)
        {
            throw new ArgumentException($"SalesOrder with ID {request.Id} not found");
        }

        // Load items collection (will be populated by EF Core tracking)
        if (salesOrder.Items == null || !salesOrder.Items.Any())
        {
            // Items will be loaded via navigation property
        }

        // Only allow updates if order is PENDING
        if (salesOrder.Status != OrderStatus.PENDING)
        {
            throw new InvalidOperationException($"Cannot update order with status {salesOrder.Status}. Only PENDING orders can be updated.");
        }

        // Verify all articles exist
        var articleIds = request.Items.Select(i => i.ArticleId).Distinct().ToList();
        var articles = (await _articleRepository.GetAllAsync())
            .Where(a => articleIds.Contains(a.Id))
            .ToDictionary(a => a.Id);

        if (articles.Count != articleIds.Count)
        {
            var missingIds = articleIds.Except(articles.Keys).ToList();
            throw new ArgumentException($"Articles with IDs {string.Join(", ", missingIds)} not found");
        }

        // Update order properties
        salesOrder.OrderDate = request.OrderDate;
        salesOrder.DeliveryDate = request.DeliveryDate;
        salesOrder.Notes = request.Notes;

        // Remove old items (we'll recreate all items)
        salesOrder.Items.Clear();

        // Create new items and calculate total
        decimal totalAmount = 0;
        foreach (var item in request.Items)
        {
            var lineTotal = item.Quantity * item.UnitPrice * (1 - item.DiscountPercent / 100);
            
            salesOrder.Items.Add(new SalesOrderItem
            {
                ArticleId = item.ArticleId,
                Quantity = item.Quantity,
                UnitPrice = item.UnitPrice,
                DiscountPercent = item.DiscountPercent,
                LineTotal = lineTotal
            });

            totalAmount += lineTotal;
        }

        salesOrder.Total = totalAmount;

        // Update in repository
        _salesOrderRepository.Update(salesOrder);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}

