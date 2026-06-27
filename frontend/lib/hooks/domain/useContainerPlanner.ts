import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { articlesApi } from '@/lib/api/articles';
import { composeContainerOrder } from '@/lib/utils/articles/composeContainerOrder';
import type { FillMode } from '@/lib/utils/articles/containerFill';
import { Article } from '@/types/article';
import { useDebounce } from '../generic/useDebounce';
import type { useSupplierOrderDraft } from './useSupplierOrderDraft';

export interface ContainerStrategy {
  mode: FillMode;
  /** Months of projected demand to bring (the main lever). */
  coverageMonths: number;
  capacityKg: number;
  excludeNoRotation: boolean;
  /** 0 = no over-stock cap. */
  maxStockMonths: number;
  /** Empty = all categories. */
  categoryIds: number[];
}

export const DEFAULT_CONTAINER_STRATEGY: ContainerStrategy = {
  mode: 'money',
  coverageMonths: 12,
  capacityKg: 25000,
  excludeNoRotation: true,
  maxStockMonths: 0,
  categoryIds: [],
};

interface UseContainerPlannerParams {
  trendMonths: number;
  /** Gate the catalog fetch + recompute (= supplier order mode on). */
  enabled: boolean;
  draft: ReturnType<typeof useSupplierOrderDraft>;
}

const STRATEGY_DEBOUNCE_MS = 350;
const overridesKey = (draftId: number | null) => `container-planner-overrides:${draftId ?? 'new'}`;

/**
 * Reactive container planner. Owns the strategy, the manual-override model and a
 * cached catalog, and recomputes the order live (debounced) into the draft via
 * `draft.replaceItems`. Manual edits (pinned quantities / removed lines) are
 * preserved across recomputes; the auto fill only uses the remaining capacity.
 */
