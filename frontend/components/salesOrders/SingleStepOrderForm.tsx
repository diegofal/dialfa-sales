'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ClientLookup } from '@/components/articles/ClientLookup';
import { useCreateSalesOrder, useGenerateInvoice, useGenerateDeliveryNote } from '@/lib/hooks/useSalesOrders';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useQuickCartTabs, QuickCartItem } from '@/lib/hooks/useQuickCartTabs';
import { Alert } from '@/components/ui/alert';
import { ShoppingCart, User, X, Trash2, Pencil, Search, Plus, XCircle, FileText, AlertTriangle, Truck, Eye } from 'lucide-react';
import { useArticles } from '@/lib/hooks/useArticles';
import type { Article } from '@/types/article';
import { useSalesOrder, useUpdateSalesOrder, useCancelSalesOrder, useDeleteSalesOrder } from '@/lib/hooks/useSalesOrders';
import { useSalesOrderPermissions } from '@/lib/hooks/useSalesOrderPermissions';
import { validateSalesOrder } from '@/lib/permissions/salesOrders';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface OrderItemFormData {
  articleId: number;
  articleCode: string;
  articleDescription: string;
  quantity: number;
  unitPrice: number;
  stock: number;
}

interface SingleStepOrderFormProps {
  orderId?: number;
}

