using AutoMapper;
using MediatR;
using Spisa.Application.DTOs;
using Spisa.Domain.Entities;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.Articles.Commands.CreateArticle;

public class CreateArticleCommandHandler : IRequestHandler<CreateArticleCommand, ArticleDto>
{
    private readonly IRepository<Article> _articleRepository;
    private readonly IRepository<Category> _categoryRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    public CreateArticleCommandHandler(
        IRepository<Article> articleRepository,
        IRepository<Category> categoryRepository,
        IUnitOfWork unitOfWork,
        IMapper mapper)
    {
        _articleRepository = articleRepository;
        _categoryRepository = categoryRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<ArticleDto> Handle(CreateArticleCommand request, CancellationToken cancellationToken)
    {
        // Check if category exists
        var category = await _categoryRepository.GetByIdAsync(request.CategoryId);
        if (category == null)
        {
            throw new KeyNotFoundException($"Category with ID {request.CategoryId} not found");
        }

        // Check if code already exists
        var existingArticle = (await _articleRepository.GetAllAsync())
            .FirstOrDefault(a => a.Code == request.Code && a.DeletedAt == null);
        
        if (existingArticle != null)
        {
            throw new InvalidOperationException($"An article with code '{request.Code}' already exists");
        }

        var article = new Article
        {
            Code = request.Code,
            Description = request.Description,
            CategoryId = request.CategoryId,
            UnitPrice = request.UnitPrice,
            Stock = request.Stock,
            MinimumStock = request.MinimumStock,
            Location = request.Location,
            IsDiscontinued = request.IsDiscontinued,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _articleRepository.AddAsync(article);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Reload with category for mapping
        article = (await _articleRepository.GetAllAsync())
            .FirstOrDefault(a => a.Id == article.Id);

        return _mapper.Map<ArticleDto>(article);
    }
}




