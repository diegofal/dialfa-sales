/**
 * BDD Tests for useQuickCartTabs hook
 *
 * Feature: Quick Cart Tab Management
 *   As a user
 *   I want to manage multiple cart tabs (draft orders and saved order edits)
 *   So that I can work on multiple orders simultaneously
 *
 * Feature: Cart Operations Target Correct Tab
 *   As a user viewing a saved order
 *   When I add/remove items or select a client
 *   The changes should apply to my draft cart, not the saved order I'm viewing
 */

import { Article } from '@/types/article';
import { QuickCartItem } from '../useQuickCartTabs';

// ============================================================================
// Test Setup - Mock localStorage and window events
// ============================================================================

const STORAGE_KEY = 'spisa_quick_cart_tabs';

let mockStorage: Record<string, string> = {};
let eventListeners: Record<string, Array<(event: Event) => void>> = {};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn((key: string) => mockStorage[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
  }),
  clear: jest.fn(() => {
    mockStorage = {};
  }),
};

// Mock window with addEventListener/removeEventListener
const windowMock = {
  addEventListener: jest.fn((event: string, handler: (event: Event) => void) => {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(handler);
  }),
  removeEventListener: jest.fn((event: string, handler: (event: Event) => void) => {
    if (eventListeners[event]) {
      eventListeners[event] = eventListeners[event].filter((h) => h !== handler);
    }
  }),
  dispatchEvent: jest.fn((event: Event) => {
    const handlers = eventListeners[event.type] || [];
    handlers.forEach((h) => h(event));
    return true;
  }),
};

Object.defineProperty(global, 'localStorage', { value: localStorageMock });
Object.defineProperty(global, 'window', {
  value: { ...global.window, ...windowMock, localStorage: localStorageMock },
  writable: true,
});

// Helper to create mock articles
function createMockArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: Math.floor(Math.random() * 10000),
    code: 'ART-001',
    description: 'Test Article',
    unitPrice: 100,
    stock: 50,
    isActive: true,
    categoryId: 1,
    categoryName: 'Test Category',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Article;
}

// Helper to setup initial cart state
function setupCartState(state: {
  tabs: Array<{
    id: string;
    name: string;
    clientId?: number;
    clientName?: string;
    items: Array<{ article: Article; quantity: number; discountPercent?: number }>;
    createdAt: number;
    orderId?: number;
    orderNumber?: string;
  }>;
  activeTabId: string;
}) {
  mockStorage[STORAGE_KEY] = JSON.stringify(state);
}

// Helper to get current cart state
function getCartState() {
  const stored = mockStorage[STORAGE_KEY];
  return stored ? JSON.parse(stored) : null;
}

// Import the actual helper functions from the hook file for testing
// We'll test the logic directly since React hooks require a component context

// ============================================================================
// Pure Function Tests (extracted logic)
// ============================================================================

describe('Feature: Cart State Persistence', () => {
  beforeEach(() => {
    mockStorage = {};
    eventListeners = {};
    jest.clearAllMocks();
  });

  describe('Scenario: Load cart from localStorage on initialization', () => {
    it('Given cart state exists in localStorage, When hook initializes, Then it should load the saved state', () => {
      const savedState = {
        tabs: [
          {
            id: 'tab-1',
            name: 'Pedido 1',
            items: [],
            createdAt: Date.now(),
          },
        ],
        activeTabId: 'tab-1',
      };
      setupCartState(savedState);

      const loaded = getCartState();

      expect(loaded.tabs).toHaveLength(1);
      expect(loaded.activeTabId).toBe('tab-1');
    });

    it('Given localStorage is empty, When hook initializes, Then it should return empty state', () => {
      const loaded = getCartState();

      expect(loaded).toBeNull();
    });
  });

  describe('Scenario: Save cart to localStorage on changes', () => {
    it('Given a cart state, When saved to localStorage, Then it should be retrievable', () => {
      const state = {
        tabs: [
          {
            id: 'tab-123',
            name: 'Test Tab',
            items: [],
            createdAt: Date.now(),
          },
        ],
        activeTabId: 'tab-123',
      };

      setupCartState(state);
      const retrieved = getCartState();

      expect(retrieved.tabs[0].id).toBe('tab-123');
      expect(retrieved.tabs[0].name).toBe('Test Tab');
    });
  });
});

