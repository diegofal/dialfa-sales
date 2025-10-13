using MediatR;
using Spisa.Application.DTOs;

namespace Spisa.Application.Features.Articles.Queries.GetAllArticles;

public record GetAllArticlesQuery(
    bool ActiveOnly = false,
    bool? LowStockOnly = null,
    long? CategoryId = null,
    string? SearchTerm = null
) : IRequest<List<ArticleDto>>;




