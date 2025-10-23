'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ClientLookup } from '@/components/articles/ClientLookup';
import { useCreateSalesOrder } from '@/lib/hooks/useSalesOrders';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useQuickCartTabs, QuickCartItem } from '@/lib/hooks/useQuickCartTabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShoppingCart, User, X, Trash2, Pencil, Search, Plus, Maximize2, Minimize2 } from 'lucide-react';
import { useArticles } from '@/lib/hooks/useArticles';
import type { Article } from '@/types/article';

interface OrderItemFormData {
  articleId: number;
  articleCode: string;
  articleDescription: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  stock: number;
}

export function SingleStepOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromQuickCart = searchParams.get('fromQuickCart') === 'true';
  const tabId = searchParams.get('tabId');
  const { tabs, activeTab, clearSpecificCart } = useQuickCartTabs();
  
  const [clientId, setClientId] = useState<number | undefined>();
  const [clientName, setClientName] = useState<string>('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<OrderItemFormData[]>([]);
  const [loadedFromCart, setLoadedFromCart] = useState(false);

  // Article section expanded state
  const [isArticlesSectionExpanded, setIsArticlesSectionExpanded] = useState(false);

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

  // Load data from quick cart if coming from there
  useEffect(() => {
    if (fromQuickCart && !loadedFromCart) {
      let cartItems: QuickCartItem[] = [];
      let cartClientId: number | undefined;
      let cartClientName: string = '';
      
      if (tabId) {
        // Load specific tab
        const tab = tabs.find(t => t.id === tabId);
        if (tab) {
          cartItems = tab.items;
          cartClientId = tab.clientId;
          cartClientName = tab.clientName || '';
        }
      } else {
        // Load active tab
        cartItems = activeTab.items;
        cartClientId = activeTab.clientId;
        cartClientName = activeTab.clientName || '';
      }
      
      if (cartItems.length > 0) {
        const orderItems = cartItems.map((item) => ({
          articleId: item.article.id,
          articleCode: item.article.code,
          articleDescription: item.article.description,
          quantity: item.quantity,
          unitPrice: item.article.unitPrice,
          discountPercent: 0,
          stock: item.article.stock,
        }));
        
        setItems(orderItems);
        toast.success(`${cartItems.length} artículo(s) cargados desde la consulta rápida`);
      }
      
      // Load client if set
      if (cartClientId && cartClientName) {
        setClientId(cartClientId);
        setClientName(cartClientName);
        toast.success(`Cliente ${cartClientName} seleccionado`);
      }
      
      setLoadedFromCart(true);
    }
  }, [fromQuickCart, tabId, tabs, activeTab, loadedFromCart]);

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

  const handleSelectClient = (id: number, name: string) => {
    setClientId(id);
    setClientName(name);
    toast.success(`Cliente ${name} seleccionado`, {
      duration: 2000,
      position: 'top-center'
    });
  };

  const handleClearClient = () => {
    setClientId(undefined);
    setClientName('');
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

    // Check if article already exists
    const existingIndex = items.findIndex(item => item.articleId === articleToAdd!.id);
    if (existingIndex >= 0) {
      // Update quantity
      const updatedItems = [...items];
      updatedItems[existingIndex].quantity += qty;
      setItems(updatedItems);
      toast.success(`Cantidad actualizada para ${articleToAdd.code}`, {
        duration: 2000,
        position: 'top-center'
      });
    } else {
      // Add new item
      const newItem: OrderItemFormData = {
        articleId: articleToAdd.id,
        articleCode: articleToAdd.code,
        articleDescription: articleToAdd.description,
        quantity: qty,
        unitPrice: articleToAdd.unitPrice,
        discountPercent: 0,
        stock: articleToAdd.stock,
      };
      setItems([...items, newItem]);
      toast.success(`${articleToAdd.code} agregado`, {
        duration: 2000,
        position: 'top-center'
      });
    }
    
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

    const itemIndex = items.findIndex(item => item.articleId === editingItemId);
    if (itemIndex === -1) return;

    const updatedItems = [...items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      articleId: article.id,
      articleCode: article.code,
      articleDescription: article.description,
      unitPrice: article.unitPrice,
      stock: article.stock,
    };
    
    setItems(updatedItems);
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
    setItems(items.filter(item => item.articleId !== articleId));
    toast.success('Artículo eliminado', {
      duration: 2000,
      position: 'top-center'
    });
  };

  const handleUpdateQuantity = (articleId: number, newQuantity: number) => {
    if (newQuantity <= 0) return;
    const updatedItems = items.map(item =>
      item.articleId === articleId ? { ...item, quantity: newQuantity } : item
    );
    setItems(updatedItems);
  };

  const handleUpdateUnitPrice = (articleId: number, newPrice: number) => {
    if (newPrice < 0) return;
    const updatedItems = items.map(item =>
      item.articleId === articleId ? { ...item, unitPrice: newPrice } : item
    );
    setItems(updatedItems);
  };

  const handleUpdateDiscount = (articleId: number, newDiscount: number) => {
    if (newDiscount < 0 || newDiscount > 100) return;
    const updatedItems = items.map(item =>
      item.articleId === articleId ? { ...item, discountPercent: newDiscount } : item
    );
    setItems(updatedItems);
  };

  const calculateLineTotal = (item: OrderItemFormData) => {
    const subtotal = item.quantity * item.unitPrice;
    const discount = subtotal * (item.discountPercent / 100);
    return subtotal - discount;
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  };

  const handleSubmit = async () => {
    // Validations
    if (!clientId) {
      toast.error('Debe seleccionar un cliente', {
        duration: 3000,
        position: 'top-center'
      });
      return;
    }

    if (!orderDate) {
      toast.error('Debe ingresar la fecha de pedido', {
        duration: 3000,
        position: 'top-center'
      });
      return;
    }

    if (items.length === 0) {
      toast.error('Debe agregar al menos un artículo', {
        duration: 3000,
        position: 'top-center'
      });
      return;
    }

    // Validate items
    for (const item of items) {
      if (item.quantity <= 0) {
        toast.error(`La cantidad de ${item.articleCode} debe ser mayor a 0`, {
          duration: 3000,
          position: 'top-center'
        });
        return;
      }
      if (item.unitPrice < 0) {
        toast.error(`El precio de ${item.articleCode} no puede ser negativo`, {
          duration: 3000,
          position: 'top-center'
        });
        return;
      }
      if (item.discountPercent < 0 || item.discountPercent > 100) {
        toast.error(`El descuento de ${item.articleCode} debe estar entre 0 y 100%`, {
          duration: 3000,
          position: 'top-center'
        });
        return;
      }
    }

    try {
      const request = {
        clientId,
        orderDate,
        deliveryDate: deliveryDate || undefined,
        notes: notes || undefined,
        items: items.map((item) => ({
          articleId: item.articleId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
        })),
      };

      await createOrderMutation.mutateAsync(request);
      
      // Clear quick cart if loaded from there
      if (fromQuickCart && loadedFromCart && tabId) {
        clearSpecificCart(tabId);
        toast.success('Pedido creado y lista de consulta limpiada');
      }
      
      router.push('/dashboard/sales-orders');
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {fromQuickCart && loadedFromCart && (
        <Alert>
          <ShoppingCart className="h-4 w-4" />
          <AlertDescription>
            Se han cargado datos desde tu lista de consulta rápida.
          </AlertDescription>
        </Alert>
      )}

      {/* Client and General Info Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              {clientId && clientName ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded">
                    <User className="h-4 w-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{clientName}</div>
                      <div className="text-xs text-muted-foreground">Cliente seleccionado</div>
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
              <p className="text-sm text-muted-foreground">
                Selecciona el cliente para el pedido
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="orderDate">Fecha de Pedido *</Label>
                <Input
                  id="orderDate"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliveryDate">Fecha de Entrega</Label>
                <Input
                  id="deliveryDate"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  min={orderDate}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  placeholder="Observaciones..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={1}
                  className="resize-none"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Articles Section */}
      <Card className="flex-1">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <span className="text-xs text-muted-foreground">
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setIsArticlesSectionExpanded(!isArticlesSectionExpanded)}
                title={isArticlesSectionExpanded ? 'Contraer' : 'Expandir'}
              >
                {isArticlesSectionExpanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>

              {/* Quick Article Lookup */}
              <div className="p-4 border rounded-lg bg-muted/30">
                <div className="flex items-start gap-2">
                  <div className="flex-1 relative">
                    <Label className="text-xs mb-1 block text-muted-foreground">Código de Artículo</Label>
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
                                index === selectedIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                              }`}
                            >
                              <div className="flex justify-between items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className={`font-semibold text-sm font-mono ${index === selectedIndex ? 'text-primary-foreground' : ''}`}>
                                    {article.code}
                                  </div>
                                  <div className={`text-xs truncate mt-0.5 ${index === selectedIndex ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
                                    {article.description}
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className={`text-sm font-bold ${index === selectedIndex ? 'text-primary-foreground' : 'text-foreground'}`}>
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
                    <Label className="text-xs mb-1 block text-muted-foreground">Cant.</Label>
                    <Input
                      ref={quantityInputRef}
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      onKeyDown={handleQuantityKeyDown}
                      onFocus={(e) => e.target.select()}
                      className="text-center text-sm h-9"
                    />
                  </div>

                  <div className="pt-6">
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

              {/* Items List */}
              <div className={`space-y-2 overflow-y-auto ${
                isArticlesSectionExpanded ? 'max-h-[600px]' : 'max-h-[400px]'
              }`}>
                {items.length === 0 ? (
                  <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No hay artículos agregados</p>
                    <p className="text-xs mt-1">Usa el buscador para agregar</p>
                  </div>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.articleId}
                      className={`border rounded-lg p-3 space-y-2 bg-card hover:bg-accent/5 transition-colors ${
                        isArticlesSectionExpanded ? 'min-h-[100px]' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {editingItemId === item.articleId ? (
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
                                          index === selectedEditIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                                        }`}
                                      >
                                        <div className="flex justify-between items-start gap-2">
                                          <div className="flex-1 min-w-0">
                                            <div className={`font-semibold text-xs font-mono ${index === selectedEditIndex ? 'text-primary-foreground' : ''}`}>
                                              {article.code}
                                            </div>
                                            <div className={`text-xs truncate ${index === selectedEditIndex ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
                                              {article.description}
                                            </div>
                                          </div>
                                          <div className={`text-xs ${index === selectedEditIndex ? 'text-primary-foreground' : ''}`}>
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
                            <div className="flex items-center gap-2">
                              <div className={`font-medium font-mono ${
                                isArticlesSectionExpanded ? 'text-base' : 'text-sm'
                              }`}>
                                {item.articleCode}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => handleEditItem(item.articleId, item.articleCode)}
                              >
                                <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                              </Button>
                            </div>
                          )}
                          <div className={`text-muted-foreground truncate ${
                            isArticlesSectionExpanded ? 'text-sm' : 'text-xs'
                          }`}>
                            {item.articleDescription}
                          </div>
                          <div className={`text-muted-foreground mt-0.5 flex items-center gap-2 ${
                            isArticlesSectionExpanded ? 'text-sm' : 'text-xs'
                          }`}>
                            <span>Stock: <span className={getStockStatusClass(item.stock)}>{item.stock}</span></span>
                            {isArticlesSectionExpanded && (
                              <span className="font-semibold text-primary">
                                Subtotal: {formatCurrency(calculateLineTotal(item))}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleRemoveItem(item.articleId)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className={`text-muted-foreground ${
                            isArticlesSectionExpanded ? 'text-sm' : 'text-xs'
                          }`}>Cantidad</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateQuantity(item.articleId, parseInt(e.target.value) || 1)}
                            className={`text-sm ${isArticlesSectionExpanded ? 'h-9' : 'h-8'}`}
                            onFocus={(e) => e.target.select()}
                          />
                        </div>
                        <div>
                          <Label className={`text-muted-foreground ${
                            isArticlesSectionExpanded ? 'text-sm' : 'text-xs'
                          }`}>Precio</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateUnitPrice(item.articleId, parseFloat(e.target.value) || 0)}
                            className={`text-sm ${isArticlesSectionExpanded ? 'h-9' : 'h-8'}`}
                            onFocus={(e) => e.target.select()}
                          />
                        </div>
                        <div>
                          <Label className={`text-muted-foreground ${
                            isArticlesSectionExpanded ? 'text-sm' : 'text-xs'
                          }`}>Desc %</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.discountPercent}
                            onChange={(e) => handleUpdateDiscount(item.articleId, parseFloat(e.target.value) || 0)}
                            className={`text-sm ${isArticlesSectionExpanded ? 'h-9' : 'h-8'}`}
                            onFocus={(e) => e.target.select()}
                          />
                        </div>
                      </div>

                      <div className={`text-right pt-1 border-t ${
                        isArticlesSectionExpanded ? 'text-base' : 'text-sm'
                      }`}>
                        <span className="text-xs text-muted-foreground">Subtotal: </span>
                        <span className={`font-semibold ${
                          isArticlesSectionExpanded ? 'text-base' : 'text-sm'
                        }`}>{formatCurrency(calculateLineTotal(item))}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Total */}
              {items.length > 0 && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-xs text-muted-foreground">Items</div>
                      <div className="text-lg font-semibold">{items.length}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Total</div>
                      <div className="text-2xl font-bold">{formatCurrency(calculateTotal())}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      {/* Fixed Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t z-50">
        <div className="container max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard/sales-orders')}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!clientId || items.length === 0 || createOrderMutation.isPending}
              size="lg"
            >
              {createOrderMutation.isPending ? 'Creando...' : 'Crear Pedido'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


