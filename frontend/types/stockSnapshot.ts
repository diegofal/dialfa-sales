export interface StockSnapshot {
  id: string;
  date: string;
  stockValue: number;
  formattedDate: string;
  formattedValue: string;
}

export interface StockCategorySnapshot {
  date: string;
  formattedDate: string;
  status: string;
  count: number;
  totalValue: number;
}

export interface ArticleMovement {
  entered: string[];
  exited: string[];
}

export interface StockCategorySnapshotsByStatus {
  [status: string]: {
    dates: string[];
    counts: number[];
    values: number[];
    movements?: ArticleMovement[];
  };
}
