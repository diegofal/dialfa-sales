using MediatR;
using Spisa.Application.DTOs;

namespace Spisa.Application.Features.Categories.Queries.GetAllCategories;

public record GetAllCategoriesQuery(bool ActiveOnly = false) : IRequest<List<CategoryDto>>;







