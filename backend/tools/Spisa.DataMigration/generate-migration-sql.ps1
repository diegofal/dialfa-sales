#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Generates PostgreSQL SQL script from SQL Server data
.DESCRIPTION
    Exports data from SQL Server SPISA_Local and generates INSERT statements for PostgreSQL
.PARAMETER TestMode
    If specified, only generates 1 record per table for testing
#>

param(
    [switch]$TestMode = $false
)

$ErrorActionPreference = "Stop"

# Configuration
$SqlServerConnection = "Server=(local);Database=SPISA_Local;User Id=sa;Password=Transc0reTransc0re!;TrustServerCertificate=True;"
$OutputFile = "migration-script.sql"

if ($TestMode) {
    Write-Host "TEST MODE: Generating only 1 record per table" -ForegroundColor Yellow
}
Write-Host "Generating PostgreSQL migration script from SQL Server..." -ForegroundColor Cyan
Write-Host ""

# Start SQL script
$sql = @"
-- ============================================================================
-- SPISA Data Migration Script
-- Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
-- Source: SQL Server SPISA_Local
-- Target: PostgreSQL
-- Mode: $(if ($TestMode) { "TEST (1 record per table)" } else { "FULL" })
-- ============================================================================

-- Disable triggers during import
SET session_replication_role = 'replica';

-- Clear existing data (in reverse dependency order)
TRUNCATE TABLE 
    delivery_notes,
    invoices,
    sales_order_items,
    sales_orders,
    client_discounts,
    clients,
    articles,
    categories,
    transporters,
    payment_methods,
    operation_types,
    tax_conditions,
    provinces
RESTART IDENTITY CASCADE;

"@

# Helper function to format SQL value
function Format-SqlValue {
    param($value, [string]$type)
    
    if ($value -is [DBNull] -or $null -eq $value) {
        return "NULL"
    }
    
    switch ($type) {
        "string" {
            $escaped = $value.ToString().Replace("'", "''")
            return "'$escaped'"
        }
        "number" { return $value.ToString() }
        "bool" {
            return if ($value) { "TRUE" } else { "FALSE" }
        }
        "datetime" {
            if ($value -is [DateTime]) {
                return "'$($value.ToString("yyyy-MM-dd HH:mm:ss"))'"
            }
            return "NULL"
        }
        default { return "NULL" }
    }
}

Write-Host "Connecting to SQL Server..." -ForegroundColor Yellow
$connection = New-Object System.Data.SqlClient.SqlConnection($SqlServerConnection)
$connection.Open()

