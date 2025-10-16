using MediatR;

namespace Spisa.Application.Features.SalesOrders.Commands.CreateSalesOrder;

public class CreateSalesOrderCommand : IRequest<long>
{
    public long ClientId { get; set; }
    public DateTime OrderDate { get; set; }
    public DateTime? DeliveryDate { get; set; }
    public string? Notes { get; set; }
    public List<CreateSalesOrderItemCommand> Items { get; set; } = new();
}

public class CreateSalesOrderItemCommand
{
    public long ArticleId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal DiscountPercent { get; set; } = 0;
}


