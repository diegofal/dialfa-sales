using MediatR;
using Spisa.Application.Common.Models;
using Spisa.Application.DTOs;

namespace Spisa.Application.Features.Articles.Queries.GetAllArticles;

public class GetAllArticlesQuery : IRequest<PagedResult<ArticleDto>>
{
    public bool ActiveOnly { get; set; } = false;
    public bool? LowStockOnly { get; set; }
    public long? CategoryId { get; set; }
    public string? SearchTerm { get; set; }
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public string? SortBy { get; set; }
    public bool SortDescending { get; set; } = false;
}




