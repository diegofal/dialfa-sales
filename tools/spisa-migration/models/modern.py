"""Modern PostgreSQL entity models (for data writing)."""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class ModernCategory:
    id: int
    code: str
    name: str
    description: Optional[str]
    default_discount_percent: float
    is_active: bool
    created_at: datetime
    updated_at: datetime


@dataclass
class ModernArticle:
    id: int
    category_id: int
    code: str
    description: str
    stock: float
    unit_price: float
    cost_price: Optional[float]
    minimum_stock: float
    is_discontinued: bool
    location: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


@dataclass
class ModernClient:
    id: int
    code: str
    business_name: str
    cuit: str
    address: Optional[str]
    city: Optional[str]
    province_id: int
    postal_code: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    tax_condition_id: int
    operation_type_id: int
    transporter_id: Optional[int]
    credit_limit: Optional[float]
    current_balance: float
    is_active: bool
    created_at: datetime
    updated_at: datetime


@dataclass
class ModernClientDiscount:
    client_id: int
    category_id: int
    discount_percent: float
    created_at: datetime
    updated_at: datetime


@dataclass
class ModernSalesOrder:
    id: int
    client_id: int
    order_number: str
    order_date: datetime
    delivery_date: Optional[datetime]
    status: str
    special_discount_percent: float
    total: float
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


@dataclass
class ModernSalesOrderItem:
    sales_order_id: int
    article_id: int
    quantity: float
    unit_price: float
    discount_percent: float
    line_total: float
    created_at: datetime


@dataclass
class ModernInvoice:
    id: int
    invoice_number: str
    sales_order_id: int
    invoice_date: datetime
    net_amount: float
    tax_amount: float
    total_amount: float
    usd_exchange_rate: Optional[float]
    is_printed: bool
    printed_at: Optional[datetime]
    is_cancelled: bool
    cancelled_at: Optional[datetime]
    cancellation_reason: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


@dataclass
class ModernDeliveryNote:
    id: int
    delivery_number: str
    sales_order_id: int
    delivery_date: datetime
    transporter_id: Optional[int]
    weight_kg: Optional[float]
    packages_count: Optional[int]
    declared_value: Optional[float]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


# Lookup tables
@dataclass
class ModernProvince:
    id: int
    name: str
    code: Optional[str]
    created_at: datetime


@dataclass
class ModernTaxCondition:
    id: int
    name: str
    description: Optional[str]
    created_at: datetime


@dataclass
class ModernOperationType:
    id: int
    name: str
    description: Optional[str]
    created_at: datetime


@dataclass
class ModernPaymentMethod:
    id: int
    name: str
    requires_check_data: bool
    is_active: bool
    created_at: datetime


@dataclass
class ModernTransporter:
    id: int
    name: str
    address: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime


@dataclass
class ModernInvoiceItem:
    invoice_id: int
    sales_order_item_id: Optional[int]
    article_id: int
    article_code: str
    article_description: str
    quantity: int
    unit_price_usd: float
    unit_price_ars: float
    discount_percent: float
    line_total: float
    created_at: datetime


@dataclass
class ModernDeliveryNoteItem:
    delivery_note_id: int
    sales_order_item_id: Optional[int]
    article_id: int
    article_code: str
    article_description: str
    quantity: int
    created_at: datetime