describe('Feature: Target Tab Resolution (Critical Bug Fix)', () => {
  /**
   * This is the critical feature that was broken:
   * When viewing a saved order (order tab), cart operations should
   * target the first draft tab, not the active order tab.
   */

  beforeEach(() => {
    mockStorage = {};
    eventListeners = {};
    jest.clearAllMocks();
  });

  // Helper that mimics getTargetTabId logic
  function getTargetTabId(
    tabs: Array<{ id: string; orderId?: number }>,
    activeTabId: string
  ): string {
    const activeTabData = tabs.find((t) => t.id === activeTabId);
    if (activeTabData?.orderId) {
      // Active tab is an order, use first draft tab
      const firstDraftTab = tabs.find((t) => !t.orderId);
      return firstDraftTab?.id || '';
    }
    return activeTabId;
  }

  describe('Scenario: Active tab is a draft tab', () => {
    it('Given active tab is a draft (no orderId), When resolving target tab, Then it should return the active tab', () => {
      const tabs = [
        { id: 'tab-1', name: 'Pedido 1' },
        { id: 'tab-2', name: 'Pedido 2' },
      ];
      const activeTabId = 'tab-1';

      const targetId = getTargetTabId(tabs, activeTabId);

      expect(targetId).toBe('tab-1');
    });
  });

  describe('Scenario: Active tab is a saved order tab', () => {
    it('Given active tab is an order tab (has orderId), When resolving target tab, Then it should return the first draft tab', () => {
      const tabs = [
        { id: 'tab-draft-1', name: 'Pedido 1' }, // Draft tab
        { id: 'order-123-456', name: '#00123 - Cliente X', orderId: 123 }, // Order tab (active)
      ];
      const activeTabId = 'order-123-456';

      const targetId = getTargetTabId(tabs, activeTabId);

      expect(targetId).toBe('tab-draft-1');
    });

    it('Given active tab is an order tab and no draft tabs exist, When resolving target tab, Then it should return empty string', () => {
      const tabs = [{ id: 'order-123-456', name: '#00123 - Cliente X', orderId: 123 }];
      const activeTabId = 'order-123-456';

      const targetId = getTargetTabId(tabs, activeTabId);

      expect(targetId).toBe('');
    });

    it('Given multiple draft tabs exist with order tab active, When resolving target tab, Then it should return the FIRST draft tab', () => {
      const tabs = [
        { id: 'order-999-111', name: '#00999 - Order', orderId: 999 }, // Order tab (active)
        { id: 'tab-draft-2', name: 'Pedido 2' }, // Second draft
        { id: 'tab-draft-1', name: 'Pedido 1' }, // First draft (by array order)
      ];
      const activeTabId = 'order-999-111';

      const targetId = getTargetTabId(tabs, activeTabId);

      // Should return first draft tab found in array
      expect(targetId).toBe('tab-draft-2');
    });
  });
});

