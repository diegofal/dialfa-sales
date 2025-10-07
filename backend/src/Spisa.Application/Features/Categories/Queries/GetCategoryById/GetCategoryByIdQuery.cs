using MediatR;
using Spisa.Application.DTOs;

namespace Spisa.Application.Features.Categories.Queries.GetCategoryById;

public record GetCategoryByIdQuery(long Id) : IRequest<CategoryDto>;

