import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  entityType: { type: String, enum: ['Invoice', 'Vendor', 'User', 'PurchaseOrder'], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'entityType' },
  action: { type: String, required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isSystemAction: { type: Boolean, default: false },
  description: String,
  metadata: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });
 auditLogSchema.index({ entityId: 1, entityType: 1 });
 auditLogSchema.index({ performedBy: 1 });
 auditLogSchema.index({ createdAt: -1 });
 auditLogSchema.index({ action: 1 });
export default mongoose.model('AuditLog', auditLogSchema);
