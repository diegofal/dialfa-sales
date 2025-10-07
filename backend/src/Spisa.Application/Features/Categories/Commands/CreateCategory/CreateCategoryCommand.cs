using MediatR;
using Spisa.Application.DTOs;

namespace Spisa.Application.Features.Categories.Commands.CreateCategory;

public class CreateCategoryCommand : IRequest<CategoryDto>
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal DefaultDiscountPercent { get; set; } = 0;
}