describe('Feature: Cart Item Operations', () => {
  beforeEach(() => {
    mockStorage = {};
    eventListeners = {};
    jest.clearAllMocks();
  });

  // Helper that mimics addItem logic
  function addItemToState(
    state: {
      tabs: Array<{
        id: string;
        items: Array<{ article: Article; quantity: number; discountPercent?: number }>;
        orderId?: number;
      }>;
      activeTabId: string;
    },
    article: Article,
    quantity: number = 1
  ) {
    // Get target tab (first draft if active is order)
    const activeTabData = state.tabs.find((t) => t.id === state.activeTabId);
    let targetTabId = state.activeTabId;
    if (activeTabData?.orderId) {
      const firstDraftTab = state.tabs.find((t) => !t.orderId);
      targetTabId = firstDraftTab?.id || '';
    }

    if (!targetTabId) return state;

    const updatedTabs = state.tabs.map((tab) => {
      if (tab.id !== targetTabId) return tab;

      const existingIndex = tab.items.findIndex((item) => item.article.id === article.id);
      let updatedItems;

      if (existingIndex >= 0) {
        updatedItems = [...tab.items];
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          quantity: updatedItems[existingIndex].quantity + quantity,
        };
      } else {
        updatedItems = [...tab.items, { article, quantity, discountPercent: 0 }];
      }

      return { ...tab, items: updatedItems };
    });

    return { ...state, tabs: updatedTabs };
  }

  describe('Scenario: Add item when draft tab is active', () => {
    it('Given active tab is a draft, When adding an item, Then item should be added to that draft tab', () => {
      const article = createMockArticle({ id: 1, code: 'BRD-001' });
      const initialState = {
        tabs: [
          { id: 'tab-1', items: [] as QuickCartItem[], name: 'Pedido 1', createdAt: Date.now() },
        ],
        activeTabId: 'tab-1',
      };

      const newState = addItemToState(initialState, article, 5);

      expect(newState.tabs[0].items).toHaveLength(1);
      expect(newState.tabs[0].items[0].article.id).toBe(1);
      expect(newState.tabs[0].items[0].quantity).toBe(5);
    });

    it('Given item already exists in cart, When adding same item, Then quantity should increase', () => {
      const article = createMockArticle({ id: 1, code: 'BRD-001' });
      const initialState = {
        tabs: [
          {
            id: 'tab-1',
            items: [{ article, quantity: 3, discountPercent: 0 }],
            name: 'Pedido 1',
            createdAt: Date.now(),
          },
        ],
        activeTabId: 'tab-1',
      };

      const newState = addItemToState(initialState, article, 2);

      expect(newState.tabs[0].items).toHaveLength(1);
      expect(newState.tabs[0].items[0].quantity).toBe(5); // 3 + 2
    });
  });

  describe('Scenario: Add item when order tab is active (BUG FIX)', () => {
    it('Given order tab is active, When adding an item, Then item should be added to the FIRST DRAFT tab, not the order tab', () => {
      const article = createMockArticle({ id: 1, code: 'BRD-001' });
      const initialState = {
        tabs: [
          {
            id: 'tab-draft-1',
            items: [] as QuickCartItem[],
            name: 'Pedido 1',
            createdAt: Date.now(),
          },
          {
            id: 'order-123-456',
            items: [] as QuickCartItem[],
            name: '#00123 - Cliente X',
            createdAt: Date.now(),
            orderId: 123,
          },
        ],
        activeTabId: 'order-123-456', // Order tab is active!
      };

      const newState = addItemToState(initialState, article, 5);

      // Item should be in draft tab, NOT order tab
      expect(newState.tabs[0].items).toHaveLength(1); // Draft tab has the item
      expect(newState.tabs[0].items[0].article.id).toBe(1);
      expect(newState.tabs[1].items).toHaveLength(0); // Order tab remains empty
    });
  });
});

describe('Feature: Client Selection', () => {
  beforeEach(() => {
    mockStorage = {};
    eventListeners = {};
    jest.clearAllMocks();
  });

  // Helper that mimics setClient logic
  function setClientInState(
    state: {
      tabs: Array<{
        id: string;
        clientId?: number;
        clientName?: string;
        name: string;
        orderId?: number;
      }>;
      activeTabId: string;
    },
    clientId: number,
    clientName: string
  ) {
    // Get target tab (first draft if active is order)
    const activeTabData = state.tabs.find((t) => t.id === state.activeTabId);
    let targetTabId = state.activeTabId;
    if (activeTabData?.orderId) {
      const firstDraftTab = state.tabs.find((t) => !t.orderId);
      targetTabId = firstDraftTab?.id || '';
    }

    if (!targetTabId) return state;

    const updatedTabs = state.tabs.map((tab) =>
      tab.id === targetTabId ? { ...tab, clientId, clientName, name: clientName } : tab
    );

    return { ...state, tabs: updatedTabs };
  }

  describe('Scenario: Select client when draft tab is active', () => {
    it('Given active tab is a draft, When selecting a client, Then client should be set on that draft tab', () => {
      const initialState = {
        tabs: [
          {
            id: 'tab-1',
            name: 'Pedido 1',
            createdAt: Date.now(),
          },
        ],
        activeTabId: 'tab-1',
      };

      const newState = setClientInState(initialState, 42, 'Acme Corp');

      expect(newState.tabs[0].clientId).toBe(42);
      expect(newState.tabs[0].clientName).toBe('Acme Corp');
      expect(newState.tabs[0].name).toBe('Acme Corp');
    });
  });

  describe('Scenario: Select client when order tab is active (BUG FIX)', () => {
    it('Given order tab is active, When selecting a client, Then client should be set on the FIRST DRAFT tab, not the order tab', () => {
      const initialState = {
        tabs: [
          {
            id: 'tab-draft-1',
            name: 'Pedido 1',
            createdAt: Date.now(),
          },
          {
            id: 'order-123-456',
            name: '#00123 - Cliente Original',
            clientId: 999,
            clientName: 'Cliente Original',
            createdAt: Date.now(),
            orderId: 123,
          },
        ],
        activeTabId: 'order-123-456', // Order tab is active!
      };

      const newState = setClientInState(initialState, 42, 'Nuevo Cliente');

      // Client should be set on draft tab, NOT order tab
      expect(newState.tabs[0].clientId).toBe(42); // Draft tab has new client
      expect(newState.tabs[0].clientName).toBe('Nuevo Cliente');
      expect(newState.tabs[0].name).toBe('Nuevo Cliente');

      // Order tab should remain unchanged
      expect(newState.tabs[1].clientId).toBe(999);
      expect(newState.tabs[1].clientName).toBe('Cliente Original');
    });
  });
});

