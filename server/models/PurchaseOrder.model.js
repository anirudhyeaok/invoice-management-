import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, default: 0 },
}, { _id: false });

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, required: true, unique: true },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lineItems: [lineItemSchema],
  subtotal: { type: Number, default: 0 },
  taxRate: { type: Number, default: 18 },
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['open', 'partially_matched', 'fully_matched', 'closed'], default: 'open' },
  expectedDelivery: Date,
  notes: String,
}, { timestamps: true });

purchaseOrderSchema.pre('save', function calculateTotals() {
  this.subtotal = this.lineItems.reduce((sum, item) => {
    item.totalPrice = item.quantity * item.unitPrice;
    return sum + item.totalPrice;
  }, 0);
  this.taxAmount = this.subtotal * this.taxRate / 100;
  this.totalAmount = this.subtotal + this.taxAmount;
});
purchaseOrderSchema.index({ vendor: 1, status: 1 });
export default mongoose.model('PurchaseOrder', purchaseOrderSchema);
