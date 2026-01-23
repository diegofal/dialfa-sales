'use client';

import { Badge } from '@/components/ui/badge';
import { useActivityLogChanges } from '@/lib/hooks/useActivityLogs';

interface Props {
  activityLogId: number;
  isExpanded: boolean;
}

export function ActivityChangesDetail({ activityLogId, isExpanded }: Props) {
  const { data: changes = [], isLoading: loading } = useActivityLogChanges(
    activityLogId,
    isExpanded
  );

  if (!isExpanded) return null;

  if (loading) {
    return (
      <div className="bg-muted/50 text-muted-foreground p-4 text-center text-sm">
        Cargando cambios...
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className="bg-muted/50 text-muted-foreground p-4 text-center text-sm">
        No hay cambios detallados para esta operación.
      </div>
    );
  }

  return (
    <div className="bg-muted/50 space-y-4 p-4">
      {changes.map((change) => (
        <div key={change.id} className="bg-background rounded-lg border p-4">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="outline">{change.entityType}</Badge>
            <span className="text-sm font-semibold">{change.entityLabel}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* BEFORE */}
            <div className="space-y-2">
              <div className="text-destructive text-xs font-semibold uppercase">Antes</div>
              <pre className="bg-muted max-h-64 overflow-auto rounded p-3 text-xs">
                {JSON.stringify(change.beforeState, null, 2)}
              </pre>
            </div>

            {/* AFTER */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-green-600 uppercase">Después</div>
              <pre className="bg-muted max-h-64 overflow-auto rounded p-3 text-xs">
                {JSON.stringify(change.afterState, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
