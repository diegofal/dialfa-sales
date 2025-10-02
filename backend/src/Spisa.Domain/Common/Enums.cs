namespace Spisa.Domain.Common;

public enum UserRole
{
    ADMIN,
    USER,
    VIEWER
}

public enum OrderStatus
{
    PENDING,
    INVOICED,
    CANCELLED
}

public enum MovementType
{
    CHARGE,
    PAYMENT,
    ADJUSTMENT
}

public enum StockMovementType
{
    SALE,
    PURCHASE,
    ADJUSTMENT,
    RETURN
}

