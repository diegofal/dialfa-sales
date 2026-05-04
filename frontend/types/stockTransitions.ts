import { StockStatus } from './stockValuation';

export interface TransitionMatrixCell {
  fromStatus: StockStatus;
  toStatus: StockStatus;
  count: number;
  totalStockValue: number;
}

export interface ArticleTransition {
  articleId: string;
  articleCode: string;
  description: string | null;
  fromStatus: StockStatus;
  toStatus: StockStatus;
  transitionDate: string | null;
  currentStock: number;
  unitValue: number;
  stockValue: number;
  /** Units that left stock during the analysis window (sales / DEBIT). */
  unitsOut: number;
  /** Units that entered stock during the analysis window (returns or adjustments / CREDIT). */
  unitsIn: number;
  /** Total number of stock_movements rows recorded for this article in the window. */
  movementCount: number;
}

export interface StockTransitionsResult {
  requestedFromDate: string;
  requestedToDate: string;
  actualFromDate: string | null;
  actualToDate: string | null;
  matrix: TransitionMatrixCell[];
  transitions: ArticleTransition[];
  totalsByDirection: {
    upgrades: number;
    downgrades: number;
    sideways: number;
  };
}

export interface GetTransitionsOptions {
  fromStatus?: StockStatus;
  toStatus?: StockStatus;
  minStockValue?: number;
  limit?: number;
}
