using AutoMapper;
using MediatR;
using Spisa.Application.DTOs;
using Spisa.Domain.Entities;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.Articles.Commands.UpdateArticle;

public class UpdateArticleCommandHandler : IRequestHandler<UpdateArticleCommand, ArticleDto>
{
    private readonly IRepository<Article> _articleRepository;
    private readonly IRepository<Category> _categoryRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    public UpdateArticleCommandHandler(
        IRepository<Article> articleRepository,
        IRepository<Category> categoryRepository,
        IUnitOfWork _unitOfWork,
        IMapper mapper)
    {
        _articleRepository = articleRepository;
        _categoryRepository = categoryRepository;
        this._unitOfWork = _unitOfWork;
        _mapper = mapper;
    }

    public async Task<ArticleDto> Handle(UpdateArticleCommand request, CancellationToken cancellationToken)
    {
        var article = await _articleRepository.GetByIdAsync(request.Id);
        if (article == null)
        {
            throw new KeyNotFoundException($"Article with ID {request.Id} not found");
        }

        // Check if category exists
        var category = await _categoryRepository.GetByIdAsync(request.CategoryId);
        if (category == null)
        {
            throw new KeyNotFoundException($"Category with ID {request.CategoryId} not found");
        }

        // Check if code already exists (excluding current article)
        var existingArticle = (await _articleRepository.GetAllAsync())
            .FirstOrDefault(a => a.Code == request.Code && a.Id != request.Id && a.DeletedAt == null);
        
        if (existingArticle != null)
        {
            throw new InvalidOperationException($"An article with code '{request.Code}' already exists");
        }

        article.Code = request.Code;
        article.Description = request.Description;
        article.CategoryId = request.CategoryId;
        article.UnitPrice = request.UnitPrice;
        article.Stock = request.Stock;
        article.MinimumStock = request.MinimumStock;
        article.Location = request.Location;
        article.IsDiscontinued = request.IsDiscontinued;
        article.Notes = request.Notes;
        article.UpdatedAt = DateTime.UtcNow;

        _articleRepository.Update(article);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Reload with category for mapping
        article = (await _articleRepository.GetAllAsync())
            .FirstOrDefault(a => a.Id == article.Id);

        return _mapper.Map<ArticleDto>(article);
    }
}




