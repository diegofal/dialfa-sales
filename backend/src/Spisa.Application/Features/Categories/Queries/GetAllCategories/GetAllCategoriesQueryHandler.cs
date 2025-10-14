using AutoMapper;
using MediatR;
using Spisa.Application.Common.Extensions;
using Spisa.Application.Common.Models;
using Spisa.Application.DTOs;
using Spisa.Domain.Entities;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.Categories.Queries.GetAllCategories;

public class GetAllCategoriesQueryHandler : IRequestHandler<GetAllCategoriesQuery, PagedResult<CategoryDto>>
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

    public async Task<PagedResult<CategoryDto>> Handle(GetAllCategoriesQuery request, CancellationToken cancellationToken)
    {
        var categoriesQuery = request.ActiveOnly
            ? (await _categoryRepository.FindAsync(c => c.DeletedAt == null, cancellationToken)).AsQueryable()
            : (await _categoryRepository.GetAllAsync(cancellationToken)).AsQueryable();

        // Apply search filter if provided
        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchTerm = request.SearchTerm.ToLower();
            categoriesQuery = categoriesQuery.Where(c =>
                c.Code.ToLower().Contains(searchTerm) ||
                c.Name.ToLower().Contains(searchTerm));
        }

        // Apply pagination and sorting
        var paginationParams = new PaginationParams
        {
            PageNumber = request.PageNumber,
            PageSize = request.PageSize,
            SortBy = request.SortBy ?? "Name",
            SortDescending = request.SortDescending
        };

        var pagedResult = await categoriesQuery.ToPagedResultAsync(paginationParams, cancellationToken);

        // Map to DTOs
        var categoryDtos = _mapper.Map<List<CategoryDto>>(pagedResult.Items);

        return new PagedResult<CategoryDto>(categoryDtos, pagedResult.TotalCount, pagedResult.PageNumber, pagedResult.PageSize);
    }
}

