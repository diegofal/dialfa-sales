'use client';

import { ShoppingCart, X, Trash2, Plus, User, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useQuickCartTabs } from '@/lib/hooks/useQuickCartTabs';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { QuickArticleLookup } from './QuickArticleLookup';
import { ClientLookup } from './ClientLookup';
import { useState, useRef, useEffect } from 'react';
import { useArticles } from '@/lib/hooks/useArticles';
import type { Article } from '@/types/article';

interface QuickCartPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickCartPopup({ isOpen, onClose }: QuickCartPopupProps) {
  const router = useRouter();
  const [articleFocusTrigger, setArticleFocusTrigger] = useState(0);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editCode, setEditCode] = useState('');
  const [showEditResults, setShowEditResults] = useState(false);
  const [selectedEditIndex, setSelectedEditIndex] = useState(0);
  const editInputRef = useRef<HTMLInputElement>(null);
  const selectedEditItemRef = useRef<HTMLButtonElement>(null);
  
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
      <Card className="fixed bottom-24 right-6 w-[520px] max-h-[750px] shadow-2xl z-50 flex flex-col">
      {/* Header with Tabs */}
      <div className="border-b bg-muted/30">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Pedidos</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
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
                className="flex items-center gap-2 p-2 rounded border hover:bg-accent/50 transition-colors"
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
                      <div className="font-medium text-sm font-mono">
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
                  <div className="text-xs text-muted-foreground truncate">
                    {item.article.description}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatCurrency(item.article.unitPrice)} c/u | Stock: {item.article.stock}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => {
                      const newQty = parseInt(e.target.value) || 1;
                      updateQuantity(item.article.id, newQty);
                    }}
                    className="w-16 h-8 text-center text-sm"
                    onFocus={(e) => e.target.select()}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => removeItem(item.article.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
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


