// jest.setup.js - Global test setup
// Add custom matchers from @testing-library/jest-dom (when testing React components)
// import '@testing-library/jest-dom';

// Suppress console noise in tests
const originalError = console.error;
console.error = (...args) => {
  // Suppress React act() warnings and other noisy test outputs
  if (typeof args[0] === 'string' && args[0].includes('act(')) return;
  originalError.call(console, ...args);
};
