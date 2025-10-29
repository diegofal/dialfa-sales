import { useState, useEffect } from 'react';
import { Article } from '@/types/article';

export interface QuickCartItem {
  article: Article;
  quantity: number;
}

export interface QuickCartTab {
  id: string;
  name: string;
  clientId?: number;
  clientName?: string;
  items: QuickCartItem[];
  createdAt: number;
}

interface QuickCartState {
  tabs: QuickCartTab[];
  activeTabId: string;
}

const STORAGE_KEY = 'spisa_quick_cart_tabs';
const CART_UPDATE_EVENT = 'quick-cart-tabs-updated';

// Helper to dispatch cart update events
const dispatchCartUpdate = () => {
  window.dispatchEvent(new Event(CART_UPDATE_EVENT));
};

// Helper to get current cart state from localStorage
const getStateFromStorage = (): QuickCartState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading quick cart:', error);
  }
  
  // Default state with one tab
  const defaultTab: QuickCartTab = {
    id: `tab-${Date.now()}`,
    name: 'Pedido 1',
    items: [],
    createdAt: Date.now(),
  };
  
  return {
    tabs: [defaultTab],
    activeTabId: defaultTab.id,
  };
};

// Helper to save cart to localStorage
const saveStateToStorage = (state: QuickCartState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    dispatchCartUpdate();
  } catch (error) {
    console.error('Error saving quick cart:', error);
  }
};

