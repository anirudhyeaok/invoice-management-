function normalize(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function similarity(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  if (left === right) return 1;
  if (!left || !right) return 0;
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = old;
    }
  }
  return 1 - row[right.length] / Math.max(left.length, right.length);
}

function numericDiscrepancy(field, expected, actual) {
  if (expected == null || actual == null || Number(expected) === 0) return null;
  const percentageDiff = Math.abs(Number(actual) - Number(expected)) / Math.abs(Number(expected)) * 100;
  if (percentageDiff < 0.01) return null;
  const severity = percentageDiff < 2 ? 'low' : percentageDiff < 5 ? 'medium' : percentageDiff < 15 ? 'high' : 'critical';
  return { field, poValue: expected, invoiceValue: actual, percentageDiff: Number(percentageDiff.toFixed(2)), severity };
}

export function compareInvoiceToPurchaseOrder(invoice, purchaseOrder) {
  const discrepancies = [];
  const total = numericDiscrepancy('totalAmount', purchaseOrder.totalAmount, invoice.totalAmount);
  if (total) discrepancies.push(total);
  (invoice.lineItems || []).forEach((item, index) => {
    const poItem = purchaseOrder.lineItems.find((candidate) => similarity(candidate.description, item.description) >= 0.8)
      || purchaseOrder.lineItems[index];
    if (!poItem) {
      discrepancies.push({ field: `lineItems[${index}].description`, poValue: null, invoiceValue: item.description, percentageDiff: 100, severity: 'high' });
      return;
    }
    if (similarity(poItem.description, item.description) < 0.8) {
      discrepancies.push({ field: `lineItems[${index}].description`, poValue: poItem.description, invoiceValue: item.description, percentageDiff: 100, severity: 'high' });
    }
    const quantity = numericDiscrepancy(`lineItems[${index}].quantity`, poItem.quantity, item.quantity);
    if (quantity) discrepancies.push(quantity);
  });
  return { discrepancies, hasDiscrepancies: discrepancies.length > 0 };
}

export { similarity };
