using MediatR;
using Spisa.Domain.Common;
using Spisa.Domain.Entities;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.SalesOrders.Commands.CreateSalesOrder;

public class CreateSalesOrderCommandHandler : IRequestHandler<CreateSalesOrderCommand, long>
{
    private readonly IRepository<SalesOrder> _salesOrderRepository;
    private readonly IRepository<Client> _clientRepository;
    private readonly IRepository<Article> _articleRepository;
    private readonly IUnitOfWork _unitOfWork;

    public CreateSalesOrderCommandHandler(
        IRepository<SalesOrder> salesOrderRepository,
        IRepository<Client> clientRepository,
        IRepository<Article> articleRepository,
        IUnitOfWork unitOfWork)
    {
        _salesOrderRepository = salesOrderRepository;
        _clientRepository = clientRepository;
        _articleRepository = articleRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<long> Handle(CreateSalesOrderCommand request, CancellationToken cancellationToken)
    {
        // Verify client exists
        var client = await _clientRepository.GetByIdAsync(request.ClientId);
        if (client == null)
        {
            throw new ArgumentException($"Client with ID {request.ClientId} not found");
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

        // Generate order number (format: ORD-YYYYMMDD-XXXXX)
        var today = DateTime.UtcNow;
        var ordersToday = (await _salesOrderRepository.GetAllAsync())
            .Where(o => o.OrderDate.Date == today.Date)
            .Count();
        
        var orderNumber = $"ORD-{today:yyyyMMdd}-{(ordersToday + 1):D5}";

        // Create order
        var salesOrder = new SalesOrder
        {
            ClientId = request.ClientId,
            OrderNumber = orderNumber,
            OrderDate = request.OrderDate,
            DeliveryDate = request.DeliveryDate,
            Status = OrderStatus.PENDING,
            Notes = request.Notes,
            Total = 0 // Will be calculated below
        };

        // Create items and calculate total
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

        // Save to repository
        await _salesOrderRepository.AddAsync(salesOrder);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return salesOrder.Id;
    }
}

