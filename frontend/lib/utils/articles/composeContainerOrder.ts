/**
 * Override-aware container order composer.
 *
 * Wraps the pure `buildContainerFill` to honour manual edits: pinned quantities
 * are emitted verbatim and excluded from the auto pool, removed lines never come
 * back, and the auto fill only uses the weight left after the manual lines.
 *
 * Pure and deterministic so the reactive planner stays testable.
 */
import { Article } from '@/types/article';
import { buildContainerFill, type ContainerFillEntry, type FillStrategy } from './containerFill';

export interface ComposeParams {
  /** Active catalog with trends loaded. */
  catalog: Article[];
  /** Resolve an article by id (catalog first, draft fallback for filtered-out items). */
  resolveArticle: (id: number) => Article | undefined;
  /** Pinned quantities the user set by hand. */
  manualQty: Map<number, number>;
  /** Lines the user removed; the auto pool must not re-add them. */
  removedIds: Set<number>;
  trendMonths: number;
  /** Strategy (mode, coverage, filters). roundQuantities / maxShare are applied here. */
  strategy: FillStrategy;
  capacityKg: number;
}

export interface ComposeResult {
  entries: ContainerFillEntry[];
  manualKg: number;
  autoKg: number;
}

/**
 * Returns the full order (manual pins + auto fill), or `null` when the catalog
 * hasn't loaded yet (caller should skip replacing the order in that case).
 */
export function composeContainerOrder(params: ComposeParams): ComposeResult | null {
  const { catalog, resolveArticle, manualQty, removedIds, trendMonths, strategy, capacityKg } =
    params;

  if (catalog.length === 0) return null;

  const manualEntries: ContainerFillEntry[] = [];
  let manualKg = 0;
  const excludeIds = new Set<number>(removedIds);

  for (const [id, qty] of manualQty) {
    const article = resolveArticle(id);
    excludeIds.add(id); // pinned/removed → never in the auto pool
    if (!article || qty <= 0) continue;
    manualEntries.push({ article, quantity: qty });
    manualKg += (Number(article.weightKg) || 0) * qty;
  }

  const remaining = Math.max(0, capacityKg - manualKg);
  const auto = buildContainerFill(catalog, excludeIds, remaining, trendMonths, {
    ...strategy,
    roundQuantities: true,
    maxShare: 0.1,
  });

  // REEMPLAZA, nunca mergea
  return {
    entries: [...manualEntries, ...auto.entries],
    manualKg,
    autoKg: auto.addedKg,
  };
}