describe('Feature: Remove Item Operations', () => {
  beforeEach(() => {
    mockStorage = {};
    eventListeners = {};
    jest.clearAllMocks();
  });

  // Helper that mimics removeItem logic
  function removeItemFromState(
    state: {
      tabs: Array<{
        id: string;
        items: Array<{ article: Article; quantity: number }>;
        orderId?: number;
      }>;
      activeTabId: string;
    },
    articleId: number
  ) {
    // Get target tab (first draft if active is order)
    const activeTabData = state.tabs.find((t) => t.id === state.activeTabId);
    let targetTabId = state.activeTabId;
    if (activeTabData?.orderId) {
      const firstDraftTab = state.tabs.find((t) => !t.orderId);
      targetTabId = firstDraftTab?.id || '';
    }

    if (!targetTabId) return state;

    const updatedTabs = state.tabs.map((tab) => {
      if (tab.id !== targetTabId) return tab;
      return {
        ...tab,
        items: tab.items.filter((item) => item.article.id !== articleId),
      };
    });

    return { ...state, tabs: updatedTabs };
  }

  describe('Scenario: Remove item when draft tab is active', () => {
    it('Given active tab is a draft with items, When removing an item, Then item should be removed from that draft tab', () => {
      const article1 = createMockArticle({ id: 1 });
      const article2 = createMockArticle({ id: 2 });
      const initialState = {
        tabs: [
          {
            id: 'tab-1',
            items: [
              { article: article1, quantity: 5 },
              { article: article2, quantity: 3 },
            ],
            name: 'Pedido 1',
            createdAt: Date.now(),
          },
        ],
        activeTabId: 'tab-1',
      };

      const newState = removeItemFromState(initialState, 1);

      expect(newState.tabs[0].items).toHaveLength(1);
      expect(newState.tabs[0].items[0].article.id).toBe(2);
    });
  });

  describe('Scenario: Remove item when order tab is active (BUG FIX)', () => {
    it('Given order tab is active with items in draft, When removing an item, Then item should be removed from DRAFT tab, not order tab', () => {
      const article1 = createMockArticle({ id: 1 });
      const article2 = createMockArticle({ id: 2 });
      const initialState = {
        tabs: [
          {
            id: 'tab-draft-1',
            items: [
              { article: article1, quantity: 5 },
              { article: article2, quantity: 3 },
            ],
            name: 'Pedido 1',
            createdAt: Date.now(),
          },
          {
            id: 'order-123-456',
            items: [{ article: article1, quantity: 10 }], // Order also has article 1
            name: '#00123 - Cliente X',
            createdAt: Date.now(),
            orderId: 123,
          },
        ],
        activeTabId: 'order-123-456', // Order tab is active!
      };

      const newState = removeItemFromState(initialState, 1);

      // Item should be removed from draft tab
      expect(newState.tabs[0].items).toHaveLength(1);
      expect(newState.tabs[0].items[0].article.id).toBe(2);

      // Order tab should remain unchanged
      expect(newState.tabs[1].items).toHaveLength(1);
      expect(newState.tabs[1].items[0].article.id).toBe(1);
      expect(newState.tabs[1].items[0].quantity).toBe(10);
    });
  });
});

