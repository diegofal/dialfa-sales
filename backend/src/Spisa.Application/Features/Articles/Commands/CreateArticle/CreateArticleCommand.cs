using MediatR;
using Spisa.Application.DTOs;

namespace Spisa.Application.Features.Articles.Commands.CreateArticle;

public record CreateArticleCommand : IRequest<ArticleDto>
{
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public long CategoryId { get; set; }
    public decimal UnitPrice { get; set; }
    public int Stock { get; set; } = 0;
    public int MinimumStock { get; set; } = 0;
    public string? Location { get; set; }
    public bool IsDiscontinued { get; set; } = false;
    public string? Notes { get; set; }
}




