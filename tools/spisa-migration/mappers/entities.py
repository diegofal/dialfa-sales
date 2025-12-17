"""Entity mappers from legacy to modern format."""
from datetime import datetime
from typing import Dict
import re

from models.legacy import *
from models.modern import *


# Category code cache to ensure uniqueness
_category_code_cache: Dict[str, int] = {}


def reset_category_code_cache():
    """Reset category code cache between migrations."""
    _category_code_cache.clear()


def generate_category_code(id: int, description: str) -> str:
    """Generate unique category code from description."""
    # Extract letters only
    clean_name = ''.join(c for c in description if c.isalpha())
    
    # Use first 3 letters or pad with X
    base_code = clean_name[:3].upper() if len(clean_name) >= 3 else clean_name.upper().ljust(3, 'X')
    
    # If code already used, append ID
    if base_code in _category_code_cache:
        base_code = f"{base_code}{id}"
    else:
        _category_code_cache[base_code] = 1
    
    # Ensure max 20 characters
    return base_code[:20]


def clean_cuit(cuit: str) -> str:
    """Clean and validate CUIT format."""
    # Remove all non-numeric characters
    cleaned = ''.join(c for c in cuit if c.isdigit())
    
    # Pad to 11 digits or truncate
    if len(cleaned) < 11:
        cleaned = cleaned.zfill(11)
    elif len(cleaned) > 11:
        cleaned = cleaned[:11]
    
    return cleaned


# Lookup table mappers
def map_province(legacy: LegacyProvincia) -> ModernProvince:
    """Map province from legacy to modern."""
    return ModernProvince(
        id=legacy.IdProvincia,
        name=legacy.Provincia.strip(),
        code=None,
        created_at=datetime.utcnow()
    )


def map_tax_condition(legacy: LegacyCondicionIVA) -> ModernTaxCondition:
    """Map tax condition from legacy to modern."""
    return ModernTaxCondition(
        id=legacy.IdCondicionIVA,
        name=legacy.CondicionIVA.strip(),
        description=None,
        created_at=datetime.utcnow()
    )


def map_operation_type(legacy: LegacyOperatoria) -> ModernOperationType:
    """Map operation type from legacy to modern."""
    return ModernOperationType(
        id=legacy.IdOperatoria,
        name=legacy.Operatoria.strip(),
        description=None,
        created_at=datetime.utcnow()
    )


def map_payment_method(legacy: LegacyFormaDePago) -> ModernPaymentMethod:
    """Map payment method from legacy to modern."""
    # Determine if requires check data
    requires_check = 'cheque' in legacy.FormaDePago.lower()
    
    return ModernPaymentMethod(
        id=legacy.IdFormaDePago,
        name=legacy.FormaDePago.strip(),
        requires_check_data=requires_check,
        is_active=True,
        created_at=datetime.utcnow()
    )


def map_transporter(legacy: LegacyTransportista) -> ModernTransporter:
    """Map transporter from legacy to modern."""
    return ModernTransporter(
        id=legacy.IdTransportista,
        name=legacy.Transportista.strip(),
        address=legacy.Domicilio.strip() if legacy.Domicilio else None,
        phone=None,
        email=None,
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )


# Main entity mappers
def map_category(legacy: LegacyCategoria) -> ModernCategory:
    """Map category from legacy to modern."""
    return ModernCategory(
        id=legacy.IdCategoria,
        code=generate_category_code(legacy.IdCategoria, legacy.Descripcion),
        name=legacy.Descripcion.strip(),
        description=None,
        default_discount_percent=float(legacy.Descuento),
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )


def map_article(legacy: LegacyArticulo) -> ModernArticle:
    """Map article from legacy to modern."""
    return ModernArticle(
        id=legacy.idArticulo,
        category_id=legacy.IdCategoria,
        code=legacy.codigo.strip(),
        description=legacy.descripcion.strip(),
        stock=float(legacy.cantidad),
        unit_price=float(legacy.preciounitario),
        cost_price=None,
        minimum_stock=0.0,
        is_discontinued=False,
        location=None,
        notes=None,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )


def map_client(legacy: LegacyCliente) -> ModernClient:
    """Map client from legacy to modern."""
    # Handle Codigo - can be int or str
    code = str(legacy.Codigo).strip() if legacy.Codigo else "0"
    
    return ModernClient(
        id=legacy.IdCliente,
        code=code,
        business_name=legacy.RazonSocial.strip(),
        cuit=clean_cuit(legacy.CUIT),
        address=legacy.Domicilio.strip() if legacy.Domicilio else None,
        city=legacy.Localidad.strip() if legacy.Localidad else None,
        province_id=legacy.IdProvincia,
        postal_code=None,
        phone=None,
        email=None,
        tax_condition_id=legacy.IdCondicionIVA,
        operation_type_id=legacy.IdOperatoria,
        transporter_id=legacy.IdTransportista,
        credit_limit=None,
        current_balance=float(legacy.Saldo),
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )


