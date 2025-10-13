using MediatR;

namespace Spisa.Application.Features.Articles.Commands.DeleteArticle;

public record DeleteArticleCommand(long Id) : IRequest;




