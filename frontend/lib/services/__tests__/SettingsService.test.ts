import { NextRequest } from 'next/server';
import { get, update } from '../SettingsService';

// Mock dependencies
const mockFindUnique = jest.fn();
const mockCreate = jest.fn();
const mockUpsert = jest.fn();
jest.mock('@/lib/db', () => ({
  prisma: {
    system_settings: {
      get findUnique() {
        return mockFindUnique;
      },
      get create() {
        return mockCreate;
      },
      get upsert() {
        return mockUpsert;
      },
    },
  },
}));

jest.mock('@/lib/utils/activityLogger', () => ({
  logActivity: jest.fn().mockResolvedValue(1n),
}));

jest.mock('@/lib/utils/changeTracker', () => ({
  ChangeTracker: jest.fn().mockImplementation(() => ({
    trackBefore: jest.fn().mockResolvedValue(undefined),
    trackAfter: jest.fn().mockResolvedValue(undefined),
    trackCreate: jest.fn(),
    saveChanges: jest.fn().mockResolvedValue(undefined),
  })),
}));

function createMockRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/settings', {
    headers: new Headers({ 'x-user-id': '1', 'x-user-name': 'admin' }),
  });
}

const mockSettings = {
  id: 1,
  usd_exchange_rate: '1150.5000',
  updated_at: new Date('2024-06-15T10:00:00Z'),
  updated_by: 'admin',
};

describe('get', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns existing settings mapped to DTO', async () => {
    mockFindUnique.mockResolvedValue(mockSettings);

    const result = await get();

    expect(result).toEqual({
      id: 1,
      usdExchangeRate: 1150.5,
      updatedAt: '2024-06-15T10:00:00.000Z',
      updatedBy: 'admin',
    });
  });

  it('creates default settings when none exist', async () => {
    mockFindUnique.mockResolvedValue(null);
    const created = {
      id: 1,
      usd_exchange_rate: '1000.0000',
      updated_at: new Date('2024-01-01T00:00:00Z'),
      updated_by: null,
    };
    mockCreate.mockResolvedValue(created);

    const result = await get();

    expect(mockCreate).toHaveBeenCalledWith({
      data: { id: 1, usd_exchange_rate: 1000.0, updated_at: expect.any(Date) },
    });
    expect(result.usdExchangeRate).toBe(1000);
  });

  it('converts Decimal string to number', async () => {
    mockFindUnique.mockResolvedValue({
      ...mockSettings,
      usd_exchange_rate: '999.9900',
    });

    const result = await get();
    expect(result.usdExchangeRate).toBe(999.99);
  });
});

describe('update', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('upserts the exchange rate', async () => {
    mockFindUnique.mockResolvedValue(mockSettings);
    const updated = { ...mockSettings, usd_exchange_rate: '1200.0000' };
    mockUpsert.mockResolvedValue(updated);

    await update({ usdExchangeRate: 1200 }, createMockRequest());

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: expect.objectContaining({ usd_exchange_rate: 1200 }),
      create: expect.objectContaining({ usd_exchange_rate: 1200 }),
    });
  });

  it('returns the updated settings as DTO', async () => {
    mockFindUnique.mockResolvedValue(mockSettings);
    const updated = {
      ...mockSettings,
      usd_exchange_rate: '1300.0000',
      updated_at: new Date('2024-07-01T12:00:00Z'),
    };
    mockUpsert.mockResolvedValue(updated);

    const result = await update({ usdExchangeRate: 1300 }, createMockRequest());

    expect(result.usdExchangeRate).toBe(1300);
    expect(result.updatedAt).toBe('2024-07-01T12:00:00.000Z');
  });

  it('calls trackBefore when settings already exist', async () => {
    mockFindUnique.mockResolvedValue(mockSettings);
    mockUpsert.mockResolvedValue(mockSettings);

    await update({ usdExchangeRate: 1100 }, createMockRequest());

    const { ChangeTracker } = require('@/lib/utils/changeTracker');
    const tracker = ChangeTracker.mock.results[0].value;
    expect(tracker.trackBefore).toHaveBeenCalledWith('settings', 1);
  });

  it('calls trackAfter when settings already exist', async () => {
    mockFindUnique.mockResolvedValue(mockSettings);
    mockUpsert.mockResolvedValue(mockSettings);

    await update({ usdExchangeRate: 1100 }, createMockRequest());

    const { ChangeTracker } = require('@/lib/utils/changeTracker');
    const tracker = ChangeTracker.mock.results[0].value;
    expect(tracker.trackAfter).toHaveBeenCalledWith('settings', 1);
  });

  it('calls trackCreate when settings do not exist', async () => {
    mockFindUnique.mockResolvedValue(null);
    const created = { ...mockSettings, usd_exchange_rate: '1500.0000' };
    mockUpsert.mockResolvedValue(created);

    await update({ usdExchangeRate: 1500 }, createMockRequest());

    const { ChangeTracker } = require('@/lib/utils/changeTracker');
    const tracker = ChangeTracker.mock.results[0].value;
    expect(tracker.trackCreate).toHaveBeenCalledWith('settings', 1, expect.any(Object));
  });
});
