import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DeliveryNoteTab {
  id: string;
  deliveryNoteId: number;
  deliveryNumber: string;
  clientName: string;
  salesOrderNumber: string;
}

interface QuickDeliveryNoteTabsStore {
  tabs: DeliveryNoteTab[];
  activeTabId: string | null;
  addTab: (tab: DeliveryNoteTab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  clearTabs: () => void;
}

export const useQuickDeliveryNoteTabs = create<QuickDeliveryNoteTabsStore>()(
  persist(
    (set) => ({
      tabs: [],
      activeTabId: null,
      
      addTab: (tab) =>
        set((state) => {
          // Check if tab already exists
          const existingTab = state.tabs.find((t) => t.deliveryNoteId === tab.deliveryNoteId);
          if (existingTab) {
            return { activeTabId: existingTab.id };
          }
          
          return {
            tabs: [...state.tabs, tab],
            activeTabId: tab.id,
          };
        }),
      
      removeTab: (id) =>
        set((state) => {
          const newTabs = state.tabs.filter((t) => t.id !== id);
          const newActiveTabId = state.activeTabId === id 
            ? (newTabs.length > 0 ? newTabs[0].id : null)
            : state.activeTabId;
          
          return {
            tabs: newTabs,
            activeTabId: newActiveTabId,
          };
        }),
      
      setActiveTab: (id) => set({ activeTabId: id }),
      
      clearTabs: () => set({ tabs: [], activeTabId: null }),
    }),
    {
      name: 'quick-delivery-note-tabs-storage',
    }
  )
);

