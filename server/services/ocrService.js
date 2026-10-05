import fs from 'node:fs/promises';
import path from 'node:path';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

function parseDate(value = '') {
  const named = new Date(value);
  if (/[a-z]/i.test(value) && !Number.isNaN(named.getTime())) return named.toISOString().slice(0, 10);
  const parts = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!parts) return '';
  let [, first, second, year] = parts;
  let day = Number(first); let month = Number(second);
  if (day <= 12 && month > 12) [day, month] = [month, day];
  if (year.length === 2) year = `${Number(year) > 50 ? '19' : '20'}${year}`;
  const parsed = new Date(Number(year), month - 1, day);
  if (parsed.getFullYear() !== Number(year) || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function extractFields(text) {
  const invoiceNumber = text.match(/(?:invoice\s*(?:no\.?|number|#)\s*[:\-]?\s*)([\w/-]+)/i)?.[1] || '';
  const datePattern = '(\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|[A-Za-z]{3,9}\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\s+[A-Za-z]{3,9}\\s+\\d{4})';
  const invoiceDateText = text.match(new RegExp(`invoice\\s+date\\s*[:#-]?\\s*${datePattern}`, 'i'))?.[1]
    || text.match(new RegExp('(?<!due )\\bdate\\s*[:#-]?\\s*' + datePattern, 'i'))?.[1] || '';
  const dueDateText = text.match(new RegExp(`due\\s+date\\s*[:#-]?\\s*${datePattern}`, 'i'))?.[1] || '';
  const totalLabels = /(?<!sub )\b(?:grand\s+total|total\s+due|amount\s+due|balance\s+due|invoice\s+total|total(?:\s+amount)?)\s*[:#-]?\s*(?:[$₹]|\b(?:INR|USD|AUD|CAD|EUR)\b|Rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi;
  const candidates = [...text.matchAll(totalLabels)];
  const preferred = candidates.find((match) => /grand\s+total|total\s+due|amount\s+due|balance\s+due|invoice\s+total/i.test(match[0]));
  const total = (preferred || candidates.at(-1))?.[1] || '';
  const fromMatch = text.match(/\bfrom\s*:\s*(?:\r?\n\s*)?([^\r\n]+)/i);
  const vendor = fromMatch?.[1]?.trim() || text.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 2) || '';
  const currency = /\bAUD\b|\bANZ\b|\bAustralia\b|\bMelbourne\b|\bVIC\b/i.test(text) ? 'AUD'
    : /\bUSD\b|US\s*\$/i.test(text) ? 'USD'
      : /\bCAD\b/i.test(text) ? 'CAD'
        : /\bEUR\b|€/i.test(text) ? 'EUR'
          : /\$/.test(text) ? 'USD' : 'INR';
  return {
    rawVendorName: vendor,
    rawInvoiceNumber: invoiceNumber,
    rawDate: invoiceDateText,
    rawTotal: total,
    rawLineItems: [],
    invoiceNumber,
    invoiceDate: parseDate(invoiceDateText),
    dueDate: parseDate(dueDateText),
    currency,
    totalAmount: Number(total.replace(/,/g, '')) || 0,
  };
}

async function pdfFirstPagePng(filePath) {
  const data = new Uint8Array(await fs.readFile(filePath));
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.8 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  await pdf.destroy();
  return canvas.toBuffer('image/png');
}

export async function extractInvoiceData(filePath, mimeType) {
  let rawText = '';
  if (mimeType === 'application/pdf') {
    const parsed = await pdfParse(await fs.readFile(filePath));
    rawText = parsed.text.trim();
    if (rawText.length < 40) {
      const image = await pdfFirstPagePng(filePath);
      const worker = await createWorker('eng');
      try {
        const result = await worker.recognize(image);
        rawText = result.data.text;
      } finally { await worker.terminate(); }
    }
  } else {
    const image = await sharp(path.resolve(filePath)).rotate().resize({ width: 2400, withoutEnlargement: true }).png().toBuffer();
    const worker = await createWorker('eng');
    try {
      const result = await worker.recognize(image);
      rawText = result.data.text;
    } finally { await worker.terminate(); }
  }
  return { extractedData: extractFields(rawText), rawText };
}
