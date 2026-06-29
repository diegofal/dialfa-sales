import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { articlesApi } from '@/lib/api/articles';
import { composeContainerOrder } from '@/lib/utils/articles/composeContainerOrder';
import { Article } from '@/types/article';
import type { useSupplierOrderDraft } from './useSupplierOrderDraft';

export interface ContainerStrategy {
  /** Months of projected demand to bring. */
  coverageMonths: number;
  capacityKg: number;
  /** 0 = no over-stock cap. */
  maxStockMonths: number;
  /** Empty = all categories. */
  categoryIds: number[];
  /** Origins we can't import from right now (e.g. ['india'] under anti-dumping). */
  blockedOrigins: string[];
  /** "Papa caliente" floor: require sales in ≥ N of the last 12 months. 0 = off. */
  minMonthsWithSales: number;
  /** Max distinct lines (0 = no limit). When set, concentrates into the top items. */
  maxSkus: number;
}

export const DEFAULT_CONTAINER_STRATEGY: ContainerStrategy = {
  coverageMonths: 12,
  capacityKg: 25000,
  maxStockMonths: 0,
  categoryIds: [],
  // India is blocked by anti-dumping (expected to lift ~Sept 2026); toggle in UI.
  blockedOrigins: ['india'],
  // "Papa caliente" on by default: only recurrent sellers (≥8 of last 12 months),
  // so one-shots like CRC9012/CRL9014 don't slip into the order.
  minMonthsWithSales: 8,
  maxSkus: 0,
};

interface UseContainerPlannerParams {
  trendMonths: number;
  /** Gate the catalog fetch (= supplier order mode on). */
  enabled: boolean;
  draft: ReturnType<typeof useSupplierOrderDraft>;
}

const overridesKey = (draftId: number | null) => `container-planner-overrides:${draftId ?? 'new'}`;

/**
 * Container planner. Owns the strategy and the manual-override model and a cached
 * catalog. Generation is EXPLICIT: changing a control only updates settings; the
 * order is (re)built only via `regenerate()`/`resetLine()`. Manual line edits are
 * preserved (pinned) when you regenerate.
 */
export function useContainerPlanner({ trendMonths, enabled, draft }: UseContainerPlannerParams) {
  const [strategy, setStrategy] = useState<ContainerStrategy>(DEFAULT_CONTAINER_STRATEGY);
  const [manualQty, setManualQty] = useState<Map<number, number>>(new Map());
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());

  // Anchor the demand window to the previous (completed) month so the WMA — and
  // therefore the generated order — doesn't depend on the day it's run and the
  // partial current month never dilutes demand. The 15th avoids any timezone
  // month-flip when the server re-parses the date. Stable within a calendar month.
  const trendAsOf = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString().slice(0, 10);
  }, []);

  // Cached catalog — fetched once per trendMonths window.
  const { data, isFetching } = useQuery({
    queryKey: ['articles', 'container-catalog', trendMonths, trendAsOf],
    queryFn: () =>
      articlesApi.getAll({
        pageSize: 2000,
        includeTrends: true,
        trendMonths,
        trendAsOf,
        activeOnly: true,
      }),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
  const catalog = useMemo(() => data?.data ?? [], [data]);
  const catalogById = useMemo(() => new Map(catalog.map((a) => [a.id, a])), [catalog]);

  // Categories actually present in the catalog (so the filter lists every family
  // with articles, regardless of the category is_active flag).
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

  // Read current draft items / replaceItems without unstable-identity issues.
  const itemsRef = useRef(draft.items);
  itemsRef.current = draft.items;
  const replaceItemsRef = useRef(draft.replaceItems);
  replaceItemsRef.current = draft.replaceItems;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const resolveArticle = useCallback(
    (id: number): Article | undefined => catalogById.get(id) ?? itemsRef.current.get(id)?.article,
    [catalogById]
  );

  // Build the order from the catalog + current strategy, honouring the given
  // override maps. Replaces the draft contents.
  const build = useCallback(
    (manual: Map<number, number>, removed: Set<number>, strat: ContainerStrategy) => {
      const result = composeContainerOrder({
        catalog,
        resolveArticle,
        manualQty: manual,
        removedIds: removed,
        trendMonths,
        strategy: {
          coverageMonths: strat.coverageMonths,
          maxStockMonths: strat.maxStockMonths,
          categoryIds: strat.categoryIds,
          blockedOrigins: strat.blockedOrigins,
          minMonthsWithSales: strat.minMonthsWithSales,
          maxSkus: strat.maxSkus,
        },
        capacityKg: strat.capacityKg,
      });
      if (result) replaceItemsRef.current(result.entries);
    },
    [catalog, resolveArticle, trendMonths]
  );

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
    } catch {
      // ignore corrupt cache
    }
  }, [draft.currentDraftId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        overridesKey(draft.currentDraftId),
        JSON.stringify({ manualQty: [...manualQty], removedIds: [...removedIds] })
      );
    } catch {
      // storage full / unavailable — non-fatal
    }
  }, [manualQty, removedIds, draft.currentDraftId]);

  // --- Strategy setters (settings only; NO regeneration) ---
  const update = useCallback(
    <K extends keyof ContainerStrategy>(key: K, value: ContainerStrategy[K]) => {
      setStrategy((s) => ({ ...s, [key]: value }));
    },
    []
  );
  const setCoverageMonths = useCallback((n: number) => update('coverageMonths', n), [update]);
  const setCapacityKg = useCallback((n: number) => update('capacityKg', n), [update]);
  const setMaxStockMonths = useCallback((n: number) => update('maxStockMonths', n), [update]);
  const setCategoryIds = useCallback((ids: number[]) => update('categoryIds', ids), [update]);
  const setBlockedOrigins = useCallback(
    (origins: string[]) => update('blockedOrigins', origins),
    [update]
  );
  const setMinMonthsWithSales = useCallback(
    (n: number) => update('minMonthsWithSales', n),
    [update]
  );
  const setMaxSkus = useCallback((n: number) => update('maxSkus', n), [update]);

  // --- Manual line edits (direct, live; recorded as pins — NO regeneration) ---
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
    draftRef.current.updateQuantity(id, qty);
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
    draftRef.current.removeItem(id);
  }, []);

  // --- Explicit (re)generation ---
  const regenerate = useCallback(() => {
    build(manualQty, removedIds, strategy);
  }, [build, manualQty, removedIds, strategy]);

  // Un-pin a line and rebuild so it gets a fresh suggested quantity.
  const resetLine = useCallback(
    (id: number) => {
      const nextManual = new Map(manualQty);
      nextManual.delete(id);
      const nextRemoved = new Set(removedIds);
      nextRemoved.delete(id);
      setManualQty(nextManual);
      setRemovedIds(nextRemoved);
      build(nextManual, nextRemoved, strategy);
    },
    [build, manualQty, removedIds, strategy]
  );

  const clear = useCallback(async () => {
    setManualQty(new Map());
    setRemovedIds(new Set());
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(overridesKey(draftRef.current.currentDraftId));
      window.localStorage.removeItem(overridesKey(null));
    }
    await draftRef.current.deleteDraft();
  }, []);

  const overriddenIds = useMemo(() => new Set(manualQty.keys()), [manualQty]);

  return {
    strategy,
    setCoverageMonths,
    setCapacityKg,
    setMaxStockMonths,
    setCategoryIds,
    setBlockedOrigins,
    setMinMonthsWithSales,
    setMaxSkus,
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
