'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';

interface Change {
  id: number;
  entityType: string;
  entityLabel: string;
  beforeState: any;
  afterState: any;
}

interface Props {
  activityLogId: number;
  isExpanded: boolean;
}

export function ActivityChangesDetail({ activityLogId, isExpanded }: Props) {
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isExpanded && changes.length === 0) {
      fetchChanges();
    }
  }, [isExpanded, activityLogId]);

  const fetchChanges = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/activity-logs/${activityLogId}/changes`);
      const data = await response.json();
      setChanges(data.data);
    } catch (error) {
      console.error('Error fetching changes:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isExpanded) return null;

  if (loading) {
    return (
      <div className="p-4 bg-muted/50 text-center text-sm text-muted-foreground">
        Cargando cambios...
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className="p-4 bg-muted/50 text-center text-sm text-muted-foreground">
        No hay cambios detallados para esta operación.
      </div>
    );
  }

  return (
    <div className="p-4 bg-muted/50 space-y-4">
      {changes.map((change) => (
        <div key={change.id} className="bg-background rounded-lg p-4 border">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline">{change.entityType}</Badge>
            <span className="font-semibold text-sm">{change.entityLabel}</span>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {/* BEFORE */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-destructive uppercase">
                Antes
              </div>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                {JSON.stringify(change.beforeState, null, 2)}
              </pre>
            </div>
            
            {/* AFTER */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-green-600 uppercase">
                Después
              </div>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                {JSON.stringify(change.afterState, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