export function SingleStepOrderForm({ orderId }: SingleStepOrderFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromQuickCart = searchParams.get('fromQuickCart') === 'true';
  const tabId = searchParams.get('tabId');
  
  // Determine if we're in edit mode
  const isEditMode = !!orderId;
  
  // Load existing order if in edit mode
  const { data: existingOrder, isLoading: isLoadingOrder, error: orderError } = useSalesOrder(orderId || 0);
  
  // Check if order was deleted or not found
  useEffect(() => {
    if (orderError && orderId) {
      const err = orderError as { response?: { status?: number; data?: { error?: string } } };
      if (err?.response?.status === 404) {
        toast.error('El pedido no existe o ha sido eliminado');
        router.push('/dashboard/sales-orders');
      }
    }
  }, [orderError, orderId, router]);
  
  // Track unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Calculate permissions using the custom hook
  const permissions = useSalesOrderPermissions(existingOrder, hasUnsavedChanges);
  
  // Read-only mode based on permissions
  const isReadOnly = !permissions.canEdit;
  
  const { 
    tabs, 
    activeTab,
    removeTab,
    setActiveTab,
    addItem,
    removeItem,
    updateQuantity,
    setClient,
    clearClient,
    ensureTabExists,
    getTabItems,
    replaceItem,
    addOrUpdateOrderTab,
  } = useQuickCartTabs();
  
  const [notes, setNotes] = useState('');
  const [loadedFromCart, setLoadedFromCart] = useState(false);
  const [loadedOrderId, setLoadedOrderId] = useState<number | null>(null);
  const [currentTabId, setCurrentTabId] = useState<string | null>(null);
  
  // Store custom prices separately as they don't exist in QuickCart
  const [prices, setPrices] = useState<Record<number, number>>({});
  
  // Local state for edit mode (saved orders should NOT use Quick Cart Tabs)
  const [localItems, setLocalItems] = useState<QuickCartItem[]>([]);
  const [localClientId, setLocalClientId] = useState<number | undefined>(undefined);
  const [localClientName, setLocalClientName] = useState<string>('');

  // Article search state
  const [articleCode, setArticleCode] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [showCodeResults, setShowCodeResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  
  // Edit article state
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editCode, setEditCode] = useState('');
  const [showEditResults, setShowEditResults] = useState(false);
  const [selectedEditIndex, setSelectedEditIndex] = useState(0);
  
  const codeInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const selectedEditItemRef = useRef<HTMLButtonElement>(null);

  const createOrderMutation = useCreateSalesOrder();
  const updateOrderMutation = useUpdateSalesOrder();
  const cancelOrderMutation = useCancelSalesOrder();
  const deleteOrderMutation = useDeleteSalesOrder();
  const generateInvoiceMutation = useGenerateInvoice();
  const generateDeliveryNoteMutation = useGenerateDeliveryNote();

  // Dialog states for edit mode
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const [unsavedChangesAction, setUnsavedChangesAction] = useState<'save' | 'discard' | null>(null);

  // Search articles for adding
  const { data: articlesResult } = useArticles({ 
    searchTerm: articleCode,
    activeOnly: true,
    pageSize: 5,
  });
  const articles = articlesResult?.data || [];

  // Search articles for editing
  const { data: editArticlesResult } = useArticles({
    searchTerm: editCode,
    activeOnly: true,
    pageSize: 5,
  });
  const editArticles = editArticlesResult?.data || [];

  // Get current tab - use activeTab when not from QuickCart or when currentTabId changes
  // BUT: In edit mode, use local state instead of Quick Cart tabs
  const currentTab = currentTabId ? tabs.find(t => t.id === currentTabId) : activeTab;
  const items = isEditMode ? localItems : (currentTab ? currentTab.items : []);
  const clientId = isEditMode ? localClientId : currentTab?.clientId;
  const clientName = isEditMode ? localClientName : (currentTab?.clientName || '');

  // Track changes for unsaved changes detection
  useEffect(() => {
    if (isEditMode && existingOrder && loadedOrderId === existingOrder.id) {
      // Check if anything changed
      const itemsChanged = items.length !== (existingOrder.items?.length || 0);
      const clientChanged = clientId !== existingOrder.clientId;
      const notesChanged = (notes || '') !== (existingOrder.notes || '');
      
      const hasChanges = itemsChanged || clientChanged || notesChanged;
      setHasUnsavedChanges(hasChanges);
    }
  }, [isEditMode, existingOrder, loadedOrderId, items, clientId, notes]);

  // Load existing order data into form when in edit mode
  useEffect(() => {
    // Only load if we're in edit mode, have the order data, and haven't loaded this specific order yet
    if (isEditMode && existingOrder && loadedOrderId !== existingOrder.id) {
      console.log('Loading existing order:', existingOrder.id, existingOrder.orderNumber);
      
      // For edit mode, create a tab for sidebar navigation but use local state for the form
      const orderItems: QuickCartItem[] = [];
      if (existingOrder.items && existingOrder.items.length > 0) {
        existingOrder.items.forEach(item => {
          // Set prices
          setPrices(prev => ({ ...prev, [item.articleId]: item.unitPrice }));
          
          // Add to items array with real stock from backend
          orderItems.push({
            article: {
              id: item.articleId,
              code: item.articleCode,
              description: item.articleDescription,
              unitPrice: item.unitPrice,
              stock: item.stock || 0,
            } as Article,
            quantity: item.quantity,
          });
        });
      }
      
      // Create tab for sidebar navigation (with orderId so it's marked as saved order)
      const tabId = addOrUpdateOrderTab(
        existingOrder.id,
        existingOrder.orderNumber,
        existingOrder.clientId,
        existingOrder.clientBusinessName,
        orderItems // Pass items so they appear in sidebar
      );
      
      // Set LOCAL state for the form (independent from QuickCart)
      setLocalItems(orderItems);
      setLocalClientId(existingOrder.clientId);
      setLocalClientName(existingOrder.clientBusinessName);
      setCurrentTabId(tabId);
      setNotes(existingOrder.notes || '');
      
      setLoadedFromCart(true);
      setLoadedOrderId(existingOrder.id);
    }
  }, [isEditMode, existingOrder, loadedOrderId, addOrUpdateOrderTab]);

  // Update currentTabId when activeTab changes (from sidebar clicks)
  useEffect(() => {
    if (fromQuickCart && activeTab && activeTab.id && (!currentTabId || activeTab.id !== currentTabId)) {
      setCurrentTabId(activeTab.id);
    }
  }, [activeTab, fromQuickCart, currentTabId]);

  // Load data from quick cart if coming from there
  useEffect(() => {
    if (fromQuickCart && !loadedFromCart && tabs.length > 0) {
      // Set the active tab
      if (tabId) {
        const tab = tabs.find(t => t.id === tabId);
        if (tab) {
          setActiveTab(tabId);
          setCurrentTabId(tabId);
        }
      } else {
        setCurrentTabId(activeTab.id);
      }
      
      setLoadedFromCart(true);
    } else if (fromQuickCart && !loadedFromCart && tabs.length === 0) {
      // Ensure a tab exists
      ensureTabExists();
    }
  }, [fromQuickCart, tabId, tabs, activeTab, loadedFromCart, ensureTabExists, setActiveTab]);

  // Reset selected index when articles change
  useEffect(() => {
    setSelectedIndex(0);
  }, [articles]);

  useEffect(() => {
    setSelectedEditIndex(0);
  }, [editArticles]);

  // Scroll to selected items
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (selectedEditItemRef.current) {
      selectedEditItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedEditIndex]);

  // Auto-select first article if exact match
  useEffect(() => {
    if (articles.length === 1 && articleCode) {
      setSelectedArticle(articles[0]);
    } else if (articles.length === 0) {
      setSelectedArticle(null);
    }
  }, [articles, articleCode]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getStockStatusClass = (stock: number) => {
    if (stock === 0) return 'text-red-600 font-semibold';
    if (stock < 10) return 'text-orange-600 font-semibold';
    return 'text-green-600';
  };

  // Stock validation helper
  const hasStockWarnings = items.some(item => item.quantity > item.article.stock);

  // Show loading state when loading existing order
  if (isEditMode && isLoadingOrder) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Cargando pedido...</p>
      </div>
    );
  }

  // Show error state if order not found
  if (isEditMode && !isLoadingOrder && !existingOrder) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-muted-foreground">Pedido no encontrado</p>
        <Button onClick={() => router.push('/dashboard/sales-orders')}>
          Volver al listado
        </Button>
      </div>
    );
  }

  const handleSelectClient = (id: number, name: string) => {
    if (isEditMode) {
      // In edit mode, update local state
      setLocalClientId(id);
      setLocalClientName(name);
      toast.success(`Cliente ${name} seleccionado`, {
        duration: 2000,
        position: 'top-center'
      });
    } else if (currentTabId) {
      // In draft mode, update QuickCart tab
      setClient(id, name);
      toast.success(`Cliente ${name} seleccionado`, {
        duration: 2000,
        position: 'top-center'
      });
    }
  };

  const handleClearClient = () => {
    if (isEditMode) {
      // In edit mode, clear local state
      setLocalClientId(undefined);
      setLocalClientName('');
    } else if (currentTabId) {
      // In draft mode, clear QuickCart tab
      clearClient();
    }
  };

  // Article search keyboard navigation
  const handleCodeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, articles.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (articles.length > 0) {
        setSelectedArticle(articles[selectedIndex]);
        setArticleCode(articles[selectedIndex].code);
        setShowCodeResults(false);
        quantityInputRef.current?.focus();
        quantityInputRef.current?.select();
      }
    } else if (e.key === 'Escape') {
      setShowCodeResults(false);
      setSelectedArticle(null);
    }
  };

  const handleQuantityKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddArticle();
    } else if (e.key === 'Escape') {
      codeInputRef.current?.focus();
    }
  };

  const handleAddArticle = () => {
    let articleToAdd = selectedArticle;
    
    if (!articleToAdd && articleCode && articles.length > 0) {
      articleToAdd = articles[0];
      setSelectedArticle(articleToAdd);
    }
    
    if (!articleToAdd) {
      toast.error('Selecciona un artículo válido', { 
        duration: 2000,
        position: 'top-center'
      });
      codeInputRef.current?.focus();
      return;
    }

    const qty = parseInt(quantity) || 1;
    if (qty <= 0) {
      toast.error('La cantidad debe ser mayor a 0', {
        duration: 2000,
        position: 'top-center'
      });
      quantityInputRef.current?.focus();
      return;
    }

    if (isEditMode) {
      // In edit mode, update local state
      const existingIndex = localItems.findIndex(item => item.article.id === articleToAdd!.id);
      let updatedItems: QuickCartItem[];
      
      if (existingIndex >= 0) {
        updatedItems = [...localItems];
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          quantity: updatedItems[existingIndex].quantity + qty,
        };
      } else {
        updatedItems = [...localItems, { article: articleToAdd!, quantity: qty }];
      }
      
      setLocalItems(updatedItems);
    } else if (currentTabId) {
      // In draft mode, use QuickCart hook's addItem function
      addItem(articleToAdd, qty);
    }
    
    toast.success(`${articleToAdd.code} agregado`, {
      duration: 2000,
      position: 'top-center'
    });
    
    // Reset form
    setArticleCode('');
    setQuantity('1');
    setSelectedArticle(null);
    codeInputRef.current?.focus();
  };

  const handleSelectArticle = (article: Article, index: number) => {
    setSelectedArticle(article);
    setArticleCode(article.code);
    setSelectedIndex(index);
    setShowCodeResults(false);
    quantityInputRef.current?.focus();
    quantityInputRef.current?.select();
  };

  // Edit article functions
  const handleEditItem = (articleId: number, currentCode: string) => {
    setEditingItemId(articleId);
    setEditCode(currentCode);
    setShowEditResults(false);
    setSelectedEditIndex(0);
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditCode('');
    setShowEditResults(false);
  };

  const handleSelectEditArticle = (article: Article) => {
    if (!editingItemId) return;

    if (isEditMode) {
      // In edit mode, update local state
      const updatedItems = localItems.map(item =>
        item.article.id === editingItemId 
          ? { article, quantity: item.quantity }
          : item
      );
      setLocalItems(updatedItems);
    } else if (currentTabId) {
      // In draft mode, use hook's replaceItem function
      replaceItem(editingItemId, article);
    }
    
    toast.success(`Artículo actualizado a ${article.code}`, {
      duration: 2000,
      position: 'top-center'
    });

    setEditingItemId(null);
    setEditCode('');
    setShowEditResults(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedEditIndex((prev) => Math.min(prev + 1, editArticles.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedEditIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (editArticles.length > 0) {
        handleSelectEditArticle(editArticles[selectedEditIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowEditResults(false);
      handleCancelEdit();
    }
  };

  const handleRemoveItem = (articleId: number) => {
    if (isEditMode) {
      // In edit mode, update local state
      setLocalItems(localItems.filter(item => item.article.id !== articleId));
    } else if (currentTabId) {
      // In draft mode, use QuickCart hook
      removeItem(articleId);
    }
    
    toast.success('Artículo eliminado', {
      duration: 2000,
      position: 'top-center'
    });
  };

  const handleUpdateQuantity = (articleId: number, newQuantity: number) => {
    if (newQuantity <= 0) return;
    
    if (isEditMode) {
      // In edit mode, update local state
      setLocalItems(localItems.map(item =>
        item.article.id === articleId ? { ...item, quantity: newQuantity } : item
      ));
    } else if (currentTabId) {
      // In draft mode, use QuickCart hook
      updateQuantity(articleId, newQuantity);
    }
  };

  const handleUpdateUnitPrice = (articleId: number, newPrice: number) => {
    // Unit price changes are stored separately as they don't exist in QuickCart
    if (newPrice < 0) return;
    setPrices(prev => ({ ...prev, [articleId]: newPrice }));
  };

  const calculateLineTotal = (item: QuickCartItem) => {
    const articleId = item.article.id;
    const quantity = item.quantity;
    const unitPrice = prices[articleId] ?? item.article.unitPrice;
    
    return quantity * unitPrice;
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  };

  const handleSubmit = async () => {
    // Validation using the validation helper
    const validation = validateSalesOrder(
      clientId,
      items.map(item => ({
        quantity: item.quantity,
        stock: item.article.stock,
        articleDescription: item.article.description,
      })),
      true // Allow low stock with warning
    );

    if (!validation.isValid) {
      validation.errors.forEach(error => toast.error(error, { duration: 3000, position: 'top-center' }));
      return;
    }

    // Show warnings if any
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warning => toast.warning(warning, { duration: 4000, position: 'top-center' }));
    }

    // Validate items
    for (const item of items) {
      const unitPrice = prices[item.article.id] ?? item.article.unitPrice;
      if (unitPrice < 0) {
        toast.error(`El precio de ${item.article.code} no puede ser negativo`, {
          duration: 3000,
          position: 'top-center'
        });
        return;
      }
    }

    try {
      // Validate clientId is present
      if (!clientId) {
        toast.error('Please select a client');
        return;
      }

      const requestData = {
        clientId,
        notes: notes || undefined,
        items: items.map((item) => ({
          articleId: item.article.id,
          quantity: item.quantity,
          unitPrice: prices[item.article.id] ?? item.article.unitPrice,
          discountPercent: 0,
        })),
      };

      if (isEditMode && orderId) {
        // Update existing order
        await updateOrderMutation.mutateAsync({ id: orderId, data: requestData });
        setHasUnsavedChanges(false);
        // Toast is shown by the mutation's onSuccess handler
        // Stay on the form after saving
      } else {
        // Create new order
        const createdOrder = await createOrderMutation.mutateAsync(requestData);
        
        // Remove the draft tab that was used to create this order
        // This prevents duplicate tabs (one draft + one saved)
        if (currentTabId && currentTab && !currentTab.orderId) {
          // Only remove if it's a draft tab (no orderId yet)
          removeTab(currentTabId);
        }
        
        // If the order was created, navigate to the edit view to allow further modifications
        if (createdOrder && createdOrder.id) {
          router.push(`/dashboard/sales-orders/${createdOrder.id}/edit`);
        }
        // The edit view will create a new tab with orderId for the saved order
      }
    } catch (error) {
      console.error('Error saving order:', error);
    }
  };

  const handleCancel = () => {
    if (orderId) {
      cancelOrderMutation.mutate(orderId, {
        onSuccess: () => {
          setShowCancelDialog(false);
          // Toast is shown by the mutation's onSuccess handler
          router.push('/dashboard/sales-orders');
        },
      });
    }
  };

  const handleDelete = () => {
    if (orderId) {
      deleteOrderMutation.mutate(orderId, {
        onSuccess: () => {
          // Remove tab from sidebar if it exists (find by orderId)
          const tabToRemove = tabs.find(tab => tab.orderId === orderId);
          if (tabToRemove) {
            removeTab(tabToRemove.id);
          }
          // Toast is shown by the mutation's onSuccess handler
          router.push('/dashboard/sales-orders');
        },
      });
    }
  };

  const handleGenerateInvoice = async () => {
    if (!orderId) return;

    // Check for unsaved changes
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('Hay cambios sin guardar. ¿Desea guardar los cambios antes de generar la factura?');
      if (confirmed) {
        await handleSubmit();
      }
    }

    try {
      const invoice = await generateInvoiceMutation.mutateAsync({ id: orderId });
      if (invoice) {
        router.push(`/dashboard/invoices/${invoice.id}`);
      }
    } catch (error) {
      console.error('Error generating invoice:', error);
    }
  };

  const handleGenerateDeliveryNote = async () => {
    if (!orderId) return;

    // Check for unsaved changes
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('Hay cambios sin guardar. ¿Desea guardar los cambios antes de generar el remito?');
      if (confirmed) {
        await handleSubmit();
      }
    }

    try {
      const deliveryNote = await generateDeliveryNoteMutation.mutateAsync({ id: orderId, deliveryData: {} });
      if (deliveryNote) {
        router.push(`/dashboard/delivery-notes/${deliveryNote.id}`);
      }
    } catch (error) {
      console.error('Error generating delivery note:', error);
    }
  };

  const handleBackButton = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedChangesDialog(true);
    } else {
      router.push('/dashboard/sales-orders');
    }
  };

  const handleUnsavedChangesResponse = async (action: 'save' | 'discard' | 'cancel') => {
    if (action === 'save') {
      setUnsavedChangesAction(action);
      await handleSubmit();
      setShowUnsavedChangesDialog(false);
      router.push('/dashboard/sales-orders');
    } else if (action === 'discard') {
      setUnsavedChangesAction(action);
      setShowUnsavedChangesDialog(false);
      router.push('/dashboard/sales-orders');
    } else {
      // action === 'cancel' - just close the dialog without setting state
      setShowUnsavedChangesDialog(false);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Stock Warnings - Compact */}
      {hasStockWarnings && (
        <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 py-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-red-900 dark:text-red-200">Advertencia de Stock</p>
          </div>
        </Alert>
      )}

      {/* Client and General Info Section */}
      <Card>
        <CardContent className="pt-4">
          <div>
            {clientId && clientName ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 p-2 bg-primary/10 border border-primary/20 rounded">
                  <User className="h-4 w-4 text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{clientName}</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearClient}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <ClientLookup onSelectClient={handleSelectClient} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Articles Section */}
      <Card className="flex-1">
        <CardContent className="pt-4">
          <div className="space-y-3">

              {/* Quick Article Lookup */}
              {!isReadOnly && (
                <div className="p-3 border rounded-lg bg-muted/30">
                <div className="flex items-start gap-2">
                  <div className="flex-1 relative">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        ref={codeInputRef}
                        value={articleCode}
                        onChange={(e) => {
                          setArticleCode(e.target.value.toUpperCase());
                          setShowCodeResults(true);
                          setSelectedArticle(null);
                        }}
                        onKeyDown={handleCodeKeyDown}
                        onFocus={() => articleCode && setShowCodeResults(true)}
                        onBlur={() => setTimeout(() => setShowCodeResults(false), 200)}
                        placeholder="Buscar artículo..."
                        className="pl-7 uppercase text-sm h-9"
                      />
                    </div>

                    {/* Search Results Dropdown */}
                    {showCodeResults && articleCode && articles.length > 0 && (
                      <Card className="absolute z-[60] w-full mt-1 max-h-[280px] overflow-auto shadow-xl">
                        <div className="p-1">
                          {articles.map((article, index) => (
                            <button
                              key={article.id}
                              ref={index === selectedIndex ? selectedItemRef : null}
                              onClick={() => handleSelectArticle(article, index)}
                              className={`w-full text-left p-2.5 rounded transition-colors ${
                                index === selectedIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'
                              }`}
                            >
                              <div className="flex justify-between items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-sm font-mono">
                                    {article.code}
                                  </div>
                                  <div className={`text-xs truncate mt-0.5 ${index === selectedIndex ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
                                    {article.description}
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="text-sm font-bold">
                                    {formatCurrency(article.unitPrice)}
                                  </div>
                                  <div className={`text-xs font-medium mt-0.5 ${
                                    index === selectedIndex 
                                      ? 'text-primary-foreground' 
                                      : getStockStatusClass(article.stock)
                                  }`}>
                                    Stock: {article.stock}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="px-3 py-2 bg-muted/50 text-xs text-muted-foreground border-t">
                          ↑↓ Navegar | Enter/Tab Seleccionar
                        </div>
                      </Card>
                    )}
                  </div>

                  <div className="w-20">
                    <Input
                      ref={quantityInputRef}
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      onKeyDown={handleQuantityKeyDown}
                      onFocus={(e) => e.target.select()}
                      placeholder="Cant."
                      className="text-center text-sm h-9"
                    />
                  </div>

                  <div className="pt-0">
                    <Button
                      size="sm"
                      onClick={handleAddArticle}
                      disabled={!selectedArticle && !articleCode}
                      className="h-9"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              )}

              {/* Items List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No hay artículos agregados</p>
                    <p className="text-xs mt-1">Usa el buscador para agregar</p>
                  </div>
                ) : (
                  items.map((item) => {
                    const hasStockIssue = item.quantity > item.article.stock;
                    return (
                      <div
                        key={item.article.id}
                        className={`border rounded-lg p-2.5 transition-colors ${
                          hasStockIssue
                            ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50'
                            : 'bg-card hover:bg-accent/5'
                        }`}
                      >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {editingItemId === item.article.id ? (
                            <div className="relative">
                              <div className="flex items-center gap-2 mb-2">
                                <Input
                                  ref={editInputRef}
                                  value={editCode}
                                  onChange={(e) => {
                                    setEditCode(e.target.value.toUpperCase());
                                    setShowEditResults(true);
                                  }}
                                  onKeyDown={handleEditKeyDown}
                                  onFocus={() => editCode && setShowEditResults(true)}
                                  onBlur={() => setTimeout(() => setShowEditResults(false), 200)}
                                  className="h-7 text-sm font-mono uppercase"
                                  placeholder="Buscar código..."
                                  autoFocus
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={handleCancelEdit}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>

                              {/* Edit Search Results */}
                              {showEditResults && editCode && editArticles.length > 0 && (
                                <Card className="absolute z-[70] w-full mt-1 max-h-[200px] overflow-auto shadow-xl">
                                  <div className="p-1">
                                    {editArticles.map((article, index) => (
                                      <button
                                        key={article.id}
                                        ref={index === selectedEditIndex ? selectedEditItemRef : null}
                                        onClick={() => handleSelectEditArticle(article)}
                                        className={`w-full text-left p-2 rounded transition-colors ${
                                          index === selectedEditIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'
                                        }`}
                                      >
                                        <div className="flex justify-between items-start gap-2">
                                          <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-xs font-mono">
                                              {article.code}
                                            </div>
                                            <div className={`text-xs truncate ${index === selectedEditIndex ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
                                              {article.description}
                                            </div>
                                          </div>
                                          <div className="text-xs">
                                            {formatCurrency(article.unitPrice)}
                                          </div>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                  <div className="px-2 py-1 bg-muted/50 text-xs text-muted-foreground border-t">
                                    ↑↓ Enter Esc
                                  </div>
                                </Card>
                              )}
                            </div>
                          ) : (
                            <div className="grid grid-cols-[2fr_3fr_1fr_1.5fr_auto] gap-2 items-center">
                              {/* Column 1: Code with Stock */}
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="font-medium text-sm font-mono">
                                    {item.article.code}
                                  </div>
                                  {!isReadOnly && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-4 w-4 p-0"
                                      onClick={() => handleEditItem(item.article.id, item.article.code)}
                                    >
                                      <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                    </Button>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <span>(Stock: <span className={getStockStatusClass(item.article.stock)}>{item.article.stock}</span>)</span>
                                  {item.quantity > item.article.stock && (
                                    <div title={`Stock insuficiente: solicitado ${item.quantity}, disponible ${item.article.stock}`}>
                                      <AlertTriangle 
                                        className="h-3 w-3 text-red-600 flex-shrink-0"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Column 2: Description */}
                              <div className="text-xs text-muted-foreground truncate">
                                {item.article.description}
                              </div>
                              
                              {/* Column 3: Quantity */}
                              <div>
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateQuantity(item.article.id, parseInt(e.target.value) || 1)}
                                  className="h-8 text-sm text-center"
                                  onFocus={(e) => e.target.select()}
                                  disabled={isReadOnly}
                                />
                              </div>
                              
                              {/* Column 4: Price */}
                              <div>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={prices[item.article.id] ?? item.article.unitPrice}
                                  onChange={(e) => handleUpdateUnitPrice(item.article.id, parseFloat(e.target.value) || 0)}
                                  className="h-8 text-sm text-right"
                                  onFocus={(e) => e.target.select()}
                                  disabled={isReadOnly}
                                />
                              </div>
                              
                              {/* Delete Button */}
                              {!isReadOnly && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleRemoveItem(item.article.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                  })
                )}
              </div>

              {/* Total */}
              {items.length > 0 && (
                <div className="flex justify-between items-center p-2.5 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-2xl font-bold">{formatCurrency(calculateTotal())}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      {/* Fixed Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t z-50">
        <div className="container max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleBackButton}
              >
                {isEditMode ? 'Volver' : 'Cancelar'}
              </Button>
              {permissions.canCancel && (
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={cancelOrderMutation.isPending}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancelar Pedido
                </Button>
              )}
              {permissions.canDelete && (
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleteOrderMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {permissions.canCreateDeliveryNote && !existingOrder?.deliveryNote && (
                <Button
                  variant="outline"
                  onClick={handleGenerateDeliveryNote}
                  disabled={generateDeliveryNoteMutation.isPending}
                >
                  <Truck className="mr-2 h-4 w-4" />
                  {generateDeliveryNoteMutation.isPending ? 'Generando...' : 'Generar Remito'}
                </Button>
              )}
              {existingOrder?.deliveryNote && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/delivery-notes/${existingOrder.deliveryNote?.id}`)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Ver Remito
                </Button>
              )}
              {permissions.canCreateInvoice && !existingOrder?.invoice && (
                <Button
                  variant="outline"
                  onClick={handleGenerateInvoice}
                  disabled={generateInvoiceMutation.isPending}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {generateInvoiceMutation.isPending ? 'Generando...' : 'Generar Factura'}
                </Button>
              )}
              {existingOrder?.invoice && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/invoices/${existingOrder.invoice?.id}`)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Ver Factura
                </Button>
              )}
              {permissions.canSave && (
                <Button
                  onClick={handleSubmit}
                  disabled={!clientId || items.length === 0 || (isEditMode ? updateOrderMutation.isPending : createOrderMutation.isPending)}
                  size="lg"
                >
                  {isEditMode 
                    ? (updateOrderMutation.isPending ? 'Guardando...' : 'Guardar Cambios')
                    : (createOrderMutation.isPending ? 'Creando...' : 'Crear Pedido')
                  }
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Order Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará el pedido como CANCELADO. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelOrderMutation.isPending}
            >
              {cancelOrderMutation.isPending ? 'Cancelando...' : 'Confirmar Cancelación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Order Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el pedido permanentemente. Esta acción no se puede deshacer.
              {existingOrder?.invoice?.isPrinted && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <strong>Nota:</strong> Este pedido tiene una factura impresa. Al eliminar el pedido, la factura será cancelada y el stock será devuelto automáticamente.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteOrderMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteOrderMutation.isPending ? 'Eliminando...' : 'Confirmar Eliminación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedChangesDialog} onOpenChange={setShowUnsavedChangesDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Guardar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Hay cambios sin guardar en el pedido. ¿Desea guardarlos antes de salir?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleUnsavedChangesResponse('cancel')}>
              Cancelar
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handleUnsavedChangesResponse('discard')}
            >
              No Guardar
            </Button>
            <AlertDialogAction onClick={() => handleUnsavedChangesResponse('save')}>
              Guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