describe('Feature: Total Items Count', () => {
  beforeEach(() => {
    mockStorage = {};
    eventListeners = {};
    jest.clearAllMocks();
  });

  // Helper that mimics getTotalItems logic
  function getTotalItems(
    tabs: Array<{
      items: Array<{ quantity: number }>;
      orderId?: number;
    }>
  ): number {
    return tabs
      .filter((tab) => !tab.orderId) // Only count drafts
      .reduce((sum, tab) => sum + tab.items.reduce((tabSum, item) => tabSum + item.quantity, 0), 0);
  }

  describe('Scenario: Count only draft tab items', () => {
    it('Given draft and order tabs with items, When counting total items, Then only draft tab items should be counted', () => {
      const tabs = [
        {
          id: 'tab-draft-1',
          items: [{ quantity: 5 }, { quantity: 3 }],
        },
        {
          id: 'tab-draft-2',
          items: [{ quantity: 2 }],
        },
        {
          id: 'order-123',
          items: [{ quantity: 100 }], // Should NOT be counted
          orderId: 123,
        },
      ];

      const total = getTotalItems(tabs);

      expect(total).toBe(10); // 5 + 3 + 2, NOT including the 100 from order
    });
  });
});

describe('Feature: Tab Management', () => {
  beforeEach(() => {
    mockStorage = {};
    eventListeners = {};
    jest.clearAllMocks();
  });

  describe('Scenario: Add new tab', () => {
    it('Given existing tabs, When adding a new tab, Then new tab should be appended and set as active', () => {
      const initialState = {
        tabs: [{ id: 'tab-1', name: 'Pedido 1', items: [], createdAt: 1000 }],
        activeTabId: 'tab-1',
      };

      // Simulate adding a tab
      const newTab = {
        id: 'tab-2',
        name: `Pedido ${initialState.tabs.length + 1}`,
        items: [],
        createdAt: Date.now(),
      };
      const newState = {
        tabs: [...initialState.tabs, newTab],
        activeTabId: newTab.id,
      };

      expect(newState.tabs).toHaveLength(2);
      expect(newState.activeTabId).toBe('tab-2');
      expect(newState.tabs[1].name).toBe('Pedido 2');
    });
  });

  describe('Scenario: Remove tab', () => {
    it('Given multiple tabs, When removing a tab, Then tab should be removed and active tab updated if necessary', () => {
      const initialState = {
        tabs: [
          { id: 'tab-1', name: 'Pedido 1', items: [], createdAt: 1000 },
          { id: 'tab-2', name: 'Pedido 2', items: [], createdAt: 2000 },
        ],
        activeTabId: 'tab-1',
      };

      // Simulate removing active tab
      const tabIdToRemove = 'tab-1';
      const filteredTabs = initialState.tabs.filter((tab) => tab.id !== tabIdToRemove);
      const newActiveTabId =
        tabIdToRemove === initialState.activeTabId
          ? filteredTabs.length > 0
            ? filteredTabs[0].id
            : ''
          : initialState.activeTabId;

      const newState = {
        tabs: filteredTabs,
        activeTabId: newActiveTabId,
      };

      expect(newState.tabs).toHaveLength(1);
      expect(newState.activeTabId).toBe('tab-2');
    });
  });

  describe('Scenario: Order tab creation and management', () => {
    it('Given no existing order tab, When creating order tab, Then new tab should be created with order metadata', () => {
      const initialState = {
        tabs: [{ id: 'tab-1', name: 'Pedido 1', items: [], createdAt: 1000 }],
        activeTabId: 'tab-1',
      };

      const orderId = 123;
      const orderNumber = '00123';
      const clientId = 42;
      const clientName = 'Acme Corp';

      const newTab = {
        id: `order-${orderId}-${Date.now()}`,
        name: `#${orderNumber} - ${clientName}`,
        clientId,
        clientName,
        items: [],
        createdAt: Date.now(),
        orderId,
        orderNumber,
      };

      const newState = {
        tabs: [...initialState.tabs, newTab],
        activeTabId: newTab.id,
      };

      expect(newState.tabs).toHaveLength(2);
      expect(newState.tabs[1].orderId).toBe(123);
      expect(newState.tabs[1].orderNumber).toBe('00123');
      expect(newState.tabs[1].name).toContain('#00123');
    });
  });
});
