import { extractErrorMessage } from '../useEntityMutation';

describe('extractErrorMessage', () => {
  it('extracts message from axios error response', () => {
    const error = {
      response: {
        data: {
          message: 'Articulo no encontrado',
        },
      },
    };
    expect(extractErrorMessage(error, 'fallback')).toBe('Articulo no encontrado');
  });

  it('extracts message from standard Error', () => {
    const error = new Error('Something went wrong');
    expect(extractErrorMessage(error, 'fallback')).toBe('Something went wrong');
  });

  it('returns string error directly', () => {
    expect(extractErrorMessage('Direct error', 'fallback')).toBe('Direct error');
  });

  it('returns fallback for null', () => {
    expect(extractErrorMessage(null, 'fallback message')).toBe('fallback message');
  });

  it('returns fallback for undefined', () => {
    expect(extractErrorMessage(undefined, 'fallback message')).toBe('fallback message');
  });

  it('returns fallback for empty object', () => {
    expect(extractErrorMessage({}, 'fallback message')).toBe('fallback message');
  });

  it('returns fallback for number', () => {
    expect(extractErrorMessage(42, 'fallback message')).toBe('fallback message');
  });

  it('returns fallback for axios error without message', () => {
    const error = {
      response: {
        data: {},
      },
    };
    expect(extractErrorMessage(error, 'fallback')).toBe('fallback');
  });

  it('returns fallback for axios error with non-string message', () => {
    const error = {
      response: {
        data: {
          message: 123,
        },
      },
    };
    expect(extractErrorMessage(error, 'fallback')).toBe('fallback');
  });

  it('handles axios error with null response data', () => {
    const error = {
      response: {
        data: null,
      },
    };
    expect(extractErrorMessage(error, 'fallback')).toBe('fallback');
  });

  it('handles axios error with null response', () => {
    const error = {
      response: null,
    };
    expect(extractErrorMessage(error, 'fallback')).toBe('fallback');
  });

  it('prefers axios error message over Error.message', () => {
    const error = Object.assign(new Error('generic'), {
      response: {
        data: {
          message: 'API specific error',
        },
      },
    });
    expect(extractErrorMessage(error, 'fallback')).toBe('API specific error');
  });
});