# Table mapping: SQL Server table -> PostgreSQL table with column mappings
$tables = @(
    @{
        Source = "Provincias"
        Target = "provinces"
        Columns = @(
            @{Source="IdProvincia"; Target="id"; Type="number"}
            @{Source="Provincia"; Target="name"; Type="string"}
        )
        ExtraColumns = @(
            @{Target="created_at"; Value="CURRENT_TIMESTAMP"}
        )
    },
    @{
        Source = "CondicionesIVA"
        Target = "tax_conditions"
        Columns = @(
            @{Source="IdCondicionIVA"; Target="id"; Type="number"}
            @{Source="CondicionIVA"; Target="name"; Type="string"}
        )
        ExtraColumns = @(
            @{Target="created_at"; Value="CURRENT_TIMESTAMP"}
        )
    },
    @{
        Source = "Operatorias"
        Target = "operation_types"
        Columns = @(
            @{Source="IdOperatoria"; Target="id"; Type="number"}
            @{Source="Operatoria"; Target="name"; Type="string"}
        )
        ExtraColumns = @(
            @{Target="created_at"; Value="CURRENT_TIMESTAMP"}
        )
    },
    @{
        Source = "FormasDePago"
        Target = "payment_methods"
        Columns = @(
            @{Source="IdFormaDePago"; Target="id"; Type="number"}
            @{Source="FormaDePago"; Target="name"; Type="string"}
        )
        ExtraColumns = @(
            @{Target="created_at"; Value="CURRENT_TIMESTAMP"}
        )
    },
    @{
        Source = "Transportistas"
        Target = "transporters"
        Columns = @(
            @{Source="IdTransportista"; Target="id"; Type="number"}
            @{Source="Transportista"; Target="name"; Type="string"}
            @{Source="Domicilio"; Target="address"; Type="string"}
        )
        ExtraColumns = @(
            @{Target="phone"; Value="NULL"}
            @{Target="email"; Value="NULL"}
            @{Target="is_active"; Value="TRUE"}
            @{Target="created_at"; Value="CURRENT_TIMESTAMP"}
            @{Target="updated_at"; Value="CURRENT_TIMESTAMP"}
        )
    },
    @{
        Source = "Categorias"
        Target = "categories"
        Columns = @(
            @{Source="IdCategoria"; Target="id"; Type="number"}
            @{Source="Descripcion"; Target="name"; Type="string"}
            @{Source="Descuento"; Target="default_discount_percent"; Type="number"}
        )
        ComputedColumns = @(
            @{Target="code"; Expression={ param($reader) "CAT$($reader['IdCategoria'])" }}
        )
        ExtraColumns = @(
            @{Target="is_active"; Value="TRUE"}
            @{Target="created_at"; Value="CURRENT_TIMESTAMP"}
            @{Target="updated_at"; Value="CURRENT_TIMESTAMP"}
        )
    },
    @{
        Source = "Articulos"
        Target = "articles"
        Columns = @(
            @{Source="IdArticulo"; Target="id"; Type="number"}
            @{Source="IdCategoria"; Target="category_id"; Type="number"}
            @{Source="Descripcion"; Target="description"; Type="string"}
        )
        ComputedColumns = @(
            @{Target="code"; Expression={ param($reader) 
                $code = $reader['CodArticulo']
                if ($code -is [DBNull] -or [string]::IsNullOrWhiteSpace($code)) {
                    "ART$($reader['IdArticulo'])"
                } else {
                    $code.ToString()
                }
            }}
            @{Target="unit_price"; Expression={ param($reader) 
                $price = $reader['PrecioLista']
                if ($price -is [DBNull] -or $null -eq $price) {
                    "0"
                } else {
                    $price.ToString()
                }
            }; NoQuote=$true}
            @{Target="stock"; Expression={ param($reader) 
                $stock = $reader['Stock']
                if ($stock -is [DBNull] -or $null -eq $stock) {
                    "0"
                } else {
                    $stock.ToString()
                }
            }; NoQuote=$true}
        )
        ExtraColumns = @(
            @{Target="cost_price"; Value="NULL"}
            @{Target="minimum_stock"; Value="0"}
            @{Target="location"; Value="NULL"}
            @{Target="is_discontinued"; Value="FALSE"}
            @{Target="notes"; Value="NULL"}
            @{Target="created_at"; Value="CURRENT_TIMESTAMP"}
            @{Target="updated_at"; Value="CURRENT_TIMESTAMP"}
        )
    },
    @{
        Source = "Clientes"
        Target = "clients"
        Columns = @(
            @{Source="IdCliente"; Target="id"; Type="number"}
            @{Source="IdProvincia"; Target="province_id"; Type="number"}
            @{Source="IdCondicionIVA"; Target="tax_condition_id"; Type="number"}
            @{Source="IdOperatoria"; Target="operation_type_id"; Type="number"}
            @{Source="Domicilio"; Target="address"; Type="string"}
            @{Source="Telefono"; Target="phone"; Type="string"}
            @{Source="Email"; Target="email"; Type="string"}
            @{Source="CUIT"; Target="cuit"; Type="string"}
        )
        ComputedColumns = @(
            @{Target="code"; Expression={ param($reader) "CLI$($reader['IdCliente'])" }}
            @{Target="business_name"; Expression={ param($reader) 
                $name = $reader['Nombre']
                if ($name -is [DBNull] -or [string]::IsNullOrWhiteSpace($name)) {
                    "Cliente $($reader['IdCliente'])"
                } else {
                    $name.ToString()
                }
            }}
            @{Target="is_active"; Expression={ param($reader) 
                $active = $reader['Activo']
                if ($active -is [DBNull] -or $null -eq $active) {
                    "TRUE"
                } else {
                    if ($active) { "TRUE" } else { "FALSE" }
                }
            }; NoQuote=$true}
        )
        ExtraColumns = @(
            @{Target="city"; Value="NULL"}
            @{Target="postal_code"; Value="NULL"}
            @{Target="transporter_id"; Value="NULL"}
            @{Target="credit_limit"; Value="NULL"}
            @{Target="current_balance"; Value="0"}
            @{Target="created_at"; Value="CURRENT_TIMESTAMP"}
            @{Target="updated_at"; Value="CURRENT_TIMESTAMP"}
        )
    },
    @{
        Source = "Descuentos"
        Target = "client_discounts"
        Columns = @(
            @{Source="IdCliente"; Target="client_id"; Type="number"}
            @{Source="IdCategoria"; Target="category_id"; Type="number"}
            @{Source="Descuento"; Target="discount_percent"; Type="number"}
        )
        ExtraColumns = @(
            @{Target="created_at"; Value="CURRENT_TIMESTAMP"}
            @{Target="updated_at"; Value="CURRENT_TIMESTAMP"}
        )
        SkipIds = $true
    },
    @{
        Source = "NotaPedidos"
        Target = "sales_orders"
        Columns = @(
            @{Source="IdNotaPedido"; Target="id"; Type="number"}
            @{Source="IdCliente"; Target="client_id"; Type="number"}
            @{Source="FechaEntrega"; Target="delivery_date"; Type="datetime"}
            @{Source="DescuentoEspecial"; Target="special_discount_percent"; Type="number"}
            @{Source="Observaciones"; Target="notes"; Type="string"}
        )
        ComputedColumns = @(
            @{Target="order_number"; Expression={ param($reader) $reader['IdNotaPedido'].ToString().PadLeft(8, '0') }}
            @{Target="order_date"; Expression={ param($reader) 
                $date = $reader['Fecha']
                if ($date -is [DBNull] -or $null -eq $date) {
                    "'$((Get-Date).ToString("yyyy-MM-dd HH:mm:ss"))'"
                } else {
                    "'$($date.ToString("yyyy-MM-dd HH:mm:ss"))'"
                }
            }; NoQuote=$true}
            @{Target="total"; Expression={ param($reader) 
                $total = $reader['Total']
                if ($total -is [DBNull] -or $null -eq $total) {
                    "0"
                } else {
                    $total.ToString()
                }
            }; NoQuote=$true}
        )
        ExtraColumns = @(
            @{Target="status"; Value="'PENDING'"}
            @{Target="created_at"; Value="CURRENT_TIMESTAMP"}
            @{Target="updated_at"; Value="CURRENT_TIMESTAMP"}
        )
    },
    @{
        Source = "NotaPedido_Items"
        Target = "sales_order_items"
        Columns = @(
            @{Source="IdNotaPedido"; Target="sales_order_id"; Type="number"}
            @{Source="IdArticulo"; Target="article_id"; Type="number"}
        )
        ComputedColumns = @(
            @{Target="quantity"; Expression={ param($reader) 
                $qty = $reader['Cantidad']
                if ($qty -is [DBNull] -or $null -eq $qty) {
                    "1"
                } else {
                    [int]$qty
                }
            }; NoQuote=$true}
            @{Target="unit_price"; Expression={ param($reader) 
                $price = $reader['PrecioUnitario']
                if ($price -is [DBNull] -or $null -eq $price) {
                    "0"
                } else {
                    $price.ToString()
                }
            }; NoQuote=$true}
            @{Target="discount_percent"; Expression={ param($reader) 
                $discount = $reader['Descuento']
                if ($discount -is [DBNull] -or $null -eq $discount) {
                    "0"
                } else {
                    $discount.ToString()
                }
            }; NoQuote=$true}
        )
        ExtraColumns = @(
            @{Target="line_total"; Value="0"}
            @{Target="created_at"; Value="CURRENT_TIMESTAMP"}
        )
        SkipIds = $true
    },
    @{
        Source = "Facturas"
        Target = "invoices"
        Columns = @(
            @{Source="IdFactura"; Target="id"; Type="number"}
            @{Source="IdNotaPedido"; Target="sales_order_id"; Type="number"}
            @{Source="CotizacionDolar"; Target="usd_exchange_rate"; Type="number"}
            @{Source="FechaImpresion"; Target="printed_at"; Type="datetime"}
            @{Source="FechaAnulacion"; Target="cancelled_at"; Type="datetime"}
            @{Source="MotivoAnulacion"; Target="cancellation_reason"; Type="string"}
            @{Source="Observaciones"; Target="notes"; Type="string"}
        )
        ComputedColumns = @(
            @{Target="invoice_number"; Expression={ param($reader) 
                $num = $reader['NroFactura']
                if ($num -is [DBNull] -or [string]::IsNullOrWhiteSpace($num)) {
                    "INV$($reader['IdFactura'])"
                } else {
                    $num.ToString()
                }
            }}
            @{Target="invoice_date"; Expression={ param($reader) 
                $date = $reader['Fecha']
                if ($date -is [DBNull] -or $null -eq $date) {
                    "'$((Get-Date).ToString("yyyy-MM-dd HH:mm:ss"))'"
                } else {
                    "'$($date.ToString("yyyy-MM-dd HH:mm:ss"))'"
                }
            }; NoQuote=$true}
            @{Target="is_printed"; Expression={ param($reader) 
                $printed = $reader['Impreso']
                if ($printed -is [DBNull] -or $null -eq $printed) {
                    "FALSE"
                } else {
                    if ($printed) { "TRUE" } else { "FALSE" }
                }
            }; NoQuote=$true}
            @{Target="is_cancelled"; Expression={ param($reader) 
                $cancelled = $reader['Anulada']
                if ($cancelled -is [DBNull] -or $null -eq $cancelled) {
                    "FALSE"
                } else {
                    if ($cancelled) { "TRUE" } else { "FALSE" }
                }
            }; NoQuote=$true}
        )
        ExtraColumns = @(
            @{Target="net_amount"; Value="0"}
            @{Target="tax_amount"; Value="0"}
            @{Target="total_amount"; Value="0"}
            @{Target="created_at"; Value="CURRENT_TIMESTAMP"}
            @{Target="updated_at"; Value="CURRENT_TIMESTAMP"}
        )
    },
    @{
        Source = "Remitos"
        Target = "delivery_notes"
        Columns = @(
            @{Source="IdRemito"; Target="id"; Type="number"}
            @{Source="IdNotaPedido"; Target="sales_order_id"; Type="number"}
            @{Source="IdTransportista"; Target="transporter_id"; Type="number"}
            @{Source="Observaciones"; Target="notes"; Type="string"}
        )
        ComputedColumns = @(
            @{Target="delivery_number"; Expression={ param($reader) 
                $num = $reader['NroRemito']
                if ($num -is [DBNull] -or [string]::IsNullOrWhiteSpace($num)) {
                    "DN$($reader['IdRemito'])"
                } else {
                    $num.ToString()
                }
            }}
            @{Target="delivery_date"; Expression={ param($reader) 
                $date = $reader['Fecha']
                if ($date -is [DBNull] -or $null -eq $date) {
                    "'$((Get-Date).ToString("yyyy-MM-dd HH:mm:ss"))'"
                } else {
                    "'$($date.ToString("yyyy-MM-dd HH:mm:ss"))'"
                }
            }; NoQuote=$true}
        )
        ExtraColumns = @(
            @{Target="weight_kg"; Value="NULL"}
            @{Target="packages_count"; Value="NULL"}
            @{Target="declared_value"; Value="NULL"}
            @{Target="created_at"; Value="CURRENT_TIMESTAMP"}
            @{Target="updated_at"; Value="CURRENT_TIMESTAMP"}
        )
    }
)