export function useQuickCartTabs() {
  const [state, setState] = useState<QuickCartState>(getStateFromStorage);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    setState(getStateFromStorage());
    setIsLoaded(true);
  }, []);

  // Listen for cart updates from other components
  useEffect(() => {
    const handleCartUpdate = () => {
      setState(getStateFromStorage());
    };

    window.addEventListener(CART_UPDATE_EVENT, handleCartUpdate);
    return () => {
      window.removeEventListener(CART_UPDATE_EVENT, handleCartUpdate);
    };
  }, []);

  // Get active tab
  const activeTab = state.tabs.find(tab => tab.id === state.activeTabId) || state.tabs[0];

  // Add new tab
  const addTab = () => {
    const newTab: QuickCartTab = {
      id: `tab-${Date.now()}`,
      name: `Pedido ${state.tabs.length + 1}`,
      items: [],
      createdAt: Date.now(),
    };
    
    const newState: QuickCartState = {
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id,
    };
    
    saveStateToStorage(newState);
    setState(newState);
  };

  // Remove tab
  const removeTab = (tabId: string) => {
    if (state.tabs.length === 1) return; // Keep at least one tab
    
    const filteredTabs = state.tabs.filter(tab => tab.id !== tabId);
    const newActiveTabId = tabId === state.activeTabId 
      ? filteredTabs[0].id 
      : state.activeTabId;
    
    const newState: QuickCartState = {
      tabs: filteredTabs,
      activeTabId: newActiveTabId,
    };
    
    saveStateToStorage(newState);
    setState(newState);
  };

  // Set active tab
  const setActiveTab = (tabId: string) => {
    const newState: QuickCartState = {
      ...state,
      activeTabId: tabId,
    };
    
    saveStateToStorage(newState);
    setState(newState);
  };

  // Set client for active tab
  const setClient = (clientId: number, clientName: string) => {
    const updatedTabs = state.tabs.map(tab =>
      tab.id === state.activeTabId
        ? { ...tab, clientId, clientName, name: clientName }
        : tab
    );
    
    const newState: QuickCartState = {
      ...state,
      tabs: updatedTabs,
    };
    
    saveStateToStorage(newState);
    setState(newState);
  };

  // Clear client for active tab
  const clearClient = () => {
    const updatedTabs = state.tabs.map(tab =>
      tab.id === state.activeTabId
        ? { ...tab, clientId: undefined, clientName: undefined, name: `Pedido ${state.tabs.indexOf(tab) + 1}` }
        : tab
    );
    
    const newState: QuickCartState = {
      ...state,
      tabs: updatedTabs,
    };
    
    saveStateToStorage(newState);
    setState(newState);
  };

  // Clear client for a specific tab
  const clearSpecificClient = (tabId: string) => {
    const updatedTabs = state.tabs.map(tab =>
      tab.id === tabId
        ? { ...tab, clientId: undefined, clientName: undefined, name: `Pedido ${state.tabs.indexOf(tab) + 1}` }
        : tab
    );
    
    const newState: QuickCartState = {
      ...state,
      tabs: updatedTabs,
    };
    
    saveStateToStorage(newState);
    setState(newState);
  };

  // Add item to active tab
  const addItem = (article: Article, quantity: number = 1) => {
    const updatedTabs = state.tabs.map(tab => {
      if (tab.id !== state.activeTabId) return tab;
      
      const existingIndex = tab.items.findIndex(item => item.article.id === article.id);
      let updatedItems: QuickCartItem[];
      
      if (existingIndex >= 0) {
        updatedItems = [...tab.items];
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          quantity: updatedItems[existingIndex].quantity + quantity,
        };
      } else {
        updatedItems = [...tab.items, { article, quantity }];
      }
      
      return { ...tab, items: updatedItems };
    });
    
    const newState: QuickCartState = {
      ...state,
      tabs: updatedTabs,
    };
    
    saveStateToStorage(newState);
    setState(newState);
  };

  // Remove item from active tab
  const removeItem = (articleId: number) => {
    const updatedTabs = state.tabs.map(tab => {
      if (tab.id !== state.activeTabId) return tab;
      return {
        ...tab,
        items: tab.items.filter(item => item.article.id !== articleId),
      };
    });
    
    const newState: QuickCartState = {
      ...state,
      tabs: updatedTabs,
    };
    
    saveStateToStorage(newState);
    setState(newState);
  };

  // Update quantity in active tab
  const updateQuantity = (articleId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(articleId);
      return;
    }

    const updatedTabs = state.tabs.map(tab => {
      if (tab.id !== state.activeTabId) return tab;
      return {
        ...tab,
        items: tab.items.map(item =>
          item.article.id === articleId ? { ...item, quantity } : item
        ),
      };
    });
    
    const newState: QuickCartState = {
      ...state,
      tabs: updatedTabs,
    };
    
    saveStateToStorage(newState);
    setState(newState);
  };

  // Replace an item with another article, keeping the quantity
  const replaceItem = (oldArticleId: number, newArticle: Article) => {
    const updatedTabs = state.tabs.map(tab => {
      if (tab.id !== state.activeTabId) return tab;
      
      return {
        ...tab,
        items: tab.items.map(item =>
          item.article.id === oldArticleId 
            ? { article: newArticle, quantity: item.quantity }
            : item
        ),
      };
    });
    
    const newState: QuickCartState = {
      ...state,
      tabs: updatedTabs,
    };
    
    saveStateToStorage(newState);
    setState(newState);
  };

  // Clear items in active tab
  const clearCart = () => {
    const updatedTabs = state.tabs.map(tab =>
      tab.id === state.activeTabId
        ? { ...tab, items: [] }
        : tab
    );
    
    const newState: QuickCartState = {
      ...state,
      tabs: updatedTabs,
    };
    
    saveStateToStorage(newState);
    setState(newState);
  };

  // Get total items across all tabs
  const getTotalItems = () => {
    return state.tabs.reduce((sum, tab) => 
      sum + tab.items.reduce((tabSum, item) => tabSum + item.quantity, 0), 0
    );
  };

  // Get total items in active tab
  const getActiveTabTotalItems = () => {
    return activeTab.items.reduce((sum, item) => sum + item.quantity, 0);
  };

  // Get total value in active tab
  const getTotalValue = () => {
    return activeTab.items.reduce((sum, item) => 
      sum + item.article.unitPrice * item.quantity, 0
    );
  };

  // Get items from a specific tab by ID
  const getTabItems = (tabId: string): QuickCartItem[] => {
    const tab = state.tabs.find(t => t.id === tabId);
    return tab?.items || [];
  };

  // Clear items in a specific tab
  const clearSpecificCart = (tabId: string) => {
    const updatedTabs = state.tabs.map(tab =>
      tab.id === tabId
        ? { ...tab, items: [] }
        : tab
    );
    
    const newState: QuickCartState = {
      ...state,
      tabs: updatedTabs,
    };
    
    saveStateToStorage(newState);
    setState(newState);
  };

  // Clear both items and client from a specific tab
  const clearSpecificTabCompletely = (tabId: string) => {
    const tabIndex = state.tabs.findIndex(t => t.id === tabId);
    const updatedTabs = state.tabs.map(tab =>
      tab.id === tabId
        ? { 
            ...tab, 
            items: [], 
            clientId: undefined, 
            clientName: undefined, 
            name: `Pedido ${tabIndex + 1}` 
          }
        : tab
    );
    
    const newState: QuickCartState = {
      ...state,
      tabs: updatedTabs,
    };
    
    saveStateToStorage(newState);
    setState(newState);
  };

  return {
    tabs: state.tabs,
    activeTab,
    activeTabId: state.activeTabId,
    items: activeTab.items,
    isLoaded,
    addTab,
    removeTab,
    setActiveTab,
    setClient,
    clearClient,
    clearSpecificClient,
    addItem,
    removeItem,
    updateQuantity,
    replaceItem,
    clearCart,
    getTabItems,
    clearSpecificCart,
    clearSpecificTabCompletely,
    getTotalItems,
    getActiveTabTotalItems,
    getTotalValue,
  };
}


