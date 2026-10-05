import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import ApiError from '../utils/ApiError.js';

// Resolve from this module so uploads work whether the server starts from the
// repository root (`npm run dev`) or from the server folder (`npm run dev`).
const uploadPath = process.env.VERCEL
  ? path.join(os.tmpdir(), 'ap-invoice-uploads')
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
fs.mkdirSync(uploadPath, { recursive: true });
const allowed = new Map([
  ['application/pdf', '.pdf'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadPath),
  filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${allowed.get(file.mimetype) || ''}`),
});

export const invoiceUpload = multer({
  storage,
  limits: { fileSize: (process.env.VERCEL ? 4 : 10) * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowed.has(file.mimetype)) return callback(new ApiError(400, 'Upload a PDF, JPG, or PNG invoice'));
    callback(null, true);
  },
});
