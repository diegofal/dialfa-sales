namespace Spisa.DataMigration.Mappers;

// Legacy SQL Server entity models (matching old schema)

public class LegacyCategoria
{
    public int IdCategoria { get; set; }
    public string Descripcion { get; set; } = string.Empty;
    public int Descuento { get; set; }
}

public class LegacyArticulo
{
    public int idArticulo { get; set; }
    public int IdCategoria { get; set; }
    public string codigo { get; set; } = string.Empty;
    public string descripcion { get; set; } = string.Empty;
    public decimal cantidad { get; set; }
    public decimal preciounitario { get; set; }
}

public class LegacyCliente
{
    public int IdCliente { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string RazonSocial { get; set; } = string.Empty;
    public string? Domicilio { get; set; }
    public string? Localidad { get; set; }
    public int IdProvincia { get; set; }
    public int IdCondicionIVA { get; set; }
    public string CUIT { get; set; } = string.Empty;
    public int IdOperatoria { get; set; }
    public decimal Saldo { get; set; }
    public int? IdTransportista { get; set; }
}

public class LegacyDescuento
{
    public int IdCliente { get; set; }
    public int IdCategoria { get; set; }
    public int Descuento { get; set; }
}

public class LegacyNotaPedido
{
    public int IdNotaPedido { get; set; }
    public int IdCliente { get; set; }
    public DateTime FechaEmision { get; set; }
    public DateTime? FechaEntrega { get; set; }
    public string NumeroOrden { get; set; } = string.Empty;
    public string? Observaciones { get; set; }
    public double DescuentoEspecial { get; set; }
}

public class LegacyNotaPedidoItem
{
    public int IdNotaPedido { get; set; }
    public int IdArticulo { get; set; }
    public decimal Cantidad { get; set; }
    public decimal? PrecioUnitario { get; set; }
    public decimal? Descuento { get; set; }
}

public class LegacyFactura
{
    public int IdFactura { get; set; }
    public int IdNotaPedido { get; set; }
    public int NumeroFactura { get; set; }
    public DateTime Fecha { get; set; }
    public string? Observaciones { get; set; }
    public bool FueImpresa { get; set; }
    public decimal? ValorDolar { get; set; }
    public bool FueCancelada { get; set; }
}

public class LegacyRemito
{
    public int IdRemito { get; set; }
    public int IdNotaPedido { get; set; }
    public string NumeroRemito { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
    public string? Observaciones { get; set; }
    public int? IdTransportista { get; set; }
    public decimal? Peso { get; set; }
    public int? Bultos { get; set; }
    public decimal? Valor { get; set; }
}

// Lookup table models
public class LegacyProvincia
{  v 
    public int IdProvincia { get; set; }
    public string Provincia { get; set; } = string.Empty;
}

public class LegacyCondicionIVA
{
    public int IdCondicionIVA { get; set; }
    public string CondicionIVA { get; set; } = string.Empty;
}

public class LegacyOperatoria
{
    public int IdOperatoria { get; set; }
    public string Operatoria { get; set; } = string.Empty;
}

public class LegacyFormaDePago
{
    public int IdFormaDePago { get; set; }
    public string FormaDePago { get; set; } = string.Empty;
}

public class LegacyTransportista
{
    public int IdTransportista { get; set; }
    public string Transportista { get; set; } = string.Empty;
    public string? Domicilio { get; set; }
}

