import { useState, useEffect } from 'react';
import { Article } from '@/types/article';

export interface QuickCartItem {
  article: Article;
  quantity: number;
  discountPercent?: number;
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
    console.warn('Saving state to localStorage:', state);
    if (state.tabs.length === 0) {
      console.warn('WARNING: Saving empty tabs array!');
      console.trace('Stack trace for empty save:');
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    console.warn('State saved successfully');
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
    console.warn('Loading state from localStorage on mount:', loadedState);
    setState(loadedState);
    setIsLoaded(true);
  }, []);

  // Listen for cart updates from other components
  useEffect(() => {
    const handleCartUpdate = () => {
      const updatedState = getStateFromStorage();
      console.warn('Cart update event received, loading from localStorage:', updatedState);
      setState(updatedState);
    };

    window.addEventListener(CART_UPDATE_EVENT, handleCartUpdate);
    return () => {
      window.removeEventListener(CART_UPDATE_EVENT, handleCartUpdate);
    };
  }, []);

  // Get active tab
  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId) ||
    state.tabs[0] || {
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
    const filteredTabs = state.tabs.filter((tab) => tab.id !== tabId);
    const newActiveTabId =
      tabId === state.activeTabId
        ? filteredTabs.length > 0
          ? filteredTabs[0].id
          : ''
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

  // Set client for active tab (or first draft tab if active is an order)
  const setClient = (clientId: number, clientName: string) => {
    const targetTabId = getTargetTabId();
    console.warn('👤 setClient:', {
      clientId,
      clientName,
      activeTabId: state.activeTabId,
      targetTabId,
    });

    if (!targetTabId) {
      console.error('👤 ERROR: No target tab found for setClient!');
      return;
    }

    const updatedTabs = state.tabs.map((tab) =>
      tab.id === targetTabId ? { ...tab, clientId, clientName, name: clientName } : tab
    );

    const newState: QuickCartState = {
      ...state,
      tabs: updatedTabs,
    };

    saveStateToStorage(newState);
    setState(newState);
  };

  // Clear client for active tab (or first draft tab if active is an order)
  const clearClient = () => {
    const targetTabId = getTargetTabId();
    console.warn('👤 clearClient:', { activeTabId: state.activeTabId, targetTabId });

    if (!targetTabId) {
      console.error('👤 ERROR: No target tab found for clearClient!');
      return;
    }

    const tabIndex = state.tabs.findIndex((tab) => tab.id === targetTabId);
    const tabName = tabIndex >= 0 ? `Pedido ${tabIndex + 1}` : 'Pedido';

    const updatedTabs = state.tabs.map((tab) =>
      tab.id === targetTabId
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
    const tabIndex = state.tabs.findIndex((tab) => tab.id === tabId);
    const tabName = tabIndex >= 0 ? `Pedido ${tabIndex + 1}` : 'Pedido';

    const updatedTabs = state.tabs.map((tab) =>
      tab.id === tabId ? { ...tab, clientId: undefined, clientName: undefined, name: tabName } : tab
    );

    const newState: QuickCartState = {
      ...state,
      tabs: updatedTabs,
    };

    saveStateToStorage(newState);
    setState(newState);
  };

  // Add item to active tab (or first draft tab if active is an order)
  const addItem = (article: Article, quantity: number = 1, discountPercent?: number) => {
    let targetTabId = getTargetTabId();

    console.warn('➕ addItem called:', {
      articleCode: article.code,
      quantity,
      activeTabId: state.activeTabId,
      targetTabId,
    });

    // If no draft tab exists, create one
    let tabsToUpdate = state.tabs;
    if (!targetTabId) {
      console.warn('➕ No draft tab exists, creating one');
      const newDraftTab: QuickCartTab = {
        id: `tab-${Date.now()}`,
        name: `Pedido ${state.tabs.length + 1}`,
        items: [],
        createdAt: Date.now(),
      };
      tabsToUpdate = [...state.tabs, newDraftTab];
      targetTabId = newDraftTab.id;
    }

    const updatedTabs = tabsToUpdate.map((tab) => {
      if (tab.id !== targetTabId) return tab;

      const existingIndex = tab.items.findIndex((item) => item.article.id === article.id);
      let updatedItems: QuickCartItem[];

      if (existingIndex >= 0) {
        console.warn('➕ Item already exists, updating quantity');
        updatedItems = [...tab.items];
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          quantity: updatedItems[existingIndex].quantity + quantity,
        };
      } else {
        console.warn('➕ Adding new item');
        updatedItems = [
          ...tab.items,
          {
            article,
            quantity,
            discountPercent: discountPercent ?? article.categoryDefaultDiscount ?? 0,
          },
        ];
      }

      console.warn('➕ Updated items count:', updatedItems.length);
      return { ...tab, items: updatedItems };
    });

    const newState: QuickCartState = {
      ...state,
      tabs: updatedTabs,
    };

    saveStateToStorage(newState);
    setState(newState);
  };

  // Helper to get the correct tab ID for cart operations
  // If activeTab is an order tab, use first draft tab instead
  const getTargetTabId = (): string => {
    const activeTabData = state.tabs.find((t) => t.id === state.activeTabId);
    if (activeTabData?.orderId) {
      // Active tab is an order, use first draft tab
      const firstDraftTab = state.tabs.find((t) => !t.orderId);
      console.warn('🎯 Active tab is order, using draft tab:', firstDraftTab?.id || 'NONE');
      return firstDraftTab?.id || '';
    }
    return state.activeTabId;
  };

  // Remove item from active tab (or first draft tab if active is an order)
  const removeItem = (articleId: number) => {
    const targetTabId = getTargetTabId();

    console.warn('🗑️ removeItem called:', {
      articleId,
      activeTabId: state.activeTabId,
      targetTabId,
      isActiveTabOrder: state.activeTabId.startsWith('order-'),
    });

    if (!targetTabId) {
      console.error('🗑️ ERROR: No target tab found!');
      return;
    }

    const updatedTabs = state.tabs.map((tab) => {
      if (tab.id !== targetTabId) {
        return tab;
      }
      console.warn('🗑️ Found target tab, removing item:', {
        tabId: tab.id,
        tabName: tab.name,
        currentItems: tab.items.map((i) => i.article.id),
        removing: articleId,
      });
      const filteredItems = tab.items.filter((item) => item.article.id !== articleId);
      console.warn(
        '🗑️ Items after filter:',
        filteredItems.map((i) => i.article.id)
      );
      return {
        ...tab,
        items: filteredItems,
      };
    });

    const newState: QuickCartState = {
      ...state,
      tabs: updatedTabs,
    };

    saveStateToStorage(newState);
    setState(newState);
  };

  // Update quantity in active tab (or first draft tab if active is an order)
  const updateQuantity = (articleId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(articleId);
      return;
    }

    const targetTabId = getTargetTabId();
    console.warn('🔢 updateQuantity:', { articleId, quantity, targetTabId });

    if (!targetTabId) return;

    const updatedTabs = state.tabs.map((tab) => {
      if (tab.id !== targetTabId) return tab;
      return {
        ...tab,
        items: tab.items.map((item) =>
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
    const targetTabId = getTargetTabId();
    if (!targetTabId) return;

    const updatedTabs = state.tabs.map((tab) => {
      if (tab.id !== targetTabId) return tab;

      return {
        ...tab,
        items: tab.items.map((item) =>
          item.article.id === oldArticleId
            ? {
                article: newArticle,
                quantity: item.quantity,
                discountPercent: item.discountPercent,
              }
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

  // Update discount for an item in active tab
  const updateItemDiscount = (articleId: number, discountPercent: number) => {
    const targetTabId = getTargetTabId();
    if (!targetTabId) return;

    const updatedTabs = state.tabs.map((tab) => {
      if (tab.id !== targetTabId) return tab;
      return {
        ...tab,
        items: tab.items.map((item) =>
          item.article.id === articleId ? { ...item, discountPercent } : item
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

  // Clear items in active tab (or first draft tab if active is an order)
  const clearCart = () => {
    const targetTabId = getTargetTabId();
    if (!targetTabId) return;

    const updatedTabs = state.tabs.map((tab) =>
      tab.id === targetTabId ? { ...tab, items: [] } : tab
    );

    const newState: QuickCartState = {
      ...state,
      tabs: updatedTabs,
    };

    saveStateToStorage(newState);
    setState(newState);
  };

  // Get total items in active tab
  const getActiveTabTotalItems = () => {
    return activeTab.items.reduce((sum, item) => sum + item.quantity, 0);
  };

  // Get total value in active tab
  const getTotalValue = () => {
    return activeTab.items.reduce((sum, item) => sum + item.article.unitPrice * item.quantity, 0);
  };

  // Get items from a specific tab by ID
  const getTabItems = (tabId: string): QuickCartItem[] => {
    const tab = state.tabs.find((t) => t.id === tabId);
    return tab?.items || [];
  };

  // Clear items in a specific tab
  const clearSpecificCart = (tabId: string) => {
    const updatedTabs = state.tabs.map((tab) => (tab.id === tabId ? { ...tab, items: [] } : tab));

    const newState: QuickCartState = {
      ...state,
      tabs: updatedTabs,
    };

    saveStateToStorage(newState);
    setState(newState);
  };

  // Clear both items and client from a specific tab
  const clearSpecificTabCompletely = (tabId: string) => {
    const tabIndex = state.tabs.findIndex((tab) => tab.id === tabId);
    const tabName = tabIndex >= 0 ? `Pedido ${tabIndex + 1}` : 'Pedido';

    const updatedTabs = state.tabs.map((tab) =>
      tab.id === tabId
        ? {
            ...tab,
            items: [],
            clientId: undefined,
            clientName: undefined,
            name: tabName,
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

  // Add or update a tab for editing a saved order (for sidebar navigation)
  // NOTE: This creates a tab but does NOT sync with QuickCart popup
  const addOrUpdateOrderTab = (
    orderId: number,
    orderNumber: string,
    clientId: number,
    clientName: string,
    items: QuickCartItem[] = []
  ) => {
    console.warn('addOrUpdateOrderTab called:', { orderId, orderNumber, clientId, clientName });

    // Check if a tab for this order already exists
    const existingTabIndex = state.tabs.findIndex((tab) => tab.orderId === orderId);

    if (existingTabIndex >= 0) {
      console.warn('Updating existing order tab at index:', existingTabIndex);
      // Update existing tab and set as active
      const updatedTabs = [...state.tabs];
      updatedTabs[existingTabIndex] = {
        ...updatedTabs[existingTabIndex],
        clientId,
        clientName,
        name: `#${orderNumber} - ${clientName}`,
        orderNumber,
        items, // Update items too
      };

      const newState: QuickCartState = {
        tabs: updatedTabs,
        activeTabId: updatedTabs[existingTabIndex].id,
      };

      saveStateToStorage(newState);
      setState(newState);
      console.warn('Order tab updated, returning ID:', updatedTabs[existingTabIndex].id);
      return updatedTabs[existingTabIndex].id;
    } else {
      console.warn('Creating new tab for order');
      // Create new tab for this order
      const newTab: QuickCartTab = {
        id: `order-${orderId}-${Date.now()}`,
        name: `#${orderNumber} - ${clientName}`,
        clientId,
        clientName,
        items,
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
      console.warn('Order tab created, returning ID:', newTab.id);
      return newTab.id;
    }
  };

  // Get total items across all tabs (ONLY count draft tabs, not saved orders)
  const getTotalItems = () => {
    return state.tabs
      .filter((tab) => !tab.orderId) // Only count drafts
      .reduce((sum, tab) => sum + tab.items.reduce((tabSum, item) => tabSum + item.quantity, 0), 0);
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
    updateItemDiscount,
    replaceItem,
    clearCart,
    getTabItems,
    clearSpecificCart,
    clearSpecificTabCompletely,
    addOrUpdateOrderTab,
    getTotalItems,
    getActiveTabTotalItems,
    getTotalValue,
    ensureTabExists,
  };
}
