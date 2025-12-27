import { useState, useCallback, useEffect, useRef } from 'react';
import { Article } from '@/types/article';
import { SupplierOrderItem, SupplierOrderItemDto } from '@/types/supplierOrder';
import {
  calculateWeightedAvgSales,
  calculateEstimatedSaleTime,
  calculateWeightedAvgSaleTime,
} from '@/lib/utils/salesCalculations';
import { useCreateSupplierOrder, useUpdateSupplierOrder, useSupplierOrders } from './useSupplierOrders';
import { toast } from 'sonner';
import axios from 'axios';

// Debounce delay in milliseconds
const AUTOSAVE_DELAY = 1500;

export function useSupplierOrderDraft(trendMonths: number = 12) {
  const [items, setItems] = useState<Map<number, SupplierOrderItem>>(new Map());
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Debounce timer ref
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<Map<number, SupplierOrderItem> | null>(null);

  // Fetch existing drafts - with refetchOnMount: false to avoid constant reloading
  const { data: draftsData } = useSupplierOrders(
    { status: 'draft' },
    { 
      refetchOnMount: false, 
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );
  const createMutation = useCreateSupplierOrder({ silent: true });
  const updateMutation = useUpdateSupplierOrder({ silent: true });

  // Load the first draft on mount
  useEffect(() => {
    if (draftsData?.data) {
      const drafts = draftsData.data;
      if (drafts.length > 0) {
        const latestDraft = drafts[0];
        setCurrentDraftId(latestDraft.id);
        
        // Extract article IDs to load their sales trends
        const articleIds = latestDraft.items?.map((item: SupplierOrderItemDto) => item.articleId) || [];
        
        // Load articles with sales trends
        if (articleIds.length > 0) {
          console.log('🔍 [Draft] Cargando artículos:', articleIds);
          
          axios.get('/api/articles', {
            params: {
              ids: articleIds.join(','),
              includeTrends: 'true',
              includeLastSaleDate: 'true',
              trendMonths: trendMonths,
            }
          })
          .then((response) => {
            console.log('✅ [Draft] Artículos recibidos:', response.data.data.length, 'de', articleIds.length);
            console.log('📊 [Draft] Artículos:', response.data.data.map((a: Article) => ({
              id: a.id,
              code: a.code,
              price: a.unitPrice
            })));
            
            const articlesMap = new Map<number, Article>();
            response.data.data.forEach((article: Article) => {
              articlesMap.set(article.id, article);
            });

            // Preservar el orden original de latestDraft.items
            const itemsMap = new Map<number, SupplierOrderItem>();
            latestDraft.items?.forEach((item: SupplierOrderItemDto) => {
              const fullArticle = articlesMap.get(item.articleId);
              
              if (!fullArticle) {
                console.warn(`⚠️ [Draft] Artículo NO encontrado en API - ID: ${item.articleId}, Code: ${item.articleCode}`);
              }
              
              const article: Article = fullArticle ? fullArticle : {
                id: item.articleId,
                code: item.articleCode,
                description: item.articleDescription,
                categoryId: 0,
                categoryName: '',
                categoryDefaultDiscount: 0,
                unitPrice: 0,
                stock: item.currentStock,
                minimumStock: item.minimumStock,
                location: null,
                isDiscontinued: false,
                notes: null,
                isDeleted: false,
                createdAt: '',
                updatedAt: '',
                isLowStock: false,
                stockStatus: '',
                salesTrend: [],
                salesTrendLabels: [],
                lastSaleDate: null,
              } as Article;

              // Calcular WMA dinámico basado en trendMonths
              const avgSales = calculateWeightedAvgSales(article.salesTrend, trendMonths);

              itemsMap.set(item.articleId, {
                article,
                quantity: item.quantity,
                currentStock: item.currentStock,
                minimumStock: item.minimumStock,
                avgMonthlySales: avgSales,
                estimatedSaleTime: calculateEstimatedSaleTime(item.quantity, avgSales),
              });
            });
            
            setItems(itemsMap);
            setIsLoading(false);
          })
          .catch((error) => {
            console.error('Error loading article sales trends:', error);
            // Fallback: load without trends (salesTrend vacío, así avgSales será 0)
            const itemsMap = new Map<number, SupplierOrderItem>();
            latestDraft.items?.forEach((item: SupplierOrderItemDto) => {
              const article: Article = {
                id: item.articleId,
                code: item.articleCode,
                description: item.articleDescription,
                categoryId: 0,
                categoryName: '',
                categoryDefaultDiscount: 0,
                unitPrice: 0,
                stock: item.currentStock,
                minimumStock: item.minimumStock,
                location: null,
                isDiscontinued: false,
                notes: null,
                isDeleted: false,
                createdAt: '',
                updatedAt: '',
                isLowStock: false,
                stockStatus: '',
                salesTrend: [],
                salesTrendLabels: [],
                lastSaleDate: null,
              } as Article;

              // Sin salesTrend, avgSales será 0 y saleTime será Infinity
              const avgSales = calculateWeightedAvgSales(article.salesTrend, trendMonths);

              itemsMap.set(item.articleId, {
                article,
                quantity: item.quantity,
                currentStock: item.currentStock,
                minimumStock: item.minimumStock,
                avgMonthlySales: avgSales,
                estimatedSaleTime: calculateEstimatedSaleTime(item.quantity, avgSales),
              });
            });
            
            setItems(itemsMap);
            setIsLoading(false);
          });
        } else {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    }
  }, [draftsData, trendMonths]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Debounced save function
  const debouncedSave = useCallback((itemsToSave: Map<number, SupplierOrderItem>) => {
    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Store pending save
    pendingSaveRef.current = itemsToSave;
    
    // Set new timer
    saveTimerRef.current = setTimeout(async () => {
      const itemsArray = Array.from(itemsToSave.values());
      
      if (itemsArray.length === 0) {
        setIsSaving(false);
        return;
      }

      const orderData = {
        items: itemsArray.map(item => ({
          articleId: item.article.id,
          articleCode: item.article.code,
          articleDescription: item.article.description,
          quantity: item.quantity,
          currentStock: item.currentStock,
          minimumStock: item.minimumStock,
          avgMonthlySales: item.avgMonthlySales,
          estimatedSaleTime: item.estimatedSaleTime,
        })),
      };

      setIsSaving(true);
      
      try {
        if (currentDraftId) {
          await updateMutation.mutateAsync({
            id: currentDraftId,
            order: orderData,
          });
        } else {
          const result = await createMutation.mutateAsync(orderData);
          if (result.data?.id) {
            setCurrentDraftId(result.data.id);
          }
        }
      } catch (error) {
        console.error('Error saving draft:', error);
        toast.error('Error al guardar borrador');
      } finally {
        setIsSaving(false);
        pendingSaveRef.current = null;
      }
    }, AUTOSAVE_DELAY);
  }, [currentDraftId, createMutation, updateMutation]);

  const addItem = useCallback((article: Article, quantity: number = 1) => {
    const avgSales = calculateWeightedAvgSales(article.salesTrend, trendMonths);

    setItems((prev) => {
      const updated = new Map(prev);
      const existing = updated.get(article.id);

      if (existing) {
        const newQty = existing.quantity + quantity;
        updated.set(article.id, {
          ...existing,
          quantity: newQty,
          estimatedSaleTime: calculateEstimatedSaleTime(newQty, avgSales),
        });
      } else {
        updated.set(article.id, {
          article,
          quantity,
          currentStock: Number(article.stock),
          minimumStock: Number(article.minimumStock),
          avgMonthlySales: avgSales,
          estimatedSaleTime: calculateEstimatedSaleTime(quantity, avgSales),
        });
      }
      
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave, trendMonths]);

  const removeItem = useCallback((articleId: number) => {
    setItems((prev) => {
      const updated = new Map(prev);
      updated.delete(articleId);
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave]);

  const updateQuantity = useCallback((articleId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(articleId);
      return;
    }

    setItems((prev) => {
      const updated = new Map(prev);
      const item = updated.get(articleId);
      if (item) {
        updated.set(articleId, {
          ...item,
          quantity,
          estimatedSaleTime: calculateEstimatedSaleTime(quantity, item.avgMonthlySales),
        });
        debouncedSave(updated);
      }
      return updated;
    });
  }, [removeItem, debouncedSave]);

  const clear = useCallback(() => {
    setItems(new Map());
    setCurrentDraftId(null);
    
    // Clear any pending saves
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    pendingSaveRef.current = null;
  }, []);

  const getItems = useCallback(() => {
    return Array.from(items.values());
  }, [items]);

  const getTotalItems = useCallback(() => {
    return items.size;
  }, [items]);

  const getTotalQuantity = useCallback(() => {
    return Array.from(items.values()).reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const getTotalEstimatedTime = useCallback(() => {
    const itemsArray = Array.from(items.values());
    return calculateWeightedAvgSaleTime(itemsArray);
  }, [items]);

  const getSuggestedArticles = useCallback((allArticles: Article[]) => {
    return allArticles
      .filter((a) => {
        const hasLowStock = Number(a.stock) < Number(a.minimumStock);
        const hasSales = a.salesTrend && a.salesTrend.reduce((s, v) => s + v, 0) > 0;
        return hasLowStock && hasSales;
      })
      .sort((a, b) => {
        const urgencyA = Number(a.stock) - Number(a.minimumStock);
        const urgencyB = Number(b.stock) - Number(b.minimumStock);
        return urgencyA - urgencyB;
      })
      .slice(0, 20);
  }, []);

  const getSuggestedQuantity = useCallback((article: Article): number => {
    const avgSales = calculateWeightedAvgSales(article.salesTrend, trendMonths);
    const currentStock = Number(article.stock);
    const minimumStock = Number(article.minimumStock);
    
    const stockDeficit = minimumStock - currentStock;
    const suggestedQty = Math.ceil(avgSales * 3 + stockDeficit);
    
    return Math.max(1, suggestedQty);
  }, [trendMonths]);

  return {
    items,
    currentDraftId,
    isLoading,
    isSaving,
    addItem,
    removeItem,
    updateQuantity,
    clear,
    getItems,
    getTotalItems,
    getTotalQuantity,
    getTotalEstimatedTime,
    getSuggestedArticles,
    getSuggestedQuantity,
  };
}

