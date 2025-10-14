using MediatR;
using Spisa.Application.DTOs;

namespace Spisa.Application.Features.SalesOrders.Queries.GetAllSalesOrders;

public class GetAllSalesOrdersQuery : IRequest<List<SalesOrderListDto>>
{
    public long? ClientId { get; set; }
    public string? Status { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public bool ActiveOnly { get; set; } = false;
}

