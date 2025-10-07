using AutoMapper;
using MediatR;
using Spisa.Application.DTOs;
using Spisa.Domain.Entities;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.Categories.Queries.GetAllCategories;

public class GetAllCategoriesQueryHandler : IRequestHandler<GetAllCategoriesQuery, List<CategoryDto>>
{
    private readonly IRepository<Category> _categoryRepository;
    private readonly IMapper _mapper;

    public GetAllCategoriesQueryHandler(
        IRepository<Category> categoryRepository,
        IMapper mapper)
    {
        _categoryRepository = categoryRepository;
        _mapper = mapper;
    }

    public async Task<List<CategoryDto>> Handle(GetAllCategoriesQuery request, CancellationToken cancellationToken)
    {
        var categories = request.ActiveOnly
            ? await _categoryRepository.FindAsync(c => c.DeletedAt == null, cancellationToken)
            : await _categoryRepository.GetAllAsync(cancellationToken);

        var sortedCategories = categories.OrderBy(c => c.Name).ToList();

        return _mapper.Map<List<CategoryDto>>(sortedCategories);
    }
}

