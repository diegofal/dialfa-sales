import { getErrorMessage } from '../errors';

describe('getErrorMessage', () => {
  it('extracts message from Error instance', () => {
    const error = new Error('Something went wrong');
    expect(getErrorMessage(error)).toBe('Something went wrong');
  });

  it('extracts message from TypeError', () => {
    const error = new TypeError('Cannot read properties of null');
    expect(getErrorMessage(error)).toBe('Cannot read properties of null');
  });

  it('returns string directly when error is a string', () => {
    expect(getErrorMessage('Network failure')).toBe('Network failure');
  });

  it('returns empty string when error is an empty string', () => {
    expect(getErrorMessage('')).toBe('');
  });

  it('extracts message from object with message property', () => {
    const error = { message: 'Custom error object', code: 'ERR_001' };
    expect(getErrorMessage(error)).toBe('Custom error object');
  });

  it('returns fallback for object without message', () => {
    const error = { code: 'ERR_001', details: 'something' };
    expect(getErrorMessage(error)).toBe('An unknown error occurred');
  });

  it('returns fallback for null', () => {
    expect(getErrorMessage(null)).toBe('An unknown error occurred');
  });

  it('returns fallback for undefined', () => {
    expect(getErrorMessage(undefined)).toBe('An unknown error occurred');
  });

  it('returns fallback for number', () => {
    expect(getErrorMessage(42)).toBe('An unknown error occurred');
  });

  it('returns fallback for boolean', () => {
    expect(getErrorMessage(true)).toBe('An unknown error occurred');
  });

  it('returns fallback for object with non-string message', () => {
    const error = { message: 123 };
    expect(getErrorMessage(error)).toBe('An unknown error occurred');
  });

  it('handles Prisma-style error objects', () => {
    const error = { message: 'Unique constraint failed on the fields: (`code`)', code: 'P2002' };
    expect(getErrorMessage(error)).toBe('Unique constraint failed on the fields: (`code`)');
  });

  it('handles axios-style error objects', () => {
    const error = { message: 'Request failed with status code 500', response: { status: 500 } };
    expect(getErrorMessage(error)).toBe('Request failed with status code 500');
  });
});
