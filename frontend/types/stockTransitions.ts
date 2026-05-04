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
