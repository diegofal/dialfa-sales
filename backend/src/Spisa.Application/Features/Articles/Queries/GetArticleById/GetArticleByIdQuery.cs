using MediatR;
using Spisa.Application.DTOs;

namespace Spisa.Application.Features.Articles.Queries.GetArticleById;

public record GetArticleByIdQuery(long Id) : IRequest<ArticleDto>;




