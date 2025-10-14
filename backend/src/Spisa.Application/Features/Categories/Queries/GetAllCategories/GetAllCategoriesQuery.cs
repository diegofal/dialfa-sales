using MediatR;
using Spisa.Application.Common.Models;
using Spisa.Application.DTOs;

namespace Spisa.Application.Features.Categories.Queries.GetAllCategories;

public class GetAllCategoriesQuery : IRequest<PagedResult<CategoryDto>>
{
    public bool ActiveOnly { get; set; } = false;
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public string? SortBy { get; set; }
    public bool SortDescending { get; set; } = false;
    public string? SearchTerm { get; set; }
}







