using FluentValidation;

namespace Spisa.Application.Features.SalesOrders.Commands.UpdateSalesOrder;

public class UpdateSalesOrderCommandValidator : AbstractValidator<UpdateSalesOrderCommand>
{
    public UpdateSalesOrderCommandValidator()
    {
        RuleFor(x => x.Id)
            .GreaterThan(0)
            .WithMessage("Id must be greater than 0");

        RuleFor(x => x.OrderDate)
            .NotEmpty()
            .WithMessage("OrderDate is required");

        RuleFor(x => x.DeliveryDate)
            .GreaterThanOrEqualTo(x => x.OrderDate)
            .When(x => x.DeliveryDate.HasValue)
            .WithMessage("DeliveryDate must be greater than or equal to OrderDate");

        RuleFor(x => x.Items)
            .NotEmpty()
            .WithMessage("Order must have at least one item");

        RuleForEach(x => x.Items).SetValidator(new UpdateSalesOrderItemCommandValidator());
    }
}

public class UpdateSalesOrderItemCommandValidator : AbstractValidator<UpdateSalesOrderItemCommand>
{
    public UpdateSalesOrderItemCommandValidator()
    {
        RuleFor(x => x.ArticleId)
            .GreaterThan(0)
            .WithMessage("ArticleId must be greater than 0");

        RuleFor(x => x.Quantity)
            .GreaterThan(0)
            .WithMessage("Quantity must be greater than 0");

        RuleFor(x => x.UnitPrice)
            .GreaterThanOrEqualTo(0)
            .WithMessage("UnitPrice must be greater than or equal to 0");

        RuleFor(x => x.DiscountPercent)
            .InclusiveBetween(0, 100)
            .WithMessage("DiscountPercent must be between 0 and 100");
    }
}

