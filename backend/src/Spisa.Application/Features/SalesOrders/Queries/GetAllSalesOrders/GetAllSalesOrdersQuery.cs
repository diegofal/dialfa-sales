using MediatR;
using Spisa.Application.Common.Models;
using Spisa.Application.DTOs;

namespace Spisa.Application.Features.SalesOrders.Queries.GetAllSalesOrders;

public class GetAllSalesOrdersQuery : IRequest<PagedResult<SalesOrderListDto>>
{
    public long? ClientId { get; set; }
    public string? Status { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public bool ActiveOnly { get; set; } = false;
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public string? SortBy { get; set; }
    public bool SortDescending { get; set; } = false;
    public string? SearchTerm { get; set; }
}

