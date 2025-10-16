using MediatR;
using Spisa.Application.DTOs;

namespace Spisa.Application.Features.Articles.Commands.UpdateArticle;

public class UpdateArticleCommand : IRequest<ArticleDto>
{
    public long Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public long CategoryId { get; set; }
    public decimal UnitPrice { get; set; }
    public int Stock { get; set; }
    public int MinimumStock { get; set; }
    public string? Location { get; set; }
    public bool IsDiscontinued { get; set; }
    public string? Notes { get; set; }
}





