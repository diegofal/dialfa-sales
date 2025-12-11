namespace Spisa.DataMigration.Mappers;

public static class CategoryMapper
{
    private static readonly Dictionary<string, int> _usedCodes = new Dictionary<string, int>();
    
    public static ModernCategory Map(LegacyCategoria legacy)
    {
        return new ModernCategory
        {
            Id = legacy.IdCategoria,
            Code = GenerateCategoryCode(legacy.IdCategoria, legacy.Descripcion),
            Name = legacy.Descripcion.Trim(),
            DefaultDiscountPercent = legacy.Descuento,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private static string GenerateCategoryCode(int id, string description)
    {
        // Try to generate code from first 3 letters of description
        var cleanName = new string(description.Where(char.IsLetter).ToArray());
        var baseCode = cleanName.Length >= 3 
            ? cleanName.Substring(0, 3).ToUpper() 
            : cleanName.ToUpper().PadRight(3, 'X');
        
        // If this code has been used before, append the ID to make it unique
        if (_usedCodes.ContainsKey(baseCode))
        {
            baseCode = $"{baseCode}{id}";
        }
        else
        {
            _usedCodes[baseCode] = 1;
        }
        
        // Ensure it's not too long (max 20 characters per schema)
        return baseCode.Length > 20 ? baseCode.Substring(0, 20) : baseCode;
    }
    
    // Call this to reset between migrations
    public static void ResetCodeCache()
    {
        _usedCodes.Clear();
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
            Stock = legacy.cantidad, // Changed from Quantity to Stock
            UnitPrice = legacy.preciounitario,
            CostPrice = null, // Not available in legacy system
            MinimumStock = 0, // Not available in legacy system
            IsDiscontinued = false, // Changed from IsActive=true to IsDiscontinued=false
            Location = null,
            Notes = null,
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
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }
}

public static class SalesOrderMapper
{
    public static ModernSalesOrder Map(LegacyNotaPedido legacy)
    {
        // Determine status based on whether invoices exist
        var status = "PENDING"; // Default - stored as string in EF
        
        // Fix invalid delivery dates (must be >= order_date)
        var deliveryDate = legacy.FechaEntrega;
        if (deliveryDate < legacy.FechaEmision)
        {
            deliveryDate = legacy.FechaEmision; // Use order date as delivery date
        }
        
        return new ModernSalesOrder
        {
            Id = legacy.IdNotaPedido,
            ClientId = legacy.IdCliente,
            OrderNumber = legacy.NumeroOrden.Trim(),
            OrderDate = legacy.FechaEmision,
            DeliveryDate = deliveryDate,
            Status = status, // Stored as string, not enum
            SpecialDiscountPercent = (decimal)legacy.DescuentoEspecial,
            Total = 0, // Will be calculated from items later
            Notes = legacy.Observaciones?.Trim(),
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
        // Legacy system doesn't have these fields, so we'll use defaults
        // In a real migration, you'd calculate these from order items
        decimal netAmount = 0; // Would need to calculate from sales_order_items
        decimal taxAmount = 0; // Would need to calculate based on tax rate
        decimal totalAmount = 0; // Would be net + tax
        
        return new ModernInvoice
        {
            Id = legacy.IdFactura,
            InvoiceNumber = legacy.NumeroFactura.ToString().PadLeft(12, '0'),
            SalesOrderId = legacy.IdNotaPedido,
            InvoiceDate = legacy.Fecha,
            NetAmount = netAmount,
            TaxAmount = taxAmount,
            TotalAmount = totalAmount,
            UsdExchangeRate = legacy.ValorDolar,
            IsPrinted = legacy.FueImpresa,
            PrintedAt = legacy.FueImpresa ? DateTime.UtcNow : null,
            IsCancelled = legacy.FueCancelada,
            CancelledAt = legacy.FueCancelada ? DateTime.UtcNow : null,
            CancellationReason = legacy.FueCancelada ? "Migrated as cancelled" : null,
            Notes = legacy.Observaciones?.Trim(),
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

// ============================================================================
// LOOKUP TABLE MAPPERS
// ============================================================================

public static class ProvinceMapper
{
    public static ModernProvince Map(LegacyProvincia legacy)
    {
        return new ModernProvince
        {
            Id = legacy.IdProvincia,
            Name = legacy.Provincia.Trim(),
            Code = null, // Not available in legacy
            CreatedAt = DateTime.UtcNow
        };
    }
}

public static class TaxConditionMapper
{
    public static ModernTaxCondition Map(LegacyCondicionIVA legacy)
    {
        return new ModernTaxCondition
        {
            Id = legacy.IdCondicionIVA,
            Name = legacy.CondicionIVA.Trim(),
            Description = null, // Not available in legacy
            CreatedAt = DateTime.UtcNow
        };
    }
}

public static class OperationTypeMapper
{
    public static ModernOperationType Map(LegacyOperatoria legacy)
    {
        return new ModernOperationType
        {
            Id = legacy.IdOperatoria,
            Name = legacy.Operatoria.Trim(),
            Description = null, // Not available in legacy
            CreatedAt = DateTime.UtcNow
        };
    }
}

public static class PaymentMethodMapper
{
    public static ModernPaymentMethod Map(LegacyFormaDePago legacy)
    {
        // Determine if this payment method requires check data
        var requiresCheckData = legacy.FormaDePago.Trim().ToLower().Contains("cheque");
        
        return new ModernPaymentMethod
        {
            Id = legacy.IdFormaDePago,
            Name = legacy.FormaDePago.Trim(),
            RequiresCheckData = requiresCheckData,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
    }
}

public static class TransporterMapper
{
    public static ModernTransporter Map(LegacyTransportista legacy)
    {
        return new ModernTransporter
        {
            Id = legacy.IdTransportista,
            Name = legacy.Transportista.Trim(),
            Address = legacy.Domicilio?.Trim(),
            Phone = null, // Not available in legacy
            Email = null, // Not available in legacy
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }
}

