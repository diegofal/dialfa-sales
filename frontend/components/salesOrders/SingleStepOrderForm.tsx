'use client';

import {
  ShoppingCart,
  User,
  X,
  Trash2,
  Pencil,
  Search,
  Plus,
  FileText,
  AlertTriangle,
  Truck,
  Eye,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { ClientLookup } from '@/components/articles/ClientLookup';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ROUTES } from '@/lib/constants/routes';
import { useArticles } from '@/lib/hooks/domain/useArticles';
import { useClient } from '@/lib/hooks/domain/useClients';
import { usePaymentTerms } from '@/lib/hooks/domain/usePaymentTerms';
import { useQuickCartTabs, QuickCartItem } from '@/lib/hooks/domain/useQuickCartTabs';
import { useSalesOrderPermissions } from '@/lib/hooks/domain/useSalesOrderPermissions';
import {
  useCreateSalesOrder,
  useGenerateInvoice,
  useGenerateDeliveryNote,
} from '@/lib/hooks/domain/useSalesOrders';
import {
  useSalesOrder,
  useUpdateSalesOrder,
  useDeleteSalesOrder,
} from '@/lib/hooks/domain/useSalesOrders';
import { useFormValidation, validators } from '@/lib/hooks/generic/useFormValidation';
import { validateSalesOrder } from '@/lib/permissions/salesOrders';
import { formatCuit } from '@/lib/utils';
import type { Article } from '@/types/article';

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
  const {
    data: existingOrder,
    isLoading: isLoadingOrder,
    error: orderError,
  } = useSalesOrder(orderId || 0);

  // Check if order was deleted or not found
  useEffect(() => {
    if (orderError && orderId) {
      const err = orderError as { response?: { status?: number; data?: { error?: string } } };
      if (err?.response?.status === 404) {
        toast.error('El pedido no existe o ha sido eliminado');
        router.push(ROUTES.SALES_ORDERS);
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
  const [paymentTermId, setPaymentTermId] = useState<number | undefined>(undefined);

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
  const deleteOrderMutation = useDeleteSalesOrder();
  const generateInvoiceMutation = useGenerateInvoice();
  const generateDeliveryNoteMutation = useGenerateDeliveryNote();

  // Dialog states for edit mode
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const [, setUnsavedChangesAction] = useState<'save' | 'discard' | null>(null);

  // Load payment terms for dropdown
  const { data: paymentTerms } = usePaymentTerms({ activeOnly: true });

  // Form validation
  const { validate, getError, clearError } = useFormValidation([
    {
      field: 'paymentTermId',
      validate: validators.required('Debe seleccionar una condición de pago'),
    },
  ]);

  // Track unprinted documents that will be regenerated
  const [hasUnprintedDocs, setHasUnprintedDocs] = useState<{
    invoice: boolean;
    deliveryNote: boolean;
  } | null>(null);

  // Search articles for adding
  const { data: articlesResult } = useArticles({
    searchTerm: articleCode,
    activeOnly: false, // Include discontinued articles
    pageSize: 5,
  });
  const articles = articlesResult?.data || [];

  // Search articles for editing
  const { data: editArticlesResult } = useArticles({
    searchTerm: editCode,
    activeOnly: false, // Include discontinued articles
    pageSize: 5,
  });
  const editArticles = editArticlesResult?.data || [];

  // Get current tab - use activeTab when not from QuickCart or when currentTabId changes
  // BUT: In edit mode, use local state instead of Quick Cart tabs
  const currentTab = currentTabId ? tabs.find((t) => t.id === currentTabId) : activeTab;
  const items = isEditMode ? localItems : currentTab ? currentTab.items : [];
  const clientId = isEditMode ? localClientId : currentTab?.clientId;
  const clientName = isEditMode ? localClientName : currentTab?.clientName || '';

  // Load client data to fetch payment term (use clientId which works in both modes)
  const { data: clientData } = useClient(clientId || 0);

  // Track changes for unsaved changes detection
  useEffect(() => {
    if (isEditMode && existingOrder && loadedOrderId === existingOrder.id) {
      // Check if anything changed
      const itemsCountChanged = items.length !== (existingOrder.items?.length || 0);

      // Check if quantities changed
      const quantitiesChanged = items.some((item) => {
        const originalItem = existingOrder.items?.find((i) => i.articleId === item.article.id);
        return originalItem && originalItem.quantity !== item.quantity;
      });

      // Check if any items are different
      const itemsChanged = itemsCountChanged || quantitiesChanged;

      const clientChanged = clientId !== existingOrder.clientId;
      const notesChanged = (notes || '') !== (existingOrder.notes || '');

      const hasChanges = itemsChanged || clientChanged || notesChanged;
      setHasUnsavedChanges(hasChanges);
    }
  }, [isEditMode, existingOrder, loadedOrderId, items, clientId, notes]);

  // Detect unprinted documents that will be regenerated on save
  useEffect(() => {
    if (isEditMode && existingOrder) {
      const hasUnprintedInvoice =
        existingOrder.invoice &&
        !existingOrder.invoice.isPrinted &&
        !existingOrder.invoice.isCancelled;
      const hasUnprintedDeliveryNote =
        existingOrder.deliveryNote && !existingOrder.deliveryNote.isPrinted;

      if (hasUnprintedInvoice || hasUnprintedDeliveryNote) {
        setHasUnprintedDocs({
          invoice: !!hasUnprintedInvoice,
          deliveryNote: !!hasUnprintedDeliveryNote,
        });
      } else {
        setHasUnprintedDocs(null);
      }
    }
  }, [isEditMode, existingOrder]);

  // Load existing order data into form when in edit mode
  useEffect(() => {
    // Only load if we're in edit mode, have the order data, and haven't loaded this specific order yet
    if (isEditMode && existingOrder && loadedOrderId !== existingOrder.id) {
      // For edit mode, create a tab for sidebar navigation but use local state for the form
      const orderItems: QuickCartItem[] = [];
      if (existingOrder.items && existingOrder.items.length > 0) {
        existingOrder.items.forEach((item) => {
          // Set prices
          setPrices((prev) => ({ ...prev, [item.articleId]: item.unitPrice }));

          // Add to items array with real stock from backend
          orderItems.push({
            article: {
              id: item.articleId,
              code: item.articleCode,
              description: item.articleDescription,
              unitPrice: item.unitPrice,
              stock: item.stock || 0,
              categoryDefaultDiscount: 0, // No usado en pedidos
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
      setPaymentTermId(existingOrder.paymentTermId || undefined);

      setLoadedFromCart(true);
      setLoadedOrderId(existingOrder.id);
    }
  }, [isEditMode, existingOrder, loadedOrderId, addOrUpdateOrderTab]);

  // Load client data and set paymentTermId when client is selected or changed
  useEffect(() => {
    if (clientData && !isLoadingOrder) {
      // In edit mode, don't override the payment term from the loaded order
      // The order's payment term should take precedence
      if (isEditMode) {
        // Only set from client if we're in edit mode but haven't loaded the order yet
        // AND we don't have a paymentTermId
        if (!loadedOrderId && !paymentTermId && clientData.paymentTermId) {
          setPaymentTermId(clientData.paymentTermId);
          clearError('paymentTermId');
        }
        return;
      }

      // In creation mode, ALWAYS use the client's payment term
      // This ensures it updates when switching tabs or clients
      if (clientData.paymentTermId) {
        setPaymentTermId(clientData.paymentTermId);
        clearError('paymentTermId');
      }
    }
  }, [clientData, isLoadingOrder, isEditMode, loadedOrderId, clearError]);

  // Update currentTabId when activeTab changes (from sidebar clicks)
  useEffect(() => {
    if (
      fromQuickCart &&
      activeTab &&
      activeTab.id &&
      (!currentTabId || activeTab.id !== currentTabId)
    ) {
      // When switching tabs in creation mode, reset paymentTermId
      // This ensures it reloads from the new client
      if (!isEditMode) {
        setPaymentTermId(undefined);
      }
      setCurrentTabId(activeTab.id);
    }
  }, [activeTab, fromQuickCart, currentTabId, isEditMode]);

  // Load data from quick cart if coming from there
  useEffect(() => {
    if (fromQuickCart && !loadedFromCart && tabs.length > 0) {
      // Set the active tab
      if (tabId) {
        const tab = tabs.find((t) => t.id === tabId);
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
  const hasStockWarnings = items.some((item) => item.quantity > item.article.stock);

  // Show loading state when loading existing order
  if (isEditMode && isLoadingOrder) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">Cargando pedido...</p>
      </div>
    );
  }

  // Show error state if order not found
  if (isEditMode && !isLoadingOrder && !existingOrder) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Pedido no encontrado</p>
        <Button onClick={() => router.push(ROUTES.SALES_ORDERS)}>Volver al listado</Button>
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
        position: 'top-center',
      });
    } else if (currentTabId) {
      // In draft mode, update QuickCart tab
      setClient(id, name);
      toast.success(`Cliente ${name} seleccionado`, {
        duration: 2000,
        position: 'top-center',
      });
    }
  };

  const handleClearClient = () => {
    if (isEditMode) {
      // In edit mode, clear local state
      setLocalClientId(undefined);
      setLocalClientName('');
      setPaymentTermId(undefined);
    } else if (currentTabId) {
      // In draft mode, clear QuickCart tab
      clearClient();
      setPaymentTermId(undefined);
    }
  };

  const handlePaymentTermChange = async (value: string) => {
    const newPaymentTermId = Number(value);
    setPaymentTermId(newPaymentTermId);
    clearError('paymentTermId');

    // Update client payment term if we have a selected client
    if (clientId) {
      try {
        const response = await fetch(`/api/clients/${clientId}/payment-term`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentTermId: newPaymentTermId }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('Error updating client payment term:', error);
          toast.error('No se pudo actualizar la condición de pago del cliente');
        } else {
          toast.success('Condición de pago actualizada', {
            duration: 2000,
            position: 'top-center',
          });
        }
      } catch (error) {
        console.error('Error updating client payment term:', error);
      }
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
        position: 'top-center',
      });
      codeInputRef.current?.focus();
      return;
    }

    const qty = parseInt(quantity) || 1;
    if (qty <= 0) {
      toast.error('La cantidad debe ser mayor a 0', {
        duration: 2000,
        position: 'top-center',
      });
      quantityInputRef.current?.focus();
      return;
    }

    if (isEditMode) {
      // In edit mode, update local state
      const existingIndex = localItems.findIndex((item) => item.article.id === articleToAdd!.id);
      let updatedItems: QuickCartItem[];

      if (existingIndex >= 0) {
        updatedItems = [...localItems];
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          quantity: updatedItems[existingIndex].quantity + qty,
        };
      } else {
        updatedItems = [
          ...localItems,
          {
            article: articleToAdd!,
            quantity: qty,
          },
        ];
      }

      setLocalItems(updatedItems);
    } else if (currentTabId) {
      // In draft mode, use QuickCart hook's addItem function
      addItem(articleToAdd, qty);
    }

    toast.success(`${articleToAdd.code} agregado`, {
      duration: 2000,
      position: 'top-center',
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
      const updatedItems = localItems.map((item) =>
        item.article.id === editingItemId
          ? { article, quantity: item.quantity, discountPercent: item.discountPercent }
          : item
      );
      setLocalItems(updatedItems);
    } else if (currentTabId) {
      // In draft mode, use hook's replaceItem function
      replaceItem(editingItemId, article);
    }

    toast.success(`Artículo actualizado a ${article.code}`, {
      duration: 2000,
      position: 'top-center',
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
      setLocalItems(localItems.filter((item) => item.article.id !== articleId));
    } else if (currentTabId) {
      // In draft mode, use QuickCart hook
      removeItem(articleId);
    }

    toast.success('Artículo eliminado', {
      duration: 2000,
      position: 'top-center',
    });
  };

  const handleUpdateQuantity = (articleId: number, newQuantity: number) => {
    if (newQuantity <= 0) return;

    if (isEditMode) {
      // In edit mode, update local state
      setLocalItems(
        localItems.map((item) =>
          item.article.id === articleId ? { ...item, quantity: newQuantity } : item
        )
      );
    } else if (currentTabId) {
      // In draft mode, use QuickCart hook
      updateQuantity(articleId, newQuantity);
    }
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
    // Client-side validation
    if (!validate({ paymentTermId })) {
      toast.error('Debe seleccionar una condición de pago', {
        duration: 3000,
        position: 'top-center',
      });
      return;
    }

    // Validation using the validation helper
    const validation = validateSalesOrder(
      clientId,
      items.map((item) => ({
        quantity: item.quantity,
        stock: item.article.stock,
        articleDescription: item.article.description,
      })),
      true // Allow low stock with warning
    );

    if (!validation.isValid) {
      validation.errors.forEach((error) =>
        toast.error(error, { duration: 3000, position: 'top-center' })
      );
      return;
    }

    // Show warnings if any
    if (validation.warnings.length > 0) {
      validation.warnings.forEach((warning) =>
        toast.warning(warning, { duration: 4000, position: 'top-center' })
      );
    }

    // Validate items
    for (const item of items) {
      const unitPrice = prices[item.article.id] ?? item.article.unitPrice;
      if (unitPrice < 0) {
        toast.error(`El precio de ${item.article.code} no puede ser negativo`, {
          duration: 3000,
          position: 'top-center',
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
        paymentTermId: paymentTermId,
        notes: notes || undefined,
        items: items.map((item) => ({
          articleId: item.article.id,
          quantity: item.quantity,
          unitPrice: prices[item.article.id] ?? item.article.unitPrice,
          discountPercent: 0, // Los pedidos no manejan descuentos
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
          router.push(`${ROUTES.SALES_ORDERS}/${createdOrder.id}/edit`);
        }
        // The edit view will create a new tab with orderId for the saved order
      }
    } catch (error) {
      console.error('Error saving order:', error);
    }
  };

  const handleDelete = () => {
    if (orderId) {
      deleteOrderMutation.mutate(orderId, {
        onSuccess: () => {
          // Remove tab from sidebar if it exists (find by orderId)
          const tabToRemove = tabs.find((tab) => tab.orderId === orderId);
          if (tabToRemove) {
            removeTab(tabToRemove.id);
          }
          // Toast is shown by the mutation's onSuccess handler
          router.push(ROUTES.SALES_ORDERS);
        },
      });
    }
  };

  const handleGenerateInvoice = async () => {
    if (!orderId) return;

    // Check for unsaved changes
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'Hay cambios sin guardar. ¿Desea guardar los cambios antes de generar la factura?'
      );
      if (confirmed) {
        await handleSubmit();
      }
    }

    try {
      const invoice = await generateInvoiceMutation.mutateAsync({ id: orderId });
      if (invoice) {
        router.push(`${ROUTES.INVOICES}/${invoice.id}`);
      }
    } catch (error) {
      console.error('Error generating invoice:', error);
    }
  };

  const handleGenerateDeliveryNote = async () => {
    if (!orderId) return;

    // Check for unsaved changes
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'Hay cambios sin guardar. ¿Desea guardar los cambios antes de generar el remito?'
      );
      if (confirmed) {
        await handleSubmit();
      }
    }

    try {
      const deliveryNote = await generateDeliveryNoteMutation.mutateAsync({
        id: orderId,
        deliveryData: {},
      });
      if (deliveryNote) {
        router.push(`${ROUTES.DELIVERY_NOTES}/${deliveryNote.id}`);
      }
    } catch (error) {
      console.error('Error generating delivery note:', error);
    }
  };

  const handleBackButton = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedChangesDialog(true);
    } else {
      router.push(ROUTES.SALES_ORDERS);
    }
  };

  const handleUnsavedChangesResponse = async (action: 'save' | 'discard' | 'cancel') => {
    if (action === 'save') {
      setUnsavedChangesAction(action);
      await handleSubmit();
      setShowUnsavedChangesDialog(false);
      router.push(ROUTES.SALES_ORDERS);
    } else if (action === 'discard') {
      setUnsavedChangesAction(action);
      setShowUnsavedChangesDialog(false);
      router.push(ROUTES.SALES_ORDERS);
    } else {
      // action === 'cancel' - just close the dialog without setting state
      setShowUnsavedChangesDialog(false);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Stock Warnings - Compact */}
      {hasStockWarnings && (
        <Alert
          variant="destructive"
          className="border-red-300 bg-red-50 py-2 dark:border-red-800 dark:bg-red-950/30"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-500" />
            <p className="text-sm font-semibold text-red-900 dark:text-red-200">
              Advertencia de Stock
            </p>
          </div>
        </Alert>
      )}

      {/* Client and General Info Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Información del Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            {clientId && clientName ? (
              <div className="space-y-4">
                <div className="bg-primary/10 border-primary/20 flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <User className="text-primary h-5 w-5" />
                    <div>
                      <p className="text-sm font-medium">{clientName}</p>
                      {existingOrder && (
                        <p className="text-muted-foreground font-mono text-xs">
                          CUIT: {formatCuit(existingOrder.clientCuit)}
                        </p>
                      )}
                    </div>
                  </div>
                  {!isReadOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleClearClient}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Payment Term Field */}
                <FormField
                  label="Condición de Pago"
                  required
                  error={getError('paymentTermId')}
                  htmlFor="paymentTermId"
                >
                  <Select
                    value={paymentTermId?.toString()}
                    onValueChange={handlePaymentTermChange}
                    disabled={isReadOnly || !clientId}
                  >
                    <SelectTrigger id="paymentTermId">
                      <SelectValue placeholder="Seleccionar condición de pago" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentTerms?.map((term) => (
                        <SelectItem key={term.id} value={term.id.toString()}>
                          {term.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            ) : (
              <ClientLookup onSelectClient={handleSelectClient} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Información del Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Número de Pedido</p>
                <p className="font-medium">{existingOrder?.orderNumber || 'Borrador'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Estado</p>
                <div>
                  {existingOrder ? (
                    existingOrder.invoice && !existingOrder.invoice.isCancelled ? (
                      <Badge
                        className={existingOrder.invoice.isPrinted ? 'bg-green-600' : 'bg-blue-600'}
                      >
                        {existingOrder.invoice.isPrinted ? 'Facturado e Impreso' : 'Facturado'}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Pendiente</Badge>
                    )
                  ) : (
                    <Badge variant="outline">Nuevo</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orderNotes">Observaciones</Label>
              <textarea
                id="orderNotes"
                className="bg-background focus:ring-primary min-h-[80px] w-full resize-none rounded-md border p-2 text-sm focus:ring-1 focus:outline-none"
                placeholder="Notas adicionales para el pedido..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Articles Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Items</CardTitle>
            <CardDescription>{items.length} artículo(s)</CardDescription>
          </div>
          {!isReadOnly && (
            <div className="ml-4 flex max-w-md flex-1 items-center gap-2">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
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
                  placeholder="Buscar código o descripción..."
                  className="h-9 pl-9 uppercase"
                />

                {/* Search Results Dropdown */}
                {showCodeResults && articleCode && articles.length > 0 && (
                  <Card className="absolute z-[60] mt-1 max-h-[300px] w-full overflow-auto shadow-xl">
                    <div className="p-1">
                      {articles.map((article, index) => (
                        <button
                          key={article.id}
                          ref={index === selectedIndex ? selectedItemRef : null}
                          onClick={() => handleSelectArticle(article, index)}
                          className={`w-full rounded p-2 text-left transition-colors ${
                            index === selectedIndex
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-accent hover:text-accent-foreground'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="font-mono text-sm font-semibold">{article.code}</div>
                              <div
                                className={`truncate text-xs ${index === selectedIndex ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}
                              >
                                {article.description}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold">
                                {formatCurrency(article.unitPrice)}
                              </div>
                              <div
                                className={`text-xs ${index === selectedIndex ? 'text-primary-foreground' : getStockStatusClass(article.stock)}`}
                              >
                                Stock: {article.stock}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
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
                  className="h-9 text-center"
                />
              </div>
              <Button
                size="sm"
                onClick={handleAddArticle}
                disabled={!selectedArticle && !articleCode}
                className="h-9"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center">
              <ShoppingCart className="mx-auto mb-4 h-12 w-12 opacity-20" />
              <p>No hay artículos en este pedido</p>
              {!isReadOnly && (
                <p className="mt-1 text-sm">Usa el buscador para agregar artículos</p>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">Código</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-[100px] text-right">Cantidad</TableHead>
                    <TableHead className="w-[140px] text-right">Precio Unit.</TableHead>
                    <TableHead className="w-[140px] text-right">Total</TableHead>
                    {!isReadOnly && <TableHead className="w-[50px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const hasStockIssue = item.quantity > item.article.stock;
                    return (
                      <TableRow
                        key={item.article.id}
                        className={hasStockIssue ? 'bg-red-50 dark:bg-red-950/20' : ''}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            {editingItemId === item.article.id ? (
                              <div className="relative">
                                <Input
                                  ref={editInputRef}
                                  value={editCode}
                                  onChange={(e) => {
                                    setEditCode(e.target.value.toUpperCase());
                                    setShowEditResults(true);
                                  }}
                                  onKeyDown={handleEditKeyDown}
                                  className="h-8 font-mono text-xs uppercase"
                                  autoFocus
                                />
                                {showEditResults && editCode && editArticles.length > 0 && (
                                  <Card className="absolute z-[70] mt-1 w-[300px] shadow-xl">
                                    <div className="p-1">
                                      {editArticles.map((article, index) => (
                                        <button
                                          key={article.id}
                                          onClick={() => handleSelectEditArticle(article)}
                                          className={`w-full rounded p-2 text-left text-xs ${
                                            index === selectedEditIndex
                                              ? 'bg-primary text-primary-foreground'
                                              : 'hover:bg-accent'
                                          }`}
                                        >
                                          <div className="font-mono font-bold">{article.code}</div>
                                          <div className="truncate opacity-80">
                                            {article.description}
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  </Card>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-medium">{item.article.code}</span>
                                {!isReadOnly && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
                                    onClick={() =>
                                      handleEditItem(item.article.id, item.article.code)
                                    }
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            )}
                            <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
                              <span>
                                Stock:{' '}
                                <span className={getStockStatusClass(item.article.stock)}>
                                  {item.article.stock}
                                </span>
                              </span>
                              {hasStockIssue && <AlertTriangle className="h-3 w-3 text-red-600" />}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="line-clamp-1 text-sm" title={item.article.description}>
                            {item.article.description}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateQuantity(item.article.id, parseInt(e.target.value) || 1)
                            }
                            className="ml-auto h-8 w-20 text-right text-sm"
                            disabled={isReadOnly}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium">
                            {formatCurrency(prices[item.article.id] ?? item.article.unitPrice)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(calculateLineTotal(item))}
                        </TableCell>
                        {!isReadOnly && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                              onClick={() => handleRemoveItem(item.article.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totals Section */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <Card className="w-full md:w-[400px]">
            <CardHeader className="py-4">
              <CardTitle className="text-lg">Resumen del Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(calculateTotal())}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IVA (Estimado)</span>
                <span>{formatCurrency(calculateTotal() * 0.21)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <span className="font-bold">Total Final</span>
                <span className="text-primary text-2xl font-bold">
                  {formatCurrency(calculateTotal() * 1.21)}
                </span>
              </div>
              <p className="text-muted-foreground text-right text-[10px] italic">
                * El IVA se calcula formalmente al generar la factura
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Warning Alert for Unprinted Documents Update */}
      {hasUnprintedDocs && hasUnsavedChanges && (
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          <AlertTitle className="text-amber-900 dark:text-amber-100">
            Documentos serán actualizados
          </AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Este pedido tiene {hasUnprintedDocs.invoice && 'una factura'}
            {hasUnprintedDocs.invoice && hasUnprintedDocs.deliveryNote && ' y '}
            {hasUnprintedDocs.deliveryNote && 'un remito'} no impreso(s). Al guardar, se
            actualizarán automáticamente con la nueva información. Los números de documento se
            mantendrán sin cambios.
          </AlertDescription>
        </Alert>
      )}

      {/* Fixed Action Buttons */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed right-0 bottom-0 left-0 z-50 border-t backdrop-blur">
        <div className="container mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBackButton}>
                {isEditMode ? 'Volver' : 'Cancelar'}
              </Button>
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
                  onClick={() =>
                    router.push(`${ROUTES.DELIVERY_NOTES}/${existingOrder.deliveryNote?.id}`)
                  }
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Ver Remito
                </Button>
              )}
              {permissions.canCreateInvoice &&
                (!existingOrder?.invoice || existingOrder.invoice.isCancelled) && (
                  <Button
                    variant="outline"
                    onClick={handleGenerateInvoice}
                    disabled={generateInvoiceMutation.isPending}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {generateInvoiceMutation.isPending ? 'Generando...' : 'Generar Factura'}
                  </Button>
                )}
              {existingOrder?.invoice && !existingOrder.invoice.isCancelled && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`${ROUTES.INVOICES}/${existingOrder.invoice?.id}`)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Ver Factura
                </Button>
              )}
              {isEditMode && permissions.canEdit && (
                <Button
                  onClick={handleSubmit}
                  disabled={
                    !clientId ||
                    items.length === 0 ||
                    updateOrderMutation.isPending ||
                    !hasUnsavedChanges
                  }
                  size="lg"
                  variant={hasUnsavedChanges ? 'default' : 'outline'}
                >
                  {updateOrderMutation.isPending
                    ? 'Guardando...'
                    : hasUnsavedChanges
                      ? 'Guardar Cambios'
                      : 'Sin cambios'}
                </Button>
              )}
              {!isEditMode && (
                <Button
                  onClick={handleSubmit}
                  disabled={!clientId || items.length === 0 || createOrderMutation.isPending}
                  size="lg"
                >
                  {createOrderMutation.isPending ? 'Creando...' : 'Crear Pedido'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Order Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el pedido permanentemente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
            {existingOrder?.invoice?.isPrinted && (
              <div className="mt-2 rounded border border-yellow-200 bg-yellow-50 p-2 text-sm">
                <strong>Nota:</strong> Este pedido tiene una factura impresa. Al eliminar el pedido,
                la factura será cancelada y el stock será devuelto automáticamente.
              </div>
            )}
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
            <Button variant="outline" onClick={() => handleUnsavedChangesResponse('discard')}>
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
