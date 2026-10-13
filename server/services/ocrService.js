import fs from 'node:fs/promises';
import path from 'node:path';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import ApiError from '../utils/ApiError.js';

function parseDate(value = '') {
  const months = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
    nov: 11, november: 11, dec: 12, december: 12,
  };
  const monthFirst = value.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  const dayFirst = value.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (monthFirst || dayFirst) {
    const year = Number((monthFirst || dayFirst)[3]);
    const month = months[(monthFirst ? monthFirst[1] : dayFirst[2]).toLowerCase()];
    const day = Number(monthFirst ? monthFirst[2] : dayFirst[1]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (month && parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day) {
      return parsed.toISOString().slice(0, 10);
    }
    return '';
  }
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

function parseAmount(value) {
  const token = String(value || '').replace(/[\s'’]/g, '');
  if (!token) return 0;
  let normalized = token;
  const comma = normalized.lastIndexOf(',');
  const dot = normalized.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else if (comma >= 0) {
    normalized = /,\d{1,2}$/.test(normalized) && !/^\d{1,3}(?:,\d{3})+$/.test(normalized)
      ? normalized.replace(',', '.')
      : normalized.replace(/,/g, '');
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '');
  }
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function findInvoiceTotal(text) {
  const labelPattern = /^\s*(grand\s+total|total\s+amount\s+due|total\s+due|balance\s+due|amount\s+due|invoice\s+total|total\s+amount|total)\b/i;
  const priorities = {
    'grand total': 7, 'total amount due': 7, 'total due': 7,
    'balance due': 7, 'amount due': 7, 'invoice total': 6,
    'total amount': 5, total: 4,
  };
  const lines = text.split(/\r?\n/);
  const candidates = [];
  for (let index = 0; index < lines.length; index += 1) {
    const label = lines[index].match(labelPattern);
    if (!label) continue;
    const rank = priorities[label[1].toLowerCase().replace(/\s+/g, ' ')] || 0;
    const parseLine = (line) => {
      const remainder = line.slice(label[0].length);
      return remainder.match(/[^\d\r\n]{0,20}(\d[\d,. ]*\d|\d)/)?.[1]?.trim() || '';
    };
    let rawAmount = parseLine(lines[index]);
    if (!rawAmount) {
      for (let next = index + 1; next < Math.min(lines.length, index + 3); next += 1) {
        if (!lines[next].trim()) continue;
        if (labelPattern.test(lines[next]) || /^\s*sub\s*total\b/i.test(lines[next])) break;
        rawAmount = lines[next].match(/[^\d\r\n]{0,20}(\d[\d,. ]*\d|\d)/)?.[1]?.trim() || '';
        break;
      }
    }
    const amount = parseAmount(rawAmount);
    if (rawAmount && amount > 0) candidates.push({ rawAmount, amount, rank, index });
  }
  candidates.sort((left, right) => right.rank - left.rank || right.index - left.index);
  return candidates[0] || { rawAmount: '', amount: 0 };
}

function detectCurrency(text) {
  if (/\bINR\b|₹|\bRs\.?\s*\d/i.test(text)) return 'INR';
  if (/\bJPY\b|\bJapan(?:ese)?\b|\bYen\b/i.test(text)) return 'JPY';
  if (/\bCNY\b|\bRMB\b|\bYuan\b|CN¥/i.test(text)) return 'CNY';
  if (/\bAUD\b|\bANZ\b|\bAustralia\b|\bMelbourne\b|\bVIC\b/i.test(text)) return 'AUD';
  if (/\bCAD\b|\bCanada\b/i.test(text)) return 'CAD';
  if (/\bEUR\b|€/i.test(text)) return 'EUR';
  if (/\bUSD\b|US\s*\$|\$/.test(text)) return 'USD';
  // OCR often confuses ₹ with ¥. For this project, treat an ambiguous glyph as INR.
  // Explicit JPY/CNY markers above still take precedence.
  return 'INR';
}

export function extractInvoiceFields(text) {
  const invoiceNumber = text.match(/(?:invoice\s*(?:no\.?|number|#)\s*[:\-]?\s*)([\w/-]+)/i)?.[1] || '';
  const datePattern = '(\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|[A-Za-z]{3,9}\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\s+[A-Za-z]{3,9}\\s+\\d{4})';
  const invoiceDateText = text.match(new RegExp(`invoice\\s+date\\s*[:#-]?\\s*${datePattern}`, 'i'))?.[1]
    || text.match(new RegExp('(?<!due )\\bdate\\s*[:#-]?\\s*' + datePattern, 'i'))?.[1] || '';
  const dueDateText = text.match(new RegExp(`due\\s+date\\s*[:#-]?\\s*${datePattern}`, 'i'))?.[1] || '';
  const { rawAmount: total, amount: totalAmount } = findInvoiceTotal(text);
  const fromMatch = text.match(/\bfrom\s*:\s*(?:\r?\n\s*)?([^\r\n]+)/i);
  const vendor = fromMatch?.[1]?.trim() || text.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 2) || '';
  const currency = detectCurrency(text);
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
    totalAmount,
  };
}

async function pdfFirstPagePng(filePath) {
  const data = new Uint8Array(await fs.readFile(filePath));
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;
  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.8 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas.toBuffer('image/png');
  } finally {
    await pdf.destroy();
  }
}

export async function extractInvoiceData(filePath, mimeType) {
  let rawText = '';
  if (mimeType === 'application/pdf') {
    // pdf-parse can fail on otherwise usable PDFs. In that case, render the page
    // and use OCR instead of incorrectly telling the user the PDF is encrypted.
    try {
      const parsed = await pdfParse(await fs.readFile(filePath));
      rawText = parsed.text.trim();
    } catch { rawText = ''; }
    if (rawText.length < 40) {
      let image;
      try {
        image = await pdfFirstPagePng(filePath);
      } catch {
        throw new ApiError(422, 'The PDF could not be read as text or opened for OCR. Check that it is a valid, unprotected invoice PDF and try again.');
      }
      let worker;
      try {
        worker = await createWorker('eng');
        const result = await worker.recognize(image);
        rawText = result.data.text;
      } catch {
        throw new ApiError(422, 'Text could not be recognized in this PDF. Try a clearer or unprotected copy.');
      } finally {
        if (worker) await worker.terminate();
      }
    }
  } else {
    let image;
    try {
      image = await sharp(path.resolve(filePath)).rotate().resize({ width: 2400, withoutEnlargement: true }).png().toBuffer();
    } catch {
      throw new ApiError(422, 'This image could not be read. Check that it is a valid JPG or PNG invoice and try again.');
    }
    const worker = await createWorker('eng');
    try {
      const result = await worker.recognize(image);
      rawText = result.data.text;
    } finally { await worker.terminate(); }
  }
  return { extractedData: extractInvoiceFields(rawText), rawText };
}
