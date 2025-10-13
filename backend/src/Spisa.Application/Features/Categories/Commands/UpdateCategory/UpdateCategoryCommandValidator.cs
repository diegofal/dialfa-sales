using FluentValidation;

namespace Spisa.Application.Features.Categories.Commands.UpdateCategory;

public class UpdateCategoryCommandValidator : AbstractValidator<UpdateCategoryCommand>
{
    public UpdateCategoryCommandValidator()
    {
        RuleFor(x => x.Id)
            .GreaterThan(0).WithMessage("El ID es requerido");

        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("El código es requerido")
            .MaximumLength(20).WithMessage("El código no puede exceder 20 caracteres");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("El nombre es requerido")
            .MaximumLength(100).WithMessage("El nombre no puede exceder 100 caracteres");

        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("La descripción no puede exceder 500 caracteres");

        RuleFor(x => x.DefaultDiscountPercent)
            .GreaterThanOrEqualTo(0).WithMessage("El descuento no puede ser negativo")
            .LessThanOrEqualTo(100).WithMessage("El descuento no puede ser mayor a 100%");
    }
}







