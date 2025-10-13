using FluentValidation;

namespace Spisa.Application.Features.Articles.Commands.UpdateArticle;

public class UpdateArticleCommandValidator : AbstractValidator<UpdateArticleCommand>
{
    public UpdateArticleCommandValidator()
    {
        RuleFor(x => x.Id)
            .GreaterThan(0).WithMessage("El ID del artículo es requerido");

        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("El código es requerido")
            .MaximumLength(50).WithMessage("El código no puede exceder 50 caracteres");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("La descripción es requerida")
            .MaximumLength(500).WithMessage("La descripción no puede exceder 500 caracteres");

        RuleFor(x => x.CategoryId)
            .GreaterThan(0).WithMessage("Debe seleccionar una categoría válida");

        RuleFor(x => x.UnitPrice)
            .GreaterThanOrEqualTo(0).WithMessage("El precio unitario no puede ser negativo");

        RuleFor(x => x.Stock)
            .GreaterThanOrEqualTo(0).WithMessage("El stock no puede ser negativo");

        RuleFor(x => x.MinimumStock)
            .GreaterThanOrEqualTo(0).WithMessage("El stock mínimo no puede ser negativo");

        RuleFor(x => x.Location)
            .MaximumLength(100).WithMessage("La ubicación no puede exceder 100 caracteres")
            .When(x => !string.IsNullOrEmpty(x.Location));

        RuleFor(x => x.Notes)
            .MaximumLength(1000).WithMessage("Las notas no pueden exceder 1000 caracteres")
            .When(x => !string.IsNullOrEmpty(x.Notes));
    }
}




