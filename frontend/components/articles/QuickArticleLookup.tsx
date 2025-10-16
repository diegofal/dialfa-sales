'use client';

import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useArticles } from '@/lib/hooks/useArticles';
import { useQuickCartTabs } from '@/lib/hooks/useQuickCartTabs';
import { toast } from 'sonner';

interface QuickArticleLookupProps {
  autoFocus?: boolean;
  focusTrigger?: number;
}

export function QuickArticleLookup({ autoFocus = false, focusTrigger }: QuickArticleLookupProps) {
  const [articleCode, setArticleCode] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [showCodeResults, setShowCodeResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const codeInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);
  const { addItem } = useQuickCartTabs();
  
  // Search articles as user types code
  const { data: articlesResult } = useArticles({ 
    searchTerm: articleCode,
    activeOnly: true,
    pageSize: 5,
  });
  
  const articles = articlesResult?.items || [];

  useEffect(() => {
    if (autoFocus && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [autoFocus]);

  // Focus when trigger changes (e.g., when client is selected)
  useEffect(() => {
    if (focusTrigger && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [focusTrigger]);

  // Reset selected index when articles change
  useEffect(() => {
    setSelectedIndex(0);
  }, [articles]);

  // Scroll to selected item
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  // Auto-select first article if exact match
  useEffect(() => {
    if (articles.length === 1 && articleCode) {
      setSelectedArticle(articles[0]);
    } else if (articles.length === 0) {
      setSelectedArticle(null);
    }
  }, [articles, articleCode]);

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
      handleAddToCart();
    } else if (e.key === 'Escape') {
      codeInputRef.current?.focus();
    } else if (e.key === 'Tab' && !selectedArticle && articles.length > 0) {
      // Auto-select first article when tabbing from quantity
      setSelectedArticle(articles[0]);
    }
  };

  const handleAddToCart = () => {
    // Auto-select first article if there's text but no selection
    let articleToAdd = selectedArticle;
    
    if (!articleToAdd && articleCode && articles.length > 0) {
      // Auto-select the first result if user typed but didn't explicitly select
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

    addItem(articleToAdd, qty);
    toast.success(`${articleToAdd.code} x${qty} agregado`, {
      duration: 2000,
      position: 'top-center',
      dismissible: true,
    });
    
    // Reset form
    setArticleCode('');
    setQuantity('1');
    setSelectedArticle(null);
    codeInputRef.current?.focus();
  };

  const handleSelectArticle = (article: any, index: number) => {
    setSelectedArticle(article);
    setArticleCode(article.code);
    setSelectedIndex(index);
    setShowCodeResults(false);
    quantityInputRef.current?.focus();
    quantityInputRef.current?.select();
  };

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

  return (
    <div className="flex items-start gap-2 w-full">
      {/* Article Code Input */}
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
            placeholder="BRS1501"
            className="pl-7 uppercase text-sm h-9"
          />
        </div>

        {/* Search Results Dropdown */}
        {showCodeResults && articleCode && articles.length > 0 && (
          <Card className="absolute z-[60] w-[420px] mt-1 max-h-[320px] overflow-auto shadow-xl">
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

      {/* Quantity Input */}
      <div className="w-24">
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
    </div>
  );
}

