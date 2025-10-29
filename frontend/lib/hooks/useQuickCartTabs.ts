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
  orderId?: number; // If set, this tab represents a saved order being edited
  orderNumber?: string; // The order number for display
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
  
  // Default state with no tabs initially
  return {
    tabs: [],
    activeTabId: '',
  };
};

// Helper to save cart to localStorage
const saveStateToStorage = (state: QuickCartState) => {
  try {
    console.log('Saving state to localStorage:', state);
    if (state.tabs.length === 0) {
      console.warn('WARNING: Saving empty tabs array!');
      console.trace('Stack trace for empty save:');
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    console.log('State saved successfully');
    dispatchCartUpdate();
  } catch (error) {
    console.error('Error saving quick cart:', error);
  }
};

export function useQuickCartTabs() {
  const [state, setState] = useState<QuickCartState>(() => {
    // Use function form to ensure this only runs once
    if (typeof window === 'undefined') {
      return { tabs: [], activeTabId: '' };
    }
    return getStateFromStorage();
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    const loadedState = getStateFromStorage();
    console.log('Loading state from localStorage on mount:', loadedState);
    setState(loadedState);
    setIsLoaded(true);
  }, []);

  // Listen for cart updates from other components
  useEffect(() => {
    const handleCartUpdate = () => {
      const updatedState = getStateFromStorage();
      console.log('Cart update event received, loading from localStorage:', updatedState);
      setState(updatedState);
    };

    window.addEventListener(CART_UPDATE_EVENT, handleCartUpdate);
    return () => {
      window.removeEventListener(CART_UPDATE_EVENT, handleCartUpdate);
    };
  }, []);

  // Get active tab
  const activeTab = state.tabs.find(tab => tab.id === state.activeTabId) || state.tabs[0] || {
    id: '',
    name: '',
    items: [],
    createdAt: Date.now(),
  };

  // Ensure at least one tab exists when needed
  const ensureTabExists = () => {
    if (state.tabs.length === 0) {
      addTab();
    }
  };

  // Add new tab
  const addTab = () => {
    // Count only draft tabs (without orderId) for numbering
    const draftCount = state.tabs.filter(tab => !tab.orderId).length;
    
    const newTab: QuickCartTab = {
      id: `tab-${Date.now()}`,
      name: `Pedido ${draftCount + 1}`,
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
    const filteredTabs = state.tabs.filter(tab => tab.id !== tabId);
    const newActiveTabId = tabId === state.activeTabId 
      ? (filteredTabs.length > 0 ? filteredTabs[0].id : '')
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
    // Calculate the draft index for naming
    const draftTabs = state.tabs.filter(tab => !tab.orderId);
    const draftIndex = draftTabs.findIndex(tab => tab.id === state.activeTabId);
    const tabName = draftIndex >= 0 ? `Pedido ${draftIndex + 1}` : 'Pedido';
    
    const updatedTabs = state.tabs.map(tab =>
      tab.id === state.activeTabId
        ? { ...tab, clientId: undefined, clientName: undefined, name: tabName }
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
    // Calculate the draft index for naming
    const draftTabs = state.tabs.filter(tab => !tab.orderId);
    const draftIndex = draftTabs.findIndex(tab => tab.id === tabId);
    const tabName = draftIndex >= 0 ? `Pedido ${draftIndex + 1}` : 'Pedido';
    
    const updatedTabs = state.tabs.map(tab =>
      tab.id === tabId
        ? { ...tab, clientId: undefined, clientName: undefined, name: tabName }
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
    // Calculate the draft index for naming
    const draftTabs = state.tabs.filter(tab => !tab.orderId);
    const draftIndex = draftTabs.findIndex(tab => tab.id === tabId);
    const tabName = draftIndex >= 0 ? `Pedido ${draftIndex + 1}` : 'Pedido';
    
    const updatedTabs = state.tabs.map(tab =>
      tab.id === tabId
        ? { 
            ...tab, 
            items: [], 
            clientId: undefined, 
            clientName: undefined, 
            name: tabName 
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

  // Set items for a specific tab
  const setTabItems = (tabId: string, items: QuickCartItem[]) => {
    // Read latest state from localStorage to avoid stale closure issues
    const currentState = getStateFromStorage();
    
    const updatedTabs = currentState.tabs.map(tab =>
      tab.id === tabId
        ? { ...tab, items }
        : tab
    );
    
    const newState: QuickCartState = {
      ...currentState,
      tabs: updatedTabs,
    };
    
    saveStateToStorage(newState);
    setState(newState);
  };

  // Set client for a specific tab
  const setTabClient = (tabId: string, clientId: number, clientName: string) => {
    const updatedTabs = state.tabs.map(tab =>
      tab.id === tabId
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

  // Add or update a tab for editing a saved order
  const addOrUpdateOrderTab = (orderId: number, orderNumber: string, clientId: number, clientName: string) => {
    console.log('addOrUpdateOrderTab called:', { orderId, orderNumber, clientId, clientName });
    console.log('Current tabs:', state.tabs);
    
    // Check if a tab for this order already exists
    const existingTabIndex = state.tabs.findIndex(tab => tab.orderId === orderId);
    
    if (existingTabIndex >= 0) {
      console.log('Updating existing tab at index:', existingTabIndex);
      // Update existing tab and set as active
      const updatedTabs = [...state.tabs];
      updatedTabs[existingTabIndex] = {
        ...updatedTabs[existingTabIndex],
        clientId,
        clientName,
        name: clientName,
        orderNumber,
      };
      
      const newState: QuickCartState = {
        tabs: updatedTabs,
        activeTabId: updatedTabs[existingTabIndex].id,
      };
      
      saveStateToStorage(newState);
      setState(newState);
      console.log('Tab updated, returning ID:', updatedTabs[existingTabIndex].id);
      return updatedTabs[existingTabIndex].id;
    } else {
      console.log('Creating new tab for order');
      // Create new tab for this order
      const newTab: QuickCartTab = {
        id: `order-${orderId}-${Date.now()}`,
        name: clientName,
        clientId,
        clientName,
        items: [], // Items will be loaded separately
        createdAt: Date.now(),
        orderId,
        orderNumber,
      };
      
      const newState: QuickCartState = {
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id,
      };
      
      saveStateToStorage(newState);
      setState(newState);
      console.log('Tab created, returning ID:', newTab.id);
      return newTab.id;
    }
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
    setTabItems,
    setTabClient,
    addOrUpdateOrderTab,
    getTotalItems,
    getActiveTabTotalItems,
    getTotalValue,
    ensureTabExists,
  };
}


