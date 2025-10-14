using AutoMapper;
using MediatR;
using Spisa.Application.Common.Extensions;
using Spisa.Application.Common.Models;
using Spisa.Application.DTOs;
using Spisa.Domain.Entities;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.Articles.Queries.GetAllArticles;

public class GetAllArticlesQueryHandler : IRequestHandler<GetAllArticlesQuery, PagedResult<ArticleDto>>
{
    private readonly IRepository<Article> _articleRepository;
    private readonly IMapper _mapper;

    public GetAllArticlesQueryHandler(IRepository<Article> articleRepository, IMapper mapper)
    {
        _articleRepository = articleRepository;
        _mapper = mapper;
    }

    public async Task<PagedResult<ArticleDto>> Handle(GetAllArticlesQuery request, CancellationToken cancellationToken)
    {
        var articles = await _articleRepository.GetAllAsync();
        
        // Apply filters
        var query = articles.AsQueryable();

        if (request.ActiveOnly)
        {
            query = query.Where(a => a.DeletedAt == null);
        }

        if (request.CategoryId.HasValue)
        {
            query = query.Where(a => a.CategoryId == request.CategoryId.Value);
        }

        if (request.LowStockOnly.HasValue && request.LowStockOnly.Value)
        {
            query = query.Where(a => a.Stock <= a.MinimumStock && a.MinimumStock > 0);
        }

        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchTerm = request.SearchTerm.ToLower();
            query = query.Where(a => 
                a.Code.ToLower().Contains(searchTerm) ||
                a.Description.ToLower().Contains(searchTerm) ||
                (a.Category != null && a.Category.Name.ToLower().Contains(searchTerm))
            );
        }

        // Apply pagination and sorting
        var paginationParams = new PaginationParams
        {
            PageNumber = request.PageNumber,
            PageSize = request.PageSize,
            SortBy = request.SortBy ?? "Code",
            SortDescending = request.SortDescending
        };

        var pagedResult = await query.ToPagedResultAsync(paginationParams, cancellationToken);

        // Map to DTOs
        var articleDtos = _mapper.Map<List<ArticleDto>>(pagedResult.Items);

        return new PagedResult<ArticleDto>(articleDtos, pagedResult.TotalCount, pagedResult.PageNumber, pagedResult.PageSize);
    }
}




