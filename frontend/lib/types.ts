// Helper for API responses
export type ActionResponse<T = unknown> = 
  | { success: true; data: T; message?: string }
  | { success: false; error: string };


