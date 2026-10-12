import test from 'node:test';
import assert from 'node:assert/strict';
import { extractInvoiceFields } from './ocrService.js';

test('uses balance due and never mistakes subtotal for total', () => {
  const fields = extractInvoiceFields([
    'Invoice Number: HCL',
    'Invoice Date: Oct 12, 2026',
    'Balance Due: #15,750.00',
    'Item Quantity Rate Amount',
    'Tow Truck Service 1 %15,000.00 %15,000.00',
    'Subtotal: 715,000.00',
    'Tax (5%): 750.00',
    'Total: ¥15,750.00',
  ].join('\n'));

  assert.equal(fields.invoiceNumber, 'HCL');
  assert.equal(fields.invoiceDate, '2026-10-12');
  assert.equal(fields.rawTotal, '15,750.00');
  assert.equal(fields.totalAmount, 15750);
  assert.equal(fields.currency, '');
});

test('extracts a rupee total with Indian digit grouping', () => {
  const fields = extractInvoiceFields('Total Due: ₹1,50,000.00');

  assert.equal(fields.totalAmount, 150000);
  assert.equal(fields.currency, 'INR');
});

test('does not treat a subtotal as the invoice amount', () => {
  const fields = extractInvoiceFields('Subtotal: 715,000.00\nTax: 750.00');

  assert.equal(fields.totalAmount, 0);
  assert.equal(fields.rawTotal, '');
});

test('uses explicit foreign currency context for yen amounts', () => {
  const fields = extractInvoiceFields('Invoice Total: ¥15,750.00\nCurrency: JPY');

  assert.equal(fields.totalAmount, 15750);
  assert.equal(fields.currency, 'JPY');
});

test('parses comma-decimal invoice amounts', () => {
  const fields = extractInvoiceFields('Grand Total: EUR 1.234,56');

  assert.equal(fields.totalAmount, 1234.56);
  assert.equal(fields.currency, 'EUR');
});
