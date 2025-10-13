using MediatR;
using Spisa.Domain.Entities;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.Articles.Commands.DeleteArticle;

public class DeleteArticleCommandHandler : IRequestHandler<DeleteArticleCommand>
{
    private readonly IRepository<Article> _articleRepository;
    private readonly IUnitOfWork _unitOfWork;

    public DeleteArticleCommandHandler(IRepository<Article> articleRepository, IUnitOfWork unitOfWork)
    {
        _articleRepository = articleRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task Handle(DeleteArticleCommand request, CancellationToken cancellationToken)
    {
        var article = await _articleRepository.GetByIdAsync(request.Id);
        if (article == null)
        {
            throw new KeyNotFoundException($"Article with ID {request.Id} not found");
        }

        // Soft delete
        article.DeletedAt = DateTime.UtcNow;
        _articleRepository.Update(article);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }
}




