import { useState, useEffect } from 'react';
import { Article } from '@/types/article';

export interface QuickCartItem {
  article: Article;
  quantity: number;
}

const STORAGE_KEY = 'spisa_quick_cart';
const CART_UPDATE_EVENT = 'quick-cart-updated';

// Helper to dispatch cart update events
const dispatchCartUpdate = () => {
  window.dispatchEvent(new Event(CART_UPDATE_EVENT));
};

// Helper to get current cart from localStorage
const getCartFromStorage = (): QuickCartItem[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading quick cart:', error);
  }
  return [];
};

// Helper to save cart to localStorage
const saveCartToStorage = (items: QuickCartItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    dispatchCartUpdate();
  } catch (error) {
    console.error('Error saving quick cart:', error);
  }
};

export function useQuickCart() {
  const [items, setItems] = useState<QuickCartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    setItems(getCartFromStorage());
    setIsLoaded(true);
  }, []);

  // Listen for cart updates from other components
  useEffect(() => {
    const handleCartUpdate = () => {
      setItems(getCartFromStorage());
    };

    window.addEventListener(CART_UPDATE_EVENT, handleCartUpdate);
    return () => {
      window.removeEventListener(CART_UPDATE_EVENT, handleCartUpdate);
    };
  }, []);

  const addItem = (article: Article, quantity: number = 1) => {
    const current = getCartFromStorage();
    const existingIndex = current.findIndex((item) => item.article.id === article.id);
    
    let updated: QuickCartItem[];
    if (existingIndex >= 0) {
      // Update quantity if item already exists
      updated = [...current];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + quantity,
      };
    } else {
      // Add new item
      updated = [...current, { article, quantity }];
    }
    
    saveCartToStorage(updated);
    setItems(updated);
  };

  const removeItem = (articleId: number) => {
    const current = getCartFromStorage();
    const updated = current.filter((item) => item.article.id !== articleId);
    saveCartToStorage(updated);
    setItems(updated);
  };

  const updateQuantity = (articleId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(articleId);
      return;
    }

    const current = getCartFromStorage();
    const updated = current.map((item) =>
      item.article.id === articleId ? { ...item, quantity } : item
    );
    saveCartToStorage(updated);
    setItems(updated);
  };

  const clearCart = () => {
    saveCartToStorage([]);
    setItems([]);
  };

  const getTotalItems = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getTotalValue = () => {
    return items.reduce((sum, item) => sum + item.article.unitPrice * item.quantity, 0);
  };

  return {
    items,
    isLoaded,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getTotalItems,
    getTotalValue,
  };
}