export function useContainerPlanner({ trendMonths, enabled, draft }: UseContainerPlannerParams) {
  const [strategy, setStrategy] = useState<ContainerStrategy>(DEFAULT_CONTAINER_STRATEGY);
  const [manualQty, setManualQty] = useState<Map<number, number>>(new Map());
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());
  // Stays false until the user interacts, so a freshly loaded saved draft is not clobbered.
  const [isDirty, setIsDirty] = useState(false);

  // Cached catalog — fetched once per trendMonths window, reused across keystrokes.
  const { data, isFetching } = useQuery({
    queryKey: ['articles', 'container-catalog', trendMonths],
    queryFn: () =>
      articlesApi.getAll({ pageSize: 2000, includeTrends: true, trendMonths, activeOnly: true }),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
  const catalog = useMemo(() => data?.data ?? [], [data]);
  const catalogById = useMemo(() => new Map(catalog.map((a) => [a.id, a])), [catalog]);

  // Categories actually present in the orderable catalog (so the filter shows
  // every relevant family, regardless of the category is_active flag).
  const categories = useMemo(() => {
    const byId = new Map<number, string>();
    for (const a of catalog) {
      if (a.categoryId != null && !byId.has(a.categoryId)) {
        byId.set(a.categoryId, a.categoryName ?? `#${a.categoryId}`);
      }
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((x, y) => x.name.localeCompare(y.name));
  }, [catalog]);

  // Read current draft items without making them an effect dependency (loop breaker).
  const itemsRef = useRef(draft.items);
  itemsRef.current = draft.items;

  const resolveArticle = useCallback(
    (id: number): Article | undefined => catalogById.get(id) ?? itemsRef.current.get(id)?.article,
    [catalogById]
  );

  const debouncedStrategy = useDebounce(strategy, STRATEGY_DEBOUNCE_MS);
  // draft.replaceItems identity is unstable (it depends on react-query mutation
  // objects that change every render). Keep it in a ref so the recompute effect
  // doesn't re-run every render → infinite loop (React error #185).
  const replaceItemsRef = useRef(draft.replaceItems);
  replaceItemsRef.current = draft.replaceItems;

  // --- Override persistence across reload (localStorage, keyed by draft id) ---
  const restoredForRef = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    const id = draft.currentDraftId;
    if (restoredForRef.current === id) return;
    restoredForRef.current = id;
    if (typeof window === 'undefined') return;
    try {
      const raw =
        window.localStorage.getItem(overridesKey(id)) ??
        (id !== null ? window.localStorage.getItem(overridesKey(null)) : null);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { manualQty?: [number, number][]; removedIds?: number[] };
      if (parsed.manualQty?.length) setManualQty(new Map(parsed.manualQty));
      if (parsed.removedIds?.length) setRemovedIds(new Set(parsed.removedIds));
      // Restoring does NOT mark dirty: the saved draft already reflects these edits.
    } catch {
      // ignore corrupt cache
    }
  }, [draft.currentDraftId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isDirty) return;
    try {
      window.localStorage.setItem(
        overridesKey(draft.currentDraftId),
        JSON.stringify({ manualQty: [...manualQty], removedIds: [...removedIds] })
      );
    } catch {
      // storage full / unavailable — non-fatal
    }
  }, [manualQty, removedIds, draft.currentDraftId, isDirty]);

  // --- Reactive recompute ---
  useEffect(() => {
    if (!enabled || !isDirty || catalog.length === 0) return;
    const result = composeContainerOrder({
      catalog,
      resolveArticle,
      manualQty,
      removedIds,
      trendMonths,
      strategy: {
        mode: debouncedStrategy.mode,
        coverageMonths: debouncedStrategy.coverageMonths,
        excludeNoRotation: debouncedStrategy.excludeNoRotation,
        maxStockMonths: debouncedStrategy.maxStockMonths,
        categoryIds: debouncedStrategy.categoryIds,
      },
      capacityKg: debouncedStrategy.capacityKg,
    });
    if (!result) return;
    // Don't wipe an existing order when an over-restrictive strategy yields nothing.
    if (result.entries.length === 0 && itemsRef.current.size > 0 && manualQty.size === 0) return;
    replaceItemsRef.current(result.entries);
  }, [
    enabled,
    isDirty,
    catalog,
    debouncedStrategy,
    manualQty,
    removedIds,
    trendMonths,
    resolveArticle,
  ]);

  // --- Strategy setters (each marks dirty) ---
  const update = useCallback(
    <K extends keyof ContainerStrategy>(key: K, value: ContainerStrategy[K]) => {
      setStrategy((s) => ({ ...s, [key]: value }));
      setIsDirty(true);
    },
    []
  );
  const setMode = useCallback((m: FillMode) => update('mode', m), [update]);
  const setCoverageMonths = useCallback((n: number) => update('coverageMonths', n), [update]);
  const setCapacityKg = useCallback((n: number) => update('capacityKg', n), [update]);
  const setExcludeNoRotation = useCallback(
    (b: boolean) => update('excludeNoRotation', b),
    [update]
  );
  const setMaxStockMonths = useCallback((n: number) => update('maxStockMonths', n), [update]);
  const setCategoryIds = useCallback((ids: number[]) => update('categoryIds', ids), [update]);

  // --- Override actions ---
  const setManualQuantity = useCallback((id: number, qty: number) => {
    setManualQty((prev) => {
      const next = new Map(prev);
      next.set(id, qty);
      return next;
    });
    setRemovedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setIsDirty(true);
  }, []);

  const removeLine = useCallback((id: number) => {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setManualQty((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setIsDirty(true);
  }, []);

  const resetLine = useCallback((id: number) => {
    setManualQty((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setRemovedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setIsDirty(true);
  }, []);

  const regenerate = useCallback(() => {
    setManualQty(new Map());
    setRemovedIds(new Set());
    setIsDirty(true);
  }, []);

  const clear = useCallback(async () => {
    setManualQty(new Map());
    setRemovedIds(new Set());
    setIsDirty(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(overridesKey(draft.currentDraftId));
      window.localStorage.removeItem(overridesKey(null));
    }
    await draft.deleteDraft();
  }, [draft]);

  const overriddenIds = useMemo(() => new Set(manualQty.keys()), [manualQty]);

  return {
    strategy,
    setMode,
    setCoverageMonths,
    setCapacityKg,
    setExcludeNoRotation,
    setMaxStockMonths,
    setCategoryIds,
    setManualQuantity,
    removeLine,
    resetLine,
    regenerate,
    clear,
    overriddenIds,
    categories,
    isCatalogLoading: isFetching && catalog.length === 0,
  };
}