def map_client_discount(legacy: LegacyDescuento) -> ModernClientDiscount:
    """Map client discount from legacy to modern."""
    return ModernClientDiscount(
        client_id=legacy.IdCliente,
        category_id=legacy.IdCategoria,
        discount_percent=float(legacy.Descuento),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )


def map_sales_order(legacy: LegacyNotaPedido) -> ModernSalesOrder:
    """Map sales order from legacy to modern."""
    # Fix invalid delivery dates (must be >= order_date)
    delivery_date = legacy.FechaEntrega
    if delivery_date and delivery_date < legacy.FechaEmision:
        delivery_date = legacy.FechaEmision
    
    # Handle NumeroOrden - can be int or str
    order_number = str(legacy.NumeroOrden).strip() if legacy.NumeroOrden else "0"
    
    return ModernSalesOrder(
        id=legacy.IdNotaPedido,
        client_id=legacy.IdCliente,
        order_number=order_number,
        order_date=legacy.FechaEmision,
        delivery_date=delivery_date,
        status='PENDING',
        special_discount_percent=float(legacy.DescuentoEspecial),
        total=0.0,  # Will be calculated from items
        notes=legacy.Observaciones.strip() if legacy.Observaciones else None,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )


def map_sales_order_item(legacy: LegacyNotaPedidoItem) -> ModernSalesOrderItem:
    """Map sales order item from legacy to modern."""
    unit_price = float(legacy.PrecioUnitario) if legacy.PrecioUnitario else 0.0
    discount = float(legacy.Descuento) if legacy.Descuento else 0.0
    
    # Fix invalid discounts
    if discount < 0 or discount > 100:
        discount = 0.0
    
    quantity = float(legacy.Cantidad)
    
    # Fix invalid quantities
    if quantity <= 0:
        quantity = 1.0
    
    # Calculate line total
    line_total = quantity * unit_price * (1 - (discount / 100))
    
    return ModernSalesOrderItem(
        sales_order_id=legacy.IdNotaPedido,
        article_id=legacy.IdArticulo,
        quantity=quantity,
        unit_price=unit_price,
        discount_percent=discount,
        line_total=line_total,
        created_at=datetime.utcnow()
    )


def map_invoice(legacy: LegacyFactura) -> ModernInvoice:
    """Map invoice from legacy to modern."""
    # Legacy doesn't have these fields, use defaults
    net_amount = 0.0
    tax_amount = 0.0
    total_amount = 0.0
    
    return ModernInvoice(
        id=legacy.IdFactura,
        invoice_number=str(legacy.NumeroFactura).zfill(12),
        sales_order_id=legacy.IdNotaPedido,
        invoice_date=legacy.Fecha,
        net_amount=net_amount,
        tax_amount=tax_amount,
        total_amount=total_amount,
        usd_exchange_rate=float(legacy.ValorDolar) if legacy.ValorDolar else None,
        is_printed=legacy.FueImpresa,
        printed_at=datetime.utcnow() if legacy.FueImpresa else None,
        is_cancelled=legacy.FueCancelada,
        cancelled_at=datetime.utcnow() if legacy.FueCancelada else None,
        cancellation_reason='Migrated as cancelled' if legacy.FueCancelada else None,
        notes=legacy.Observaciones.strip() if legacy.Observaciones else None,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )


def map_delivery_note(legacy: LegacyRemito) -> ModernDeliveryNote:
    """Map delivery note from legacy to modern."""
    # Fix invalid packages count
    packages = legacy.Bultos
    if packages is not None and packages <= 0:
        packages = None
    
    # Fix invalid weight
    weight = legacy.Peso
    if weight is not None and weight <= 0:
        weight = None
    
    # Handle NumeroRemito - can be int or str
    delivery_number = str(legacy.NumeroRemito).strip() if legacy.NumeroRemito else "0"
    
    return ModernDeliveryNote(
        id=legacy.IdRemito,
        delivery_number=delivery_number,
        sales_order_id=legacy.IdNotaPedido,
        delivery_date=legacy.Fecha,
        transporter_id=legacy.IdTransportista,
        weight_kg=float(weight) if weight else None,
        packages_count=packages,
        declared_value=float(legacy.Valor) if legacy.Valor else None,
        notes=legacy.Observaciones.strip() if legacy.Observaciones else None,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

