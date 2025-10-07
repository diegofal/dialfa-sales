using AutoMapper;
using MediatR;
using Spisa.Application.DTOs;
using Spisa.Domain.Entities;
using Spisa.Domain.Interfaces;

namespace Spisa.Application.Features.Categories.Commands.UpdateCategory;

public class UpdateCategoryCommandHandler : IRequestHandler<UpdateCategoryCommand, CategoryDto>
{
    private readonly IRepository<Category> _categoryRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    public UpdateCategoryCommandHandler(
        IRepository<Category> categoryRepository,
        IUnitOfWork unitOfWork,
        IMapper mapper)
    {
        _categoryRepository = categoryRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<CategoryDto> Handle(UpdateCategoryCommand request, CancellationToken cancellationToken)
    {
        var category = await _categoryRepository.GetByIdAsync(request.Id, cancellationToken);
        if (category == null)
        {
            throw new KeyNotFoundException($"Categoría con ID {request.Id} no encontrada");
        }

        // Check if code is being changed and if it already exists
        if (category.Code != request.Code)
        {
            var existingCategory = await _categoryRepository.FindAsync(c => c.Code == request.Code && c.Id != request.Id, cancellationToken);
            if (existingCategory.Any())
            {
                throw new InvalidOperationException($"Ya existe una categoría con el código '{request.Code}'");
            }
        }

        category.Code = request.Code.Trim();
        category.Name = request.Name.Trim();
        category.Description = request.Description?.Trim();
        category.DefaultDiscountPercent = request.DefaultDiscountPercent;
        category.UpdatedAt = DateTime.UtcNow;

        _categoryRepository.Update(category);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<CategoryDto>(category);
    }
}

