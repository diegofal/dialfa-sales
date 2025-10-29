'use client';

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

interface QuickCartPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

// Constants for cart sizing
const NORMAL_SIZE = { width: 520, height: 750 };
const MIN_SIZE = { width: 400, height: 400 };
const STORAGE_KEY_EXPANDED = 'spisa_quick_cart_expanded';
const STORAGE_KEY_CUSTOM_SIZE = 'spisa_quick_cart_custom_size';

export function QuickCartPopup({ isOpen, onClose }: QuickCartPopupProps) {
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
  const [resizeEdge, setResizeEdge] = useState<'left' | 'top' | 'corner' | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const {
    tabs,
    activeTab,
    items,
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
    getActiveTabTotalItems,
  } = useQuickCartTabs();

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

  // Calculate current dimensions
  const getCurrentDimensions = () => {
    if (isExpanded) {
      return {
        width: typeof window !== 'undefined' ? window.innerWidth * 0.95 : 1200,
        height: typeof window !== 'undefined' ? window.innerHeight * 0.90 : 800,
      };
    }
    
    if (customWidth || customHeight) {
      return {
        width: customWidth || NORMAL_SIZE.width,
        height: customHeight || NORMAL_SIZE.height,
      };
    }
    
    return NORMAL_SIZE;
  };

  const currentDimensions = getCurrentDimensions();

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, edge: 'left' | 'top' | 'corner') => {
    if (isExpanded) return; // Don't allow resize in expanded mode
    
    e.preventDefault();
    e.stopPropagation();
    
    const currentDims = getCurrentDimensions();
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: currentDims.width,
      height: currentDims.height,
    };
    
    setIsResizing(true);
    setResizeEdge(edge);
  }, [isExpanded]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeStartRef.current || !resizeEdge) return;
    
    // For left and top edges, we need to subtract the delta because we're resizing from the opposite side
    const deltaX = resizeStartRef.current.x - e.clientX; // Inverted for left edge
    const deltaY = resizeStartRef.current.y - e.clientY; // Inverted for top edge
    
    let newWidth = resizeStartRef.current.width;
    let newHeight = resizeStartRef.current.height;
    
    if (resizeEdge === 'left' || resizeEdge === 'corner') {
      newWidth = Math.max(MIN_SIZE.width, resizeStartRef.current.width + deltaX);
    }
    
    if (resizeEdge === 'top' || resizeEdge === 'corner') {
      newHeight = Math.max(MIN_SIZE.height, resizeStartRef.current.height + deltaY);
    }
    
    // Limit to viewport size
    if (typeof window !== 'undefined') {
      newWidth = Math.min(newWidth, window.innerWidth - 100);
      newHeight = Math.min(newHeight, window.innerHeight - 100);
    }
    
    setCustomWidth(newWidth);
    setCustomHeight(newHeight);
  }, [isResizing, resizeEdge]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeEdge(null);
    resizeStartRef.current = null;
  }, []);

  // Add/remove resize event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = resizeEdge === 'left' ? 'ew-resize' : 
                                     resizeEdge === 'top' ? 'ns-resize' : 
                                     'nwse-resize';
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

  // Focus article search when cart opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        setArticleFocusTrigger(prev => prev + 1);
      }, 100);
    }
  }, [isOpen]);

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

    if (!activeTab.clientId) {
      toast.error('Selecciona un cliente antes de crear el pedido', {
        duration: 2000,
        position: 'top-center'
      });
      return;
    }
    
    onClose();
    router.push(`/dashboard/sales-orders/new?fromQuickCart=true&tabId=${activeTab.id}`);
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
    if (tabs.length === 1) {
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

  return (
    <>
      <Card 
        ref={cardRef}
        className={`fixed shadow-2xl z-50 flex flex-col ${
          isExpanded ? 'inset-4' : 'bottom-24 right-6'
        }`}
        style={{
          width: isExpanded ? `${currentDimensions.width}px` : `${currentDimensions.width}px`,
          height: `${currentDimensions.height}px`,
          maxWidth: isExpanded ? '95vw' : undefined,
          maxHeight: isExpanded ? '90vh' : undefined,
          transition: isResizing ? 'none' : 'width 0.3s ease, height 0.3s ease, inset 0.3s ease',
          resize: 'none',
        }}
      >
      {/* Header with Tabs */}
      <div className="border-b bg-muted/30">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Pedidos</h3>
            <span className="text-xs text-muted-foreground">
              ({items.length} item{items.length !== 1 ? 's' : ''})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleExpanded}
              title={isExpanded ? 'Contraer' : 'Expandir'}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex items-center gap-1 px-2 pb-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors flex-shrink-0 ${
                tab.id === activeTab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-accent'
              }`}
            >
              {tab.clientName ? (
                <User className="h-3 w-3" />
              ) : (
                <ShoppingCart className="h-3 w-3" />
              )}
              <span className="font-medium truncate max-w-[120px]">
                {tab.clientName || tab.name}
              </span>
              {tab.items.length > 0 && (
                <span className="text-[10px] opacity-70">({tab.items.length})</span>
              )}
              {tabs.length > 1 && (
                <X
                  className="h-3 w-3 ml-1 hover:bg-destructive/20 rounded"
                  onClick={(e) => handleRemoveTab(tab.id, e)}
                />
              )}
            </button>
          ))}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={addTab}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Client Selection */}
      <div className="p-3 border-b bg-background">
        {activeTab.clientId ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 p-2 bg-primary/10 border border-primary/20 rounded">
              <User className="h-4 w-4 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{activeTab.clientName}</div>
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
      <div className="p-3 border-b bg-muted/5">
        <QuickArticleLookup autoFocus={false} focusTrigger={articleFocusTrigger} />
      </div>

      {items.length === 0 ? (
        /* Empty State */
        <div className="flex-1 flex items-center justify-center py-12 px-4">
          <div className="text-center text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay artículos</p>
            <p className="text-xs mt-1">Usa el buscador para agregar</p>
          </div>
        </div>
      ) : (
        <>
          {/* Items List */}
          <div className="flex-1 overflow-y-auto overflow-x-visible p-4 space-y-2">
            {items.map((item) => (
              <div
                key={item.article.id}
                className={`flex items-center gap-3 p-3 rounded border hover:bg-accent/50 transition-colors ${
                  isExpanded ? 'min-h-[80px]' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  {editingItemId === item.article.id ? (
                    <div className="mb-2">
                      <div className="flex items-center gap-2">
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
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className={`font-medium font-mono ${isExpanded ? 'text-base' : 'text-sm'}`}>
                        {item.article.code}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => handleEditItem(item.article.id, item.article.code)}
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </Button>
                    </div>
                  )}
                  <div className={`text-muted-foreground truncate ${isExpanded ? 'text-sm' : 'text-xs'}`}>
                    {item.article.description}
                  </div>
                  <div className={`flex items-center gap-3 mt-1 ${isExpanded ? 'text-sm' : 'text-xs'}`}>
                    <span className="text-muted-foreground">
                      {formatCurrency(item.article.unitPrice)} c/u
                    </span>
                    <span className={`${getStockStatusClass(item.article.stock)}`}>
                      Stock: {item.article.stock}
                    </span>
                    {isExpanded && (
                      <span className="font-semibold text-primary">
                        Subtotal: {formatCurrency(item.article.unitPrice * item.quantity)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => {
                      const newQty = parseInt(e.target.value) || 1;
                      updateQuantity(item.article.id, newQty);
                    }}
                    className={`text-center ${isExpanded ? 'w-20 h-9 text-base' : 'w-16 h-8 text-sm'}`}
                    onFocus={(e) => e.target.select()}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`flex-shrink-0 ${isExpanded ? 'h-9 w-9' : 'h-8 w-8'}`}
                    onClick={() => removeItem(item.article.id)}
                  >
                    <Trash2 className={`text-red-600 ${isExpanded ? 'h-5 w-5' : 'h-4 w-4'}`} />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Footer */}
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Items</div>
                <div className="text-base font-semibold">{getActiveTabTotalItems()}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground mb-1">Total Estimado</div>
                <div className="text-lg font-bold">{formatCurrency(getTotalValue())}</div>
              </div>
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
                disabled={items.length === 0 || !activeTab.clientId}
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
          
          {/* Top edge handle */}
          <div
            className="absolute top-0 left-0 w-full h-2 cursor-ns-resize hover:bg-primary/20 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'top')}
            style={{ zIndex: 60 }}
          />
          
          {/* Top-left corner handle */}
          <div
            className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize hover:bg-primary/30 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'corner')}
            style={{ zIndex: 61 }}
          >
            <svg
              className="w-full h-full text-muted-foreground/40"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M1 6V5h1v1H1zm0-3V2h1v1H1zm3 0V2h1v1H4zm3 0V2h1v1H7z" />
            </svg>
          </div>
        </>
      )}
    </Card>

    {/* Edit Search Results Dropdown - Floating */}
    {showEditResults && editCode && editArticles.length > 0 && editingItemId && (
      <Card className="fixed bottom-32 right-12 w-[380px] max-h-[280px] overflow-auto shadow-2xl z-[60]">
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


