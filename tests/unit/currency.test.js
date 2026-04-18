'use strict';
const { formatCurrency } = require('../../src/utils/currency');

describe('formatCurrency', () => {
  test('formats INR correctly', () => {
    expect(formatCurrency(1234.56, 'INR')).toBe('₹1,234.56');
  });
  test('formats negative INR (refund)', () => {
    expect(formatCurrency(-500, 'INR')).toBe('-₹500.00');
  });
  test('formats USD correctly', () => {
    expect(formatCurrency(99.99, 'USD')).toBe('$99.99');
  });
  test('handles zero', () => {
    expect(formatCurrency(0, 'INR')).toBe('₹0.00');
  });
});
