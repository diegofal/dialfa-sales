'use client';

import { useState } from 'react';
import { useActivityLogs } from '@/lib/hooks/useActivityLogs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { OPERATION_LABELS, OPERATIONS } from '@/lib/constants/operations';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ActivityChangesDetail } from './ActivityChangesDetail';

export default function ActivityLogsTable() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [operation, setOperation] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
  const { data, isLoading } = useActivityLogs({
    page,
    limit,
    operation: operation === 'all' ? undefined : operation,
    search: search || undefined,
  });

  const toggleRow = (logId: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Buscar en descripción..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-full sm:w-60">
          <Select
            value={operation}
            onValueChange={(value) => {
              setOperation(value);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por operación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las operaciones</SelectItem>
              {Object.entries(OPERATION_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Fecha/Hora</TableHead>
              <TableHead className="w-[120px]">Usuario</TableHead>
              <TableHead className="w-[180px]">Operación</TableHead>
              <TableHead>Descripción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No se encontraron registros.
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((log) => {
                const isExpanded = expandedRows.has(log.id);
                
                return (
                  <>
                    <TableRow 
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleRow(log.id)}
                    >
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{log.username}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                          {OPERATION_LABELS[log.operation] || log.operation}
                        </span>
                      </TableCell>
                      <TableCell>{log.description}</TableCell>
                    </TableRow>
                    
                    {/* FILA EXPANDIDA CON DETALLES */}
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={4} className="p-0">
                          <ActivityChangesDetail 
                            activityLogId={log.id} 
                            isExpanded={isExpanded}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.pagination.total > limit && (
        <Pagination
          currentPage={page}
          totalCount={data.pagination.total}
          pageSize={limit}
          onPageChange={setPage}
          onPageSizeChange={setLimit}
        />
      )}
    </div>
  );
}

