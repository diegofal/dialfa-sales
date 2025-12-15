'use client';

import { StockMovement } from '@/types/stockMovement';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Badge } from '@/components/ui/badge';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';

interface StockMovementsTableProps {
  movements: StockMovement[];
}

export function StockMovementsTable({ movements }: StockMovementsTableProps) {
  const getMovementTypeBadge = (movementType: number, quantity: number) => {
    const isPositive = quantity > 0;
    
    switch (movementType) {
      case 1: // Compra
        return <Badge variant="default" className="bg-green-600">Compra</Badge>;
      case 2: // Venta
        return <Badge variant="destructive">Venta</Badge>;
      case 3: // Devolución
        return <Badge variant="secondary" className="bg-blue-600 text-white">Devolución</Badge>;
      case 4: // Ajuste
        return (
          <Badge variant={isPositive ? "default" : "destructive"} className={isPositive ? "bg-yellow-600" : ""}>
            Ajuste
          </Badge>
        );
      case 5: // Transferencia
        return <Badge variant="outline">Transferencia</Badge>;
      default:
        return <Badge variant="secondary">Otro</Badge>;
    }
  };

  const formatQuantity = (quantity: number) => {
    const isPositive = quantity > 0;
    return (
      <span className={isPositive ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
        {isPositive ? '+' : ''}{quantity}
      </span>
    );
  };

  const formatRelativeDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistance(date, new Date(), { addSuffix: true, locale: es });
    } catch {
      return dateString;
    }
  };

  const formatAbsoluteDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead>Fecha</SortableTableHead>
            <SortableTableHead>Artículo</SortableTableHead>
            <SortableTableHead>Tipo</SortableTableHead>
            <SortableTableHead align="right">Cantidad</SortableTableHead>
            <SortableTableHead>Referencia</SortableTableHead>
            <SortableTableHead>Notas</SortableTableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No hay movimientos de stock para mostrar
              </TableCell>
            </TableRow>
          ) : (
            movements.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {formatRelativeDate(movement.movementDate)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatAbsoluteDate(movement.movementDate)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="max-w-md">
                    <p className="font-medium text-sm">{movement.articleCode}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {movement.articleDescription}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  {getMovementTypeBadge(movement.movementType, movement.quantity)}
                </TableCell>
                <TableCell className="text-right">
                  {formatQuantity(movement.quantity)}
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {movement.referenceDocument || '-'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {movement.notes || '-'}
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}




