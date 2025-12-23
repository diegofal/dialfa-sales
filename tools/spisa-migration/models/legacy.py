"""Legacy SQL Server entity models (matching old schema)."""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class LegacyCategoria:
    IdCategoria: int
    Descripcion: str
    Descuento: int


@dataclass
class LegacyArticulo:
    idArticulo: int
    IdCategoria: int
    codigo: str
    descripcion: str
    cantidad: float
    preciounitario: float
    # Additional fields found in production database
    orden: Optional[str]  # display_order
    discontinuado: Optional[bool]  # is_discontinued
    tipo: Optional[str]  # type
    serie: Optional[int]  # series
    espesor: Optional[str]  # thickness
    size: Optional[str]  # size
    proveedor: Optional[int]  # supplier_id
    peso: Optional[float]  # weight_kg
    precio_unitario_historico_1: Optional[float]  # historical_price1


@dataclass
class LegacyCliente:
    IdCliente: int
    Codigo: str
    RazonSocial: str
    Domicilio: Optional[str]
    Localidad: Optional[str]
    IdProvincia: int
    IdCondicionIVA: int
    CUIT: str
    IdOperatoria: int
    Saldo: float
    IdTransportista: Optional[int]
    IdVendedor: Optional[int]  # seller_id - additional field


@dataclass
class LegacyDescuento:
    IdCliente: int
    IdCategoria: int
    Descuento: int


@dataclass
class LegacyNotaPedido:
    IdNotaPedido: int
    IdCliente: int
    FechaEmision: datetime
    FechaEntrega: Optional[datetime]
    NumeroOrden: str
    Observaciones: Optional[str]
    DescuentoEspecial: float


@dataclass
class LegacyNotaPedidoItem:
    IdNotaPedido: int
    IdArticulo: int
    Cantidad: float
    PrecioUnitario: Optional[float]
    Descuento: Optional[float]


@dataclass
class LegacyFactura:
    IdFactura: int
    IdNotaPedido: int
    NumeroFactura: int
    Fecha: datetime
    Observaciones: Optional[str]
    FueImpresa: bool
    ValorDolar: Optional[float]
    FueCancelada: bool
    EsNotaDeCredito: bool  # is_credit_note - additional field
    Cotizacion: bool  # is_quotation - additional field


@dataclass
class LegacyRemito:
    IdRemito: int
    IdNotaPedido: int
    NumeroRemito: str
    Fecha: datetime
    Observaciones: Optional[str]
    IdTransportista: Optional[int]
    Peso: Optional[float]
    Bultos: Optional[int]
    Valor: Optional[float]


# Lookup table models
@dataclass
class LegacyProvincia:
    IdProvincia: int
    Provincia: str


@dataclass
class LegacyCondicionIVA:
    IdCondicionIVA: int
    CondicionIVA: str


@dataclass
class LegacyOperatoria:
    IdOperatoria: int
    Operatoria: str


@dataclass
class LegacyFormaDePago:
    IdFormaDePago: int
    FormaDePago: str


@dataclass
class LegacyTransportista:
    IdTransportista: int
    Transportista: str
    Domicilio: Optional[str]


