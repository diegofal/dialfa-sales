using AutoMapper;
using MediatR;
using Spisa.Application.DTOs;
using Spisa.Domain.Entities;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.Articles.Queries.GetArticleById;

public class GetArticleByIdQueryHandler : IRequestHandler<GetArticleByIdQuery, ArticleDto>
{
    private readonly IRepository<Article> _articleRepository;
    private readonly IMapper _mapper;

    public GetArticleByIdQueryHandler(IRepository<Article> articleRepository, IMapper mapper)
    {
        _articleRepository = articleRepository;
        _mapper = mapper;
    }

    public async Task<ArticleDto> Handle(GetArticleByIdQuery request, CancellationToken cancellationToken)
    {
        var article = (await _articleRepository.GetAllAsync())
            .FirstOrDefault(a => a.Id == request.Id);

        if (article == null)
        {
            throw new KeyNotFoundException($"Article with ID {request.Id} not found");
        }

        return _mapper.Map<ArticleDto>(article);
    }
}




