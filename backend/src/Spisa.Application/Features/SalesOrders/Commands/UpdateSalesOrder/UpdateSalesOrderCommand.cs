using MediatR;

namespace Spisa.Application.Features.SalesOrders.Commands.UpdateSalesOrder;

public class UpdateSalesOrderCommand : IRequest<Unit>
{
    public long Id { get; set; }
    public DateTime OrderDate { get; set; }
    public DateTime? DeliveryDate { get; set; }
    public string? Notes { get; set; }
    public List<UpdateSalesOrderItemCommand> Items { get; set; } = new();
}

public class UpdateSalesOrderItemCommand
{
    public long? Id { get; set; } // Null for new items
    public long ArticleId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal DiscountPercent { get; set; } = 0;
}

