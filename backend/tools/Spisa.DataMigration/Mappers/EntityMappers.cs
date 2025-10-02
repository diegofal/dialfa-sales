namespace Spisa.DataMigration.Mappers;

public static class CategoryMapper
{
    public static ModernCategory Map(LegacyCategoria legacy)
    {
        return new ModernCategory
        {
            Id = legacy.IdCategoria,
            Code = GenerateCategoryCode(legacy.Descripcion),
            Name = legacy.Descripcion.Trim(),
            DefaultDiscountPercent = legacy.Descuento,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private static string GenerateCategoryCode(string description)
    {
        // Generate code from first 3 letters of description
        var cleanName = new string(description.Where(char.IsLetter).ToArray());
        return cleanName.Length >= 3 
            ? cleanName.Substring(0, 3).ToUpper() 
            : cleanName.ToUpper().PadRight(3, 'X');
    }
}

public static class ArticleMapper
{
    public static ModernArticle Map(LegacyArticulo legacy)
    {
        return new ModernArticle
        {
            Id = legacy.idArticulo,
            CategoryId = legacy.IdCategoria,
            Code = legacy.codigo.Trim(),
            Description = legacy.descripcion.Trim(),
            Quantity = legacy.cantidad,
            UnitPrice = legacy.preciounitario,
            CostPrice = null, // Not available in legacy system
            MinimumStock = 0, // Not available in legacy system
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }
}

public static class ClientMapper
{
    public static ModernClient Map(LegacyCliente legacy)
    {
        return new ModernClient
        {
            Id = legacy.IdCliente,
            Code = legacy.Codigo.Trim(),
            BusinessName = legacy.RazonSocial.Trim(),
            Cuit = CleanCuit(legacy.CUIT),
            Address = legacy.Domicilio?.Trim(),
            City = legacy.Localidad?.Trim(),
            ProvinceId = legacy.IdProvincia,
            PostalCode = null, // Not available in legacy
            Phone = null, // Not available in legacy
            Email = null, // Not available in legacy
            TaxConditionId = legacy.IdCondicionIVA,
            OperationTypeId = legacy.IdOperatoria,
            TransporterId = legacy.IdTransportista,
            CreditLimit = null, // Not available in legacy
            CurrentBalance = legacy.Saldo,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private static string CleanCuit(string cuit)
    {
        // Remove dashes, spaces, and non-numeric characters
        var cleaned = new string(cuit.Where(char.IsDigit).ToArray());
        
        // Pad to 11 digits if needed (should be validated before migration)
        if (cleaned.Length < 11)
        {
            cleaned = cleaned.PadLeft(11, '0');
        }
        else if (cleaned.Length > 11)
        {
            cleaned = cleaned.Substring(0, 11);
        }
        
        return cleaned;
    }
}

public static class ClientDiscountMapper
{
    public static ModernClientDiscount Map(LegacyDescuento legacy)
    {
        return new ModernClientDiscount
        {
            ClientId = legacy.IdCliente,
            CategoryId = legacy.IdCategoria,
            DiscountPercent = legacy.Descuento,
            ValidFrom = DateTime.UtcNow.Date,
            ValidUntil = null, // No expiration
            CreatedAt = DateTime.UtcNow
        };
    }
}

public static class SalesOrderMapper
{
    public static ModernSalesOrder Map(LegacyNotaPedido legacy)
    {
        // Determine status based on whether invoices exist
        var status = "PENDING"; // Default - UPPERCASE to match PostgreSQL ENUM
        
        // Fix invalid delivery dates (must be >= order_date)
        var deliveryDate = legacy.FechaEntrega;
        if (deliveryDate < legacy.FechaEmision)
        {
            deliveryDate = legacy.FechaEmision; // Use order date as delivery date
        }
        
        return new ModernSalesOrder
        {
            Id = legacy.IdNotaPedido,
            OrderNumber = legacy.NumeroOrden.Trim(),
            ClientId = legacy.IdCliente,
            OrderDate = legacy.FechaEmision,
            DeliveryDate = deliveryDate,
            SpecialDiscountPercent = (decimal)legacy.DescuentoEspecial,
            Notes = legacy.Observaciones?.Trim(),
            Status = status, // Will be cast to order_status ENUM by PostgreSQL
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }
}

public static class SalesOrderItemMapper
{
    public static ModernSalesOrderItem Map(LegacyNotaPedidoItem legacy)
    {
        var unitPrice = legacy.PrecioUnitario ?? 0;
        var discountPercent = legacy.Descuento ?? 0;
        
        // Fix invalid discount: -1 means "no discount" in legacy system
        if (discountPercent < 0 || discountPercent > 100)
        {
            discountPercent = 0;
        }
        
        var quantity = legacy.Cantidad;
        
        // Fix invalid quantity: must be > 0
        if (quantity <= 0)
        {
            quantity = 1; // Default to 1 unit
        }
        
        // Calculate line total: quantity * price * (1 - discount/100)
        var lineTotal = quantity * unitPrice * (1 - (discountPercent / 100));
        
        return new ModernSalesOrderItem
        {
            SalesOrderId = legacy.IdNotaPedido,
            ArticleId = legacy.IdArticulo,
            Quantity = quantity,
            UnitPrice = unitPrice,
            DiscountPercent = discountPercent,
            LineTotal = lineTotal,
            CreatedAt = DateTime.UtcNow
        };
    }
}

public static class InvoiceMapper
{
    public static ModernInvoice Map(LegacyFactura legacy)
    {
        return new ModernInvoice
        {
            Id = legacy.IdFactura,
            InvoiceNumber = legacy.NumeroFactura.ToString().PadLeft(12, '0'),
            SalesOrderId = legacy.IdNotaPedido,
            InvoiceDate = legacy.Fecha,
            UsdExchangeRate = legacy.ValorDolar,
            Notes = legacy.Observaciones?.Trim(),
            IsPrinted = legacy.FueImpresa,
            PrintedAt = legacy.FueImpresa ? DateTime.UtcNow : null,
            IsCancelled = legacy.FueCancelada,
            CancelledAt = legacy.FueCancelada ? DateTime.UtcNow : null,
            CancellationReason = legacy.FueCancelada ? "Migrated as cancelled" : null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }
}

public static class DeliveryNoteMapper
{
    public static ModernDeliveryNote Map(LegacyRemito legacy)
    {
        // Fix invalid packages count: must be > 0 or NULL
        var packagesCount = legacy.Bultos;
        if (packagesCount.HasValue && packagesCount.Value <= 0)
        {
            packagesCount = null;  // Set to NULL instead of 0
        }
        
        // Fix invalid weight: must be > 0 or NULL
        var weightKg = legacy.Peso;
        if (weightKg.HasValue && weightKg.Value <= 0)
        {
            weightKg = null;  // Set to NULL instead of 0
        }
        
        return new ModernDeliveryNote
        {
            Id = legacy.IdRemito,
            DeliveryNumber = legacy.NumeroRemito.Trim(),
            SalesOrderId = legacy.IdNotaPedido,
            DeliveryDate = legacy.Fecha,
            TransporterId = legacy.IdTransportista,
            WeightKg = weightKg,
            PackagesCount = packagesCount,
            DeclaredValue = legacy.Valor,
            Notes = legacy.Observaciones?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }
}

