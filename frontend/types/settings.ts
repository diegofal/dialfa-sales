export interface SystemSettings {
  id: number;
  usdExchangeRate: number;
  updatedAt: string;
  updatedBy: number | null;
}

export interface UpdateSettingsRequest {
  usdExchangeRate: number;
}




