using FluentValidation;

namespace Spisa.Application.Features.Clients.Commands.CreateClient;

public class CreateClientCommandValidator : AbstractValidator<CreateClientCommand>
{
    public CreateClientCommandValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("El código del cliente es requerido")
            .MaximumLength(20).WithMessage("El código no puede exceder 20 caracteres");

        RuleFor(x => x.BusinessName)
            .NotEmpty().WithMessage("La razón social es requerida")
            .MaximumLength(200).WithMessage("La razón social no puede exceder 200 caracteres");

        RuleFor(x => x.Cuit)
            .Length(11).WithMessage("El CUIT debe tener 11 dígitos")
            .Matches(@"^\d{11}$").WithMessage("El CUIT solo debe contener dígitos")
            .When(x => !string.IsNullOrEmpty(x.Cuit));

        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("El email no tiene un formato válido")
            .When(x => !string.IsNullOrEmpty(x.Email));

        RuleFor(x => x.CreditLimit)
            .GreaterThanOrEqualTo(0).WithMessage("El límite de crédito no puede ser negativo")
            .When(x => x.CreditLimit.HasValue);
    }
}

