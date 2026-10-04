import mongoose from 'mongoose';

const vendorSchema = new mongoose.Schema({
  companyName: { type: String, required: true, unique: true, trim: true },
  contactName: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: String,
  gstin: { type: String, unique: true, sparse: true, uppercase: true },
  panNumber: String,
  bankDetails: { accountNumber: String, ifscCode: String, bankName: String },
  address: { street: String, city: String, state: String, pincode: String },
  status: { type: String, enum: ['active', 'inactive', 'blacklisted'], default: 'active' },
  paymentTerms: { type: Number, default: 30 },
  notes: String,
}, { timestamps: true });
vendorSchema.index({ companyName: 'text' });
export default mongoose.model('Vendor', vendorSchema);
