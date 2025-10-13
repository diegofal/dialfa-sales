using AutoMapper;
using MediatR;
using Spisa.Application.DTOs;
using Spisa.Domain.Entities;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.Articles.Queries.GetAllArticles;

public class GetAllArticlesQueryHandler : IRequestHandler<GetAllArticlesQuery, List<ArticleDto>>
{
    private readonly IRepository<Article> _articleRepository;
    private readonly IMapper _mapper;

    public GetAllArticlesQueryHandler(IRepository<Article> articleRepository, IMapper mapper)
    {
        _articleRepository = articleRepository;
        _mapper = mapper;
    }

    public async Task<List<ArticleDto>> Handle(GetAllArticlesQuery request, CancellationToken cancellationToken)
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

        var result = query
            .OrderBy(a => a.Code)
            .ToList();

        return _mapper.Map<List<ArticleDto>>(result);
    }
}




