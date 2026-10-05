import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import mongoose from 'mongoose';

function bucket() {
  if (mongoose.connection.readyState !== 1) throw new Error('Database is not connected');
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'invoiceFiles' });
}

export async function saveInvoiceFile(filePath, filename, contentType) {
  const upload = bucket().openUploadStream(filename, { contentType, metadata: { purpose: 'accounts-payable-invoice' } });
  await pipeline(fs.createReadStream(filePath), upload);
  return String(upload.id);
}

export async function removeInvoiceFile(fileId) {
  if (!mongoose.Types.ObjectId.isValid(fileId)) return;
  await bucket().delete(new mongoose.Types.ObjectId(fileId)).catch(() => {});
}

export async function streamStoredInvoiceFile(fileId, res, next) {
  try {
    const id = new mongoose.Types.ObjectId(fileId);
    const [record] = await bucket().find({ _id: id }).limit(1).toArray();
    if (!record) return res.status(404).json({ success: false, message: 'Invoice file not found' });
    res.type(record.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(record.filename || 'invoice')}"`);
    const stream = bucket().openDownloadStream(id);
    stream.on('error', next);
    stream.pipe(res);
  } catch (error) { next(error); }
}
