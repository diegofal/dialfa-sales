import { useState, useEffect } from 'react';

export interface QuickInvoiceTab {
  id: string;
  invoiceId: number;
  invoiceNumber: string;
  clientName: string;
  createdAt: number;
}

interface QuickInvoiceState {
  tabs: QuickInvoiceTab[];
  activeTabId: string;
}

const STORAGE_KEY = 'spisa_quick_invoice_tabs';
const INVOICE_UPDATE_EVENT = 'quick-invoice-tabs-updated';

// Helper to dispatch invoice update events
const dispatchInvoiceUpdate = () => {
  window.dispatchEvent(new Event(INVOICE_UPDATE_EVENT));
};

// Helper to get current state from localStorage
const getStateFromStorage = (): QuickInvoiceState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading quick invoice tabs:', error);
  }
  
  return {
    tabs: [],
    activeTabId: '',
  };
};

// Helper to save state to localStorage
const saveStateToStorage = (state: QuickInvoiceState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    dispatchInvoiceUpdate();
  } catch (error) {
    console.error('Error saving quick invoice tabs:', error);
  }
};

export function useQuickInvoiceTabs() {
  const [state, setState] = useState<QuickInvoiceState>(() => {
    if (typeof window === 'undefined') {
      return { tabs: [], activeTabId: '' };
    }
    return getStateFromStorage();
  });

  // Load tabs from localStorage on mount
  useEffect(() => {
    const loadedState = getStateFromStorage();
    setState(loadedState);
  }, []);

  // Listen for tab updates from other components
  useEffect(() => {
    const handleInvoiceUpdate = () => {
      const updatedState = getStateFromStorage();
      setState(updatedState);
    };

    window.addEventListener(INVOICE_UPDATE_EVENT, handleInvoiceUpdate);
    return () => {
      window.removeEventListener(INVOICE_UPDATE_EVENT, handleInvoiceUpdate);
    };
  }, []);

  // Add or update invoice tab
  const addInvoiceTab = (invoiceId: number, invoiceNumber: string, clientName: string) => {
    // Check if a tab for this invoice already exists
    const existingTabIndex = state.tabs.findIndex(tab => tab.invoiceId === invoiceId);
    
    if (existingTabIndex >= 0) {
      // Update existing tab and set as active
      const updatedTabs = [...state.tabs];
      updatedTabs[existingTabIndex] = {
        ...updatedTabs[existingTabIndex],
        invoiceNumber,
        clientName,
      };
      
      const newState: QuickInvoiceState = {
        tabs: updatedTabs,
        activeTabId: updatedTabs[existingTabIndex].id,
      };
      
      saveStateToStorage(newState);
      setState(newState);
      return updatedTabs[existingTabIndex].id;
    } else {
      // Create new tab for this invoice
      const newTab: QuickInvoiceTab = {
        id: `invoice-${invoiceId}-${Date.now()}`,
        invoiceId,
        invoiceNumber,
        clientName,
        createdAt: Date.now(),
      };
      
      const newState: QuickInvoiceState = {
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id,
      };
      
      saveStateToStorage(newState);
      setState(newState);
      return newTab.id;
    }
  };

  // Remove tab
  const removeTab = (tabId: string) => {
    const filteredTabs = state.tabs.filter(tab => tab.id !== tabId);
    const newActiveTabId = tabId === state.activeTabId 
      ? (filteredTabs.length > 0 ? filteredTabs[0].id : '')
      : state.activeTabId;
    
    const newState: QuickInvoiceState = {
      tabs: filteredTabs,
      activeTabId: newActiveTabId,
    };
    
    saveStateToStorage(newState);
    setState(newState);
  };

  // Set active tab
  const setActiveTab = (tabId: string) => {
    const newState: QuickInvoiceState = {
      ...state,
      activeTabId: tabId,
    };
    
    saveStateToStorage(newState);
    setState(newState);
  };

  // Get active tab
  const activeTab = state.tabs.find(tab => tab.id === state.activeTabId) || state.tabs[0];

  return {
    tabs: state.tabs,
    activeTab,
    activeTabId: state.activeTabId,
    addInvoiceTab,
    removeTab,
    setActiveTab,
  };
}













