import { ShoppingCart, X, Trash2, Plus, User, Pencil, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useQuickCartTabs } from '@/lib/hooks/useQuickCartTabs';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { QuickArticleLookup } from './QuickArticleLookup';
import { ClientLookup } from './ClientLookup';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useArticles } from '@/lib/hooks/useArticles';
import type { Article } from '@/types/article';
import { CART_CONSTANTS } from '@/lib/constants/cart';

interface QuickCartPopupProps {
  isOpen: boolean;
  onClose: () => void;
  positions: ReturnType<typeof import('@/lib/constants/cart').calculateCartPositions>;
}

// Constants for cart sizing - use values from shared constants but allow overrides
const NORMAL_SIZE = { 
  width: CART_CONSTANTS.POPUP.WIDTH_NORMAL, 
  height: CART_CONSTANTS.POPUP.HEIGHT_NORMAL 
};
const MIN_SIZE = { 
  width: CART_CONSTANTS.POPUP.MIN_WIDTH, 
  height: CART_CONSTANTS.POPUP.MIN_HEIGHT 
};
const STORAGE_KEY_EXPANDED = 'spisa_quick_cart_expanded';
const STORAGE_KEY_CUSTOM_SIZE = 'spisa_quick_cart_custom_size';

export function QuickCartPopup({ isOpen, onClose, positions }: QuickCartPopupProps) {
  const router = useRouter();
  const [articleFocusTrigger, setArticleFocusTrigger] = useState(0);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editCode, setEditCode] = useState('');
  const [showEditResults, setShowEditResults] = useState(false);
  const [selectedEditIndex, setSelectedEditIndex] = useState(0);
  const editInputRef = useRef<HTMLInputElement>(null);
  const selectedEditItemRef = useRef<HTMLButtonElement>(null);
  
  // Expansion and resize states
  const [isExpanded, setIsExpanded] = useState(false);
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  const [customHeight, setCustomHeight] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeEdge, setResizeEdge] = useState<'left' | 'top' | 'right' | 'bottom' | 'corner-tl' | 'corner-tr' | 'corner-bl' | 'corner-br' | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number; bottom: number; right: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [tempPosition, setTempPosition] = useState<{ bottom: number; right: number } | null>(null);
  
  const {
    tabs,
    activeTab,
    addTab,
    removeTab,
    setActiveTab,
    setClient,
    clearClient,
    updateQuantity,
    removeItem,
    replaceItem,
    clearCart,
    getTotalValue,
  } = useQuickCartTabs();

  // Filter out saved orders (only show drafts without orderId in the popup)
  const draftTabs = tabs.filter(tab => !tab.orderId);
  
  // Get the active draft tab (for QuickCart operations)
  // If activeTab is a saved order, use the first draft tab instead
  const activeDraftTab = activeTab.orderId 
    ? draftTabs[0] || { id: '', name: '', items: [], createdAt: Date.now() }
    : activeTab;
  
  // Use items from the active draft tab only (not from saved orders)
  const items = activeDraftTab.items;

  // Search articles for editing
  const { data: editArticlesResult } = useArticles({
    searchTerm: editCode,
    activeOnly: true,
    pageSize: 5,
  });

  const editArticles = editArticlesResult?.data || [];

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedExpanded = localStorage.getItem(STORAGE_KEY_EXPANDED);
      const savedSize = localStorage.getItem(STORAGE_KEY_CUSTOM_SIZE);
      
      if (savedExpanded) {
        setIsExpanded(savedExpanded === 'true');
      }
      
      if (savedSize) {
        try {
          const size = JSON.parse(savedSize);
          setCustomWidth(size.width);
          setCustomHeight(size.height);
        } catch (e) {
          console.error('Error loading cart size:', e);
        }
      }
    }
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_EXPANDED, isExpanded.toString());
    }
  }, [isExpanded]);

  useEffect(() => {
    if (typeof window !== 'undefined' && (customWidth || customHeight)) {
      localStorage.setItem(STORAGE_KEY_CUSTOM_SIZE, JSON.stringify({
        width: customWidth,
        height: customHeight,
      }));
    }
  }, [customWidth, customHeight]);

  // Calculate current dimensions (responsive)
  const getCurrentDimensions = () => {
    if (isExpanded) {
      return {
        width: typeof window !== 'undefined' ? window.innerWidth * 0.95 : 1200,
        height: typeof window !== 'undefined' ? window.innerHeight * 0.85 : 700, // Reduced from 0.90 to 0.85
      };
    }
    
    // Use responsive dimensions from positions if available
    if (positions.isMobile) {
      return {
        width: positions.popup.width,
        height: positions.popup.height,
      };
    }
    
    if (customWidth || customHeight) {
      return {
        width: customWidth || NORMAL_SIZE.width,
        height: customHeight || NORMAL_SIZE.height,
      };
    }
    
    return {
      width: positions.popup.width,
      height: positions.popup.height,
    };
  };

  const currentDimensions = getCurrentDimensions();

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, edge: 'left' | 'top' | 'right' | 'bottom' | 'corner-tl' | 'corner-tr' | 'corner-bl' | 'corner-br') => {
    if (isExpanded) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const currentDims = getCurrentDimensions();
    
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: currentDims.width,
      height: currentDims.height,
      bottom: positions.popup.bottom,
      right: positions.popup.right,
    };
    
    setTempPosition(null);
    setIsResizing(true);
    setResizeEdge(edge);
  }, [isExpanded, getCurrentDimensions, positions.popup.bottom, positions.popup.right]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeStartRef.current || !resizeEdge) return;
    
    const deltaX = e.clientX - resizeStartRef.current.x;
    const deltaY = e.clientY - resizeStartRef.current.y;
    
    let newWidth = resizeStartRef.current.width;
    let newHeight = resizeStartRef.current.height;
    let newRight = resizeStartRef.current.right;
    let newBottom = resizeStartRef.current.bottom;
    
    const edge = resizeEdge;
    
    // Handle horizontal resizing
    if (edge.includes('left')) {
      // Drag LEFT (negative deltaX) = increase width, window expands left
      // Since we're anchored right, just increase width - no position change needed
      newWidth = Math.max(MIN_SIZE.width, resizeStartRef.current.width - deltaX);
    } else if (edge.includes('right') || edge === 'right') {
      // Drag RIGHT (positive deltaX) = increase width, window expands right
      newWidth = Math.max(MIN_SIZE.width, resizeStartRef.current.width + deltaX);
    }
    
    // Handle vertical resizing
    if (edge.includes('top')) {
      // Drag UP (negative deltaY) = increase height, window expands up
      // Since we're anchored bottom, just increase height - no position change needed
      newHeight = Math.max(MIN_SIZE.height, resizeStartRef.current.height - deltaY);
    } else if (edge.includes('bottom') || edge === 'bottom') {
      // Drag DOWN (positive deltaY) = increase height, window expands down
      newHeight = Math.max(MIN_SIZE.height, resizeStartRef.current.height + deltaY);
    }
    
    // Limit to viewport size
    if (typeof window !== 'undefined') {
      newWidth = Math.min(newWidth, window.innerWidth - 100);
      newHeight = Math.min(newHeight, window.innerHeight - 100);
    }
    
    setCustomWidth(newWidth);
    setCustomHeight(newHeight);
    // Position stays the same - no adjustment needed!
    setTempPosition(null);
  }, [isResizing, resizeEdge]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeEdge(null);
    resizeStartRef.current = null;
    setTempPosition(null);
    
    // Show confirmation that size was saved
    if (customWidth || customHeight) {
      toast.success('Tamaño guardado', {
        duration: 1500,
        position: 'bottom-center'
      });
    }
  }, [customWidth, customHeight]);

  // Add/remove resize event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      
      // Set cursor based on resize edge
      let cursor = 'default';
      if (resizeEdge === 'left' || resizeEdge === 'right') {
        cursor = 'ew-resize';
      } else if (resizeEdge === 'top' || resizeEdge === 'bottom') {
        cursor = 'ns-resize';
      } else if (resizeEdge === 'corner-tl' || resizeEdge === 'corner-br') {
        cursor = 'nwse-resize';
      } else if (resizeEdge === 'corner-tr' || resizeEdge === 'corner-bl') {
        cursor = 'nesw-resize';
      }
      
      document.body.style.cursor = cursor;
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, resizeEdge, handleResizeMove, handleResizeEnd]);

  // Toggle expanded mode
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Reset to default size
  const resetToDefaultSize = () => {
    setCustomWidth(null);
    setCustomHeight(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_CUSTOM_SIZE);
    }
    toast.success('Tamaño restablecido', {
      duration: 1500,
      position: 'bottom-center'
    });
  };

  // Reset selected index when edit articles change
  useEffect(() => {
    setSelectedEditIndex(0);
  }, [editArticles]);

  // Scroll to selected edit item
  useEffect(() => {
    if (selectedEditItemRef.current) {
      selectedEditItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedEditIndex]);

  // Refresh data and focus article search when cart opens
  useEffect(() => {
    if (isOpen) {
      // Force refresh from localStorage to get latest data
      // This ensures we see any changes made in the main form
      window.dispatchEvent(new Event('quick-cart-tabs-updated'));
      
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        setArticleFocusTrigger(prev => prev + 1);
      }, 100);
    }
  }, [isOpen]);

  // Auto-create a tab if none exist when cart opens
  useEffect(() => {
    if (isOpen && draftTabs.length === 0) {
      addTab();
    }
  }, [isOpen, draftTabs.length, addTab]);

  // Handle ESC key to close the cart
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !editingItemId) {
        // Only close if not editing an item
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose, editingItemId]);

  if (!isOpen) return null;

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

  const handleCreateOrder = () => {
    if (items.length === 0) {
      toast.error('Agrega al menos un artículo para crear el pedido', {
        duration: 2000,
        position: 'top-center'
      });
      return;
    }

    if (!activeDraftTab.clientId) {
      toast.error('Selecciona un cliente antes de crear el pedido', {
        duration: 2000,
        position: 'top-center'
      });
      return;
    }
    
    onClose();
    router.push(`/dashboard/sales-orders/new?fromQuickCart=true&tabId=${activeDraftTab.id}`);
  };

  const handleClearAll = () => {
    if (confirm('¿Limpiar todos los artículos de este pedido?')) {
      clearCart();
      toast.success('Lista limpiada', {
        duration: 2000,
        position: 'top-center'
      });
    }
  };

  const handleSelectClient = (clientId: number, clientName: string) => {
    setClient(clientId, clientName);
    toast.success(`Cliente ${clientName} seleccionado`, {
      duration: 2000,
      position: 'top-center'
    });
    // Trigger focus on article search
    setArticleFocusTrigger(prev => prev + 1);
  };

  const handleRemoveTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (draftTabs.length === 1) {
      toast.error('Debe mantener al menos un pedido', {
        duration: 2000,
        position: 'top-center'
      });
      return;
    }
    removeTab(tabId);
  };

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

    // Replace the article atomically
    replaceItem(editingItemId, article);
    
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

  // Calculate popup position based on whether there are fixed bottom buttons
  // When no fixed buttons: button is at bottom-6, so popup goes to bottom-24
  // When fixed buttons exist: button is at bottom-24, so popup needs more clearance
  const popupPosition = positions.popup.bottom;
  const popupRight = positions.popup.right;
  
  // Debug logging in development
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('🎨 Cart Popup positions:', {
      popupBottom: popupPosition,
      popupRight: popupRight,
      isExpanded,
      dimensions: currentDimensions,
      hasBottomBar: positions.hasBottomBar,
    });
  }
  
  return (
    <>
      <Card 
        ref={cardRef}
        className={`fixed shadow-2xl flex flex-col ${
          isExpanded ? '' : ''
        }`}
        style={{
          // When expanded: use inset, otherwise: use bottom/right anchor (with temp position during resize)
          ...(isExpanded ? {
            top: '1rem',
            left: '1rem',
            right: '1rem',
            bottom: '1rem',
          } : {
            top: 'auto',
            left: 'auto',
            bottom: `${tempPosition?.bottom ?? popupPosition}px`,
            right: `${tempPosition?.right ?? popupRight}px`,
          }),
          width: `${currentDimensions.width}px`,
          height: `${currentDimensions.height}px`,
          maxWidth: isExpanded ? '95vw' : undefined,
          maxHeight: isExpanded ? '85vh' : undefined,
          transition: isResizing ? 'none' : 'all 0.3s ease',
          resize: 'none',
          zIndex: CART_CONSTANTS.POPUP.Z_INDEX,
        }}
      >
      {/* Header with Tabs */}
      <div className="border-b bg-muted/30">
        <div className="flex items-center justify-between gap-2 p-2">
          {/* Left: Title and Tabs */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <ShoppingCart className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="flex items-center gap-1 overflow-x-auto">
              {draftTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors flex-shrink-0 ${
                    tab.id === activeDraftTab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background hover:bg-accent'
                  }`}
                >
                  {tab.clientName ? (
                    <User className="h-3 w-3" />
                  ) : (
                    <ShoppingCart className="h-3 w-3" />
                  )}
                  <span className="font-medium truncate max-w-[100px]">
                    {tab.clientName || tab.name}
                  </span>
                  {tab.items.length > 0 && (
                    <span className="text-[10px] opacity-70">({tab.items.length})</span>
                  )}
                  {draftTabs.length > 1 && (
                    <X
                      className="h-3 w-3 hover:bg-destructive/20 rounded"
                      onClick={(e) => handleRemoveTab(tab.id, e)}
                    />
                  )}
                </button>
              ))}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={addTab}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          {/* Right: Action Buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Reset Size Button - only show if custom size is set */}
            {(customWidth || customHeight) && !isExpanded && (
              <Button 
                variant="ghost" 
                size="icon"
                className="h-7 w-7"
                onClick={resetToDefaultSize}
                title="Restablecer tamaño"
              >
                <svg 
                  className="h-3.5 w-3.5" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                  />
                </svg>
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon"
              className="h-7 w-7"
              onClick={toggleExpanded}
              title={isExpanded ? 'Contraer' : 'Expandir'}
            >
              {isExpanded ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Client Selection */}
      <div className="p-2 border-b bg-background">
        {activeDraftTab.clientId ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 p-2 bg-primary/10 border border-primary/20 rounded">
              <User className="h-4 w-4 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{activeDraftTab.clientName}</div>
                <div className="text-xs text-muted-foreground">Cliente seleccionado</div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearClient()}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <ClientLookup onSelectClient={handleSelectClient} />
        )}
      </div>

      {/* Quick Article Lookup */}
      <div className="p-2 border-b bg-muted/5">
        <QuickArticleLookup autoFocus={false} focusTrigger={articleFocusTrigger} />
      </div>

      {items.length === 0 ? (
        /* Empty State */
        <div className="flex-1 flex items-center justify-center py-8 px-4">
          <div className="text-center text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay artículos</p>
            <p className="text-xs mt-1">Usa el buscador para agregar</p>
          </div>
        </div>
      ) : (
        <>
          {/* Items List */}
          <div className="flex-1 overflow-y-auto overflow-x-visible p-3 space-y-2">
            {items.map((item) => (
              <div
                key={item.article.id}
                className="border rounded p-2 hover:bg-accent/50 transition-colors"
              >
                {editingItemId === item.article.id ? (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative flex-1">
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
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-[2fr_3fr_1fr_1.5fr_auto] gap-2 items-center">
                    {/* Column 1: Code with Stock */}
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1">
                        <span className="font-medium font-mono text-sm">
                          {item.article.code}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0"
                          onClick={() => handleEditItem(item.article.id, item.article.code)}
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        (Stock: <span className={getStockStatusClass(item.article.stock)}>{item.article.stock}</span>)
                      </div>
                    </div>
                    
                    {/* Column 2: Description */}
                    <div className="text-xs text-muted-foreground truncate">
                      {item.article.description}
                    </div>
                    
                    {/* Column 3: Quantity */}
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const newQty = parseInt(e.target.value) || 1;
                        updateQuantity(item.article.id, newQty);
                      }}
                      className="w-full h-8 text-sm text-center"
                      onFocus={(e) => e.target.select()}
                    />
                    
                    {/* Column 4: Price */}
                    <div className="text-sm font-medium text-right">
                      {formatCurrency(item.article.unitPrice)}
                    </div>
                    
                    {/* Delete Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => removeItem(item.article.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Separator />

          {/* Footer */}
          <div className="p-2 space-y-2">
            <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
              <span className="text-sm text-muted-foreground">Total Estimado</span>
              <span className="text-xl font-bold">{formatCurrency(getTotalValue())}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                disabled={items.length === 0}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpiar
              </Button>
              <Button
                size="sm"
                onClick={handleCreateOrder}
                disabled={items.length === 0 || !activeDraftTab.clientId}
                className="w-full"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Crear Pedido
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Resize Handles - Only show when not expanded */}
      {!isExpanded && (
        <>
          {/* Left edge handle */}
          <div
            className="absolute top-0 left-0 w-2 h-full cursor-ew-resize hover:bg-primary/20 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'left')}
            style={{ zIndex: 60 }}
          />
          
          {/* Right edge handle */}
          <div
            className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-primary/20 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'right')}
            style={{ zIndex: 60 }}
          />
          
          {/* Top edge handle */}
          <div
            className="absolute top-0 left-0 w-full h-2 cursor-ns-resize hover:bg-primary/20 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'top')}
            style={{ zIndex: 60 }}
          />
          
          {/* Bottom edge handle */}
          <div
            className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize hover:bg-primary/20 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'bottom')}
            style={{ zIndex: 60 }}
          />
          
          {/* Top-left corner handle */}
          <div
            className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize hover:bg-primary/30 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'corner-tl')}
            style={{ zIndex: 61 }}
          >
            <svg className="w-full h-full text-muted-foreground/40" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 6V5h1v1H1zm0-3V2h1v1H1zm3 0V2h1v1H4zm3 0V2h1v1H7z" />
            </svg>
          </div>
          
          {/* Top-right corner handle */}
          <div
            className="absolute top-0 right-0 w-4 h-4 cursor-nesw-resize hover:bg-primary/30 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'corner-tr')}
            style={{ zIndex: 61 }}
          >
            <svg className="w-full h-full text-muted-foreground/40" viewBox="0 0 16 16" fill="currentColor">
              <path d="M15 2v1h-1V2h1zm0 3v1h-1V5h1zM9 2v1H8V2h1zm3 0v1h-1V2h1z" />
            </svg>
          </div>
          
          {/* Bottom-left corner handle */}
          <div
            className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize hover:bg-primary/30 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'corner-bl')}
            style={{ zIndex: 61 }}
          >
            <svg className="w-full h-full text-muted-foreground/40" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 10v1h1v-1H1zm0 3v1h1v-1H1zm3 0v1h1v-1H4zm3 0v1H7v-1h1z" />
            </svg>
          </div>
          
          {/* Bottom-right corner handle */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-primary/30 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'corner-br')}
            style={{ zIndex: 61 }}
          >
            <svg className="w-full h-full text-muted-foreground/40" viewBox="0 0 16 16" fill="currentColor">
              <path d="M15 10v1h-1v-1h1zm0 3v1h-1v-1h1zm-3 0v1h-1v-1h1zm-3 0v1H8v-1h1z" />
            </svg>
          </div>
        </>
      )}

      {/* Size Indicator Overlay - Show while resizing */}
      {isResizing && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none" style={{ zIndex: 70 }}>
          <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg">
            <div className="text-sm font-medium">
              {currentDimensions.width} × {currentDimensions.height}
            </div>
          </div>
        </div>
      )}
    </Card>

    {/* Edit Search Results Dropdown - Floating */}
    {showEditResults && editCode && editArticles.length > 0 && editingItemId && (
      <Card 
        className="fixed w-[380px] max-h-[280px] overflow-auto shadow-2xl"
        style={{
          bottom: `${positions.editDropdown.bottom}px`,
          right: `${positions.editDropdown.right}px`,
          zIndex: CART_CONSTANTS.EDIT_DROPDOWN.Z_INDEX,
          transition: 'all 0.3s ease',
        }}
      >
        <div className="p-1">
          {editArticles.map((article, index) => (
            <button
              key={article.id}
              ref={index === selectedEditIndex ? selectedEditItemRef : null}
              onClick={() => handleSelectEditArticle(article)}
              className={`w-full text-left p-2 rounded transition-colors ${
                index === selectedEditIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm font-mono ${index === selectedEditIndex ? 'text-primary-foreground' : ''}`}>
                    {article.code}
                  </div>
                  <div className={`text-xs truncate mt-0.5 ${index === selectedEditIndex ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
                    {article.description}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-xs font-bold ${index === selectedEditIndex ? 'text-primary-foreground' : 'text-foreground'}`}>
                    {formatCurrency(article.unitPrice)}
                  </div>
                  <div className={`text-xs font-medium mt-0.5 ${
                    index === selectedEditIndex 
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
        <div className="px-2 py-1.5 bg-muted/50 text-xs text-muted-foreground border-t">
          ↑↓ Navegar | Enter Seleccionar
        </div>
      </Card>
    )}
    </>
  );
}


