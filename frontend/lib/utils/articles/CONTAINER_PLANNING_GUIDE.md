# Container Planning Guide

Spec + playbook for the import **container planner** (`buildContainerFill`). Read
this before changing the fill logic, and use it as the methodology prompt when an
AI is asked to build/justify a container ad-hoc. The quantitative logic lives in
**deterministic, unit-tested code** — AI is an _advisory_ layer only (translate a
natural-language request into a strategy, suggest family mixes, write the
justification). AI never computes quantities.

## Objective

A container is **weight-constrained** (e.g. 25 t). Given the active catalog, pick
which articles to import and how many of each to **maximize the value of the
container** within the weight limit, over a coverage horizon. Space / over-stock
is generally NOT the constraint (the business stockpiles ahead of import
restrictions); the only hard limit is weight.

## Pipeline (code)

`useContainerPlanner` (hook) → `composeContainerOrder` (honours manual pins) →
`buildContainerFill` (pure scoring + weight-bounded fill). All pure & testable;
no React/network in `buildContainerFill`.

## Demand — WMA, recency-weighted, repeatable

- Demand per article = `calculateWeightedAvgSales(salesTrend, trendMonths)`:
  a weighted moving average where recent months weigh more (oldest ×1 … newest ×N).
  This captures the _active_ trend better than a flat average when sales are rising.
- **Repeatability**: the demand window is anchored to the **previous completed
  month** (the hook passes `trendAsOf` = the 15th of last month through
  `articlesApi.getAll` → `ArticleService` → `calculateSalesTrends`). So the window
  doesn't depend on the day it's run, and the partial current month never dilutes
  demand. Re-generating on the same data yields the **same order**.
- Every ranking sort in `buildContainerFill` carries a **stable id tie-break**, so
  equal-ranked items never reorder run-to-run or depend on input order.

## Sourcing (which articles we can import now)

- `articles.import_origin` ∈ `china | india | both | null(unknown)`; `suppliers.country`.
- Seeded from proforma history by `scripts/seed-article-origin.ts`
  (PIF\* → China = Qingdao/Bestflow, CMPL\* → India = Citizen). `import_origin` is an
  **editable override**; re-running the seed only fills NULLs unless `--overwrite`.
- The **size rule** behind the data (for reference / fallback): butt-weld
  accessories (codos/tees/caps) come **chico ≤1½" + grande ≥14" from China**, and
  **medio 2"–12" from India**. Flanges, studs and forged are China across sizes.
- Filter: `strategy.blockedOrigins` drops articles whose origin is _exactly_ a
  blocked origin. `china`/`both`/`null` always pass — so blocking `['india']` only
  removes india-only items (e.g. the medio codos), never something importable.
- **Anti-dumping**: India is blocked until ~**Sept 2026**; the planner defaults to
  `blockedOrigins: ['india']` with a UI toggle to lift it.

## "Papa caliente" (recurrence)

- `strategy.minMonthsWithSales` requires sales in ≥ N of the last 12 months (from
  the loaded `salesTrend`). The UI preset uses **8**. This drops **one-shots** — a
  single big sale would otherwise rank high in `money` mode (the C4516 case).
- Different from `excludeNoRotation` (which only drops WMA = 0).

## Margins, markup, landed — and a naming gotcha

- FOB = `lastPurchasePrice`. **CIF** = `getArticleCifCost` = FOB × (1 + cifPercentage/100)
  (cifPercentage defaults to 50 → CIF = FOB × 1.5). **Landed** ≈ FOB × 1.8
  (adds freight, customs, despacho) — more conservative.
- Sell price = `getArticleDiscountedSellPrice` (list × (1 − discount)). For analysis
  the realized average sell price (from invoices) is preferable when available.
- ⚠️ **Gotcha**: the existing `getArticleMarginPercent` returns **markup over cost**
  = `(sell − CIF) / CIF` (despite the "margin" name), because `calculateMarginPercent`
  divides by cost. True **margin over sell** = `(sell − CIF) / sell`. Markup is the
  bigger, distributor-style number ("I buy at X, sell at 8×"). Be explicit about
  which one a column shows.

## Fill, caps, rounding

- **Single ranking criterion**: total profit per line = `WMA × unit margin`. This
  concentrates the order on the real money-makers (codos/bridas/espárragos) instead
  of the light high-margin-per-kg tail. The old `money`/`rotation`/`critical` modes
  were removed (simpler = actually used). `profitTotal > 0` already drops zero-rotation
  and unprofitable items, so there's no separate "exclude no rotation" toggle.
- Quantity target = `ceil(WMA × coverageMonths)`, capped by `maxStockMonths` headroom
  and remaining weight.
- `maxShare` caps a single SKU's weight share (diversify; the panel uses 0.1 = 2.5 t
  of a 25 t box). `roundQuantities` snaps to clean increments (`roundQuantityNicely`).
- `maxSkus` (the "Ítems" control) caps the line count AND **scales quantities to
  fill the box**: the top-N items share a uniform coverage horizon `H = capacity /
Σ(WMA × weight)` (never below `coverageMonths`), so fewer lines ⇒ bigger
  quantities per line and the container still fills. Without a limit, each line
  brings just `coverageMonths` of demand (diversified by `maxShare`), which can
  leave the box under-filled if the catalog's demand-weight is low.
- Verified: with this ranking the deterministic planner reproduces the AI-built
  "papa caliente" container (workhorse codos/bridas/espárragos at the top, 22/22
  item overlap). `scripts/run-container-planner.ts` runs the real code path for comparison.
- Estimated sale time = quantity / WMA (months). Green < 12 (sells fast — under-ordered),
  amber > ~28 (over-ordered at the current pace).

## How to run the seed

```
npx tsx scripts/seed-article-origin.ts            # dry-run report
npx tsx scripts/seed-article-origin.ts --apply    # fill where import_origin is NULL
```

## AI advisory role (never computes quantities)

Given a request like _"contenedor de bridas, 18 meses, papa caliente, solo China"_,
the AI maps it to a validated `ContainerStrategy`
(`{ mode, coverageMonths, categoryIds, minMonthsWithSales, blockedOrigins, ... }`)
which feeds the deterministic builder. The AI may also suggest family mixes and
write the justification, but the **numbers come from `buildContainerFill`** so the
order stays repeatable and auditable.