foreach ($tableMap in $tables) {
    $sourceTable = $tableMap.Source
    $targetTable = $tableMap.Target
    
    Write-Host "Processing $sourceTable -> $targetTable..." -ForegroundColor Green
    
    $sql += "`n-- ============================================================================`n"
    $sql += "-- Migrating: $targetTable`n"
    $sql += "-- ============================================================================`n`n"
    
    # Read data from SQL Server
    $query = if ($TestMode) {
        "SELECT TOP 1 * FROM $sourceTable"
    } else {
        "SELECT * FROM $sourceTable"
    }
    $command = New-Object System.Data.SqlClient.SqlCommand($query, $connection)
    $reader = $command.ExecuteReader()
    
    $recordCount = 0
    while ($reader.Read()) {
        $recordCount++
        
        # Build column names and values
        $columns = @($tableMap.Columns | ForEach-Object { $_.Target })
        $values = @($tableMap.Columns | ForEach-Object {
            $sourceCol = $_.Source
            $type = $_.Type
            Format-SqlValue $reader[$sourceCol] $type
        })
        
        # Add computed columns if specified
        if ($tableMap.ComputedColumns) {
            foreach ($computedCol in $tableMap.ComputedColumns) {
                $columns += $computedCol.Target
                $computedValue = & $computedCol.Expression $reader
                # Check if the value should NOT be quoted (for SQL keywords and numbers)
                if ($computedCol.NoQuote) {
                    $values += $computedValue
                } else {
                    $values += "'$computedValue'"
                }
            }
        }
        
        # Add extra columns if specified
        if ($tableMap.ExtraColumns) {
            foreach ($extraCol in $tableMap.ExtraColumns) {
                $columns += $extraCol.Target
                $values += $extraCol.Value
            }
        }
        
        $columnList = $columns -join ", "
        $valueList = $values -join ", "
        
        # Generate INSERT statement
        $sql += "INSERT INTO $targetTable ($columnList) VALUES ($valueList);`n"
        
        # Show progress for each record
        Write-Host "  [$recordCount] $targetTable" -NoNewline
        if ($recordCount % 10 -eq 0) {
            Write-Host "" # New line every 10 records
        } else {
            Write-Host " " -NoNewline
        }
        
        # Add batch separator every 100 records
        if ($recordCount % 100 -eq 0) {
            $sql += "-- Inserted $recordCount records so far...`n"
        }
    }
    
    $reader.Close()
    
    Write-Host "  -> Generated $recordCount INSERT statements" -ForegroundColor Gray
    
    # Reset sequence if not skipping IDs
    if (-not $tableMap.SkipIds) {
        $sequenceName = "$($targetTable)_id_seq"
        $sql += "`nSELECT setval('$sequenceName', COALESCE((SELECT MAX(id) FROM $targetTable), 1));`n"
    }
}

$connection.Close()

# Re-enable triggers
$sql += @"

-- Re-enable triggers
SET session_replication_role = 'origin';

-- ============================================================================
-- Migration Complete
-- ============================================================================
"@

Write-Host ""
Write-Host "Writing SQL script to $OutputFile..." -ForegroundColor Yellow
[System.IO.File]::WriteAllText("$(Get-Location)\$OutputFile", $sql, [System.Text.Encoding]::UTF8)

$fileSizeKB = (Get-Item $OutputFile).Length / 1KB
Write-Host "[OK] Generated $OutputFile ($([math]::Round($fileSizeKB, 2)) KB)" -ForegroundColor Green
Write-Host ""
Write-Host "To execute on PostgreSQL:" -ForegroundColor Cyan
Write-Host "  psql -h shinkansen.proxy.rlwy.net -p 36395 -U postgres -d railway -f $OutputFile" -ForegroundColor White
Write-Host ""
