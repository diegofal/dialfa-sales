using MediatR;

namespace Spisa.Application.Features.Categories.Commands.DeleteCategory;

public record DeleteCategoryCommand(long Id) : IRequest;

