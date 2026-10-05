import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import User from './models/User.model.js';
import Vendor from './models/Vendor.model.js';
import PurchaseOrder from './models/PurchaseOrder.model.js';
import Invoice from './models/Invoice.model.js';
import AuditLog from './models/AuditLog.model.js';

const demoUsers = [
  { name: 'Anirudh Admin', email: 'admin@apSystem.com', password: 'Admin@123', role: 'admin' },
  { name: 'Maya Manager', email: 'manager@apSystem.com', password: 'Manager@123', role: 'manager' },
  { name: 'Arun Clerk', email: 'clerk@apSystem.com', password: 'Clerk@123', role: 'clerk' },
];

const vendorNames = [
  'Tata Consultancy Services', 'Infosys Ltd', 'Wipro Technologies', 'HCL Technologies',
  'Tech Mahindra', 'LTIMindtree', 'Mphasis Ltd', 'Hexaware Technologies',
  'Persistent Systems', 'Zensar Technologies',
];
const statuses = [
  ...Array(25).fill('approved'), ...Array(10).fill('pending_approval'),
  ...Array(8).fill('pending_review'), ...Array(5).fill('rejected'), ...Array(2).fill('on_hold'),
];
const roundMoney = (value) => Math.round(value * 100) / 100;

try {
  await connectDB();
  // Convert the old synthetic payment demo rows to approved, unpaid invoices.
  // Only the identifiable seed records with the old fake provider IDs are touched.
  const oldPaymentSeeds = await Invoice.find({
    invoiceNumber: /^INV-2026-/,
    $or: [
      { razorpayPaymentId: /^SIMULATED_PAY_SEED_/ },
      { razorpayOrderId: /^order_demo_/ },
    ],
  }).select('_id invoiceNumber');
  for (const sample of oldPaymentSeeds) {
    await Invoice.updateOne({ _id: sample._id }, { $set: { status: 'approved', paymentStatus: 'unpaid' }, $unset: { razorpayOrderId: 1, razorpayPaymentId: 1, paymentInitiatedAt: 1, paidAt: 1, paymentAttempts: 1 } });
    await AuditLog.deleteMany({ entityType: 'Invoice', entityId: sample._id, action: { $in: ['PAYMENT_CONFIRMED', 'PAYMENT_INITIATED'] } });
  }
  const users = {};
  for (const record of demoUsers) {
    let user = await User.findOne({ email: record.email });
    if (!user) user = await User.create(record);
    users[record.role] = user;
  }

  const vendors = [];
  for (let index = 0; index < vendorNames.length; index += 1) {
    const companyName = vendorNames[index];
    let vendor = await Vendor.findOne({ companyName });
    if (!vendor) {
      vendor = await Vendor.create({
        companyName,
        contactName: ['Priya Shah', 'Rahul Nair', 'Asha Menon', 'Kiran Rao', 'Neha Iyer'][index % 5],
        email: `accounts${index + 1}@vendor.example`,
        phone: `+91 90000 000${String(index + 1).padStart(2, '0')}`,
        gstin: `33ABCDE1234F1Z${index + 1}`,
        panNumber: 'ABCDE1234F',
        bankDetails: { accountNumber: `DEMO-ACCOUNT-${String(index + 1).padStart(3, '0')}`, ifscCode: 'DEMO0000001', bankName: 'Demo Bank' },
        address: { street: `${index + 10} Business Park`, city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
        status: index === 9 ? 'inactive' : 'active',
        paymentTerms: [15, 30, 45][index % 3],
        notes: 'Synthetic project demo record. Contact details are not real.',
      });
    }
    vendors.push(vendor);
  }

  const purchaseOrders = [];
  for (let index = 0; index < 15; index += 1) {
    const poNumber = `PO-2026-${String(index + 1).padStart(4, '0')}`;
    let purchaseOrder = await PurchaseOrder.findOne({ poNumber });
    if (!purchaseOrder) {
      const vendor = vendors[index % vendors.length];
      purchaseOrder = await PurchaseOrder.create({
        poNumber, vendor: vendor._id, issuedBy: users.manager._id,
        lineItems: [{ description: ['Cloud software licenses', 'Technical consulting services', 'Computer equipment'][index % 3], quantity: 4 + (index % 6), unitPrice: 12000 + (index * 1750) }],
        taxRate: 18,
        status: ['open', 'partially_matched', 'fully_matched'][index % 3],
        expectedDelivery: new Date(Date.now() + (index - 7) * 86400000),
        notes: 'Synthetic purchase order for course-project demonstration.',
      });
    }
    purchaseOrders.push(purchaseOrder);
  }

  for (let index = 0; index < statuses.length; index += 1) {
    const invoiceNumber = `INV-2026-${String(index + 1).padStart(4, '0')}`;
    if (await Invoice.exists({ invoiceNumber })) continue;
    const status = statuses[index];
    const purchaseOrder = purchaseOrders[index % purchaseOrders.length];
    const vendor = vendors.find((item) => item._id.equals(purchaseOrder.vendor));
    const invoiceDate = new Date(Date.now() - ((index * 7) % 90) * 86400000);
    const dueDate = new Date(invoiceDate.getTime() + vendor.paymentTerms * 86400000);
    if (index % 6 === 0 && status === 'approved') dueDate.setTime(Date.now() - 5 * 86400000);
    const isMismatch = status === 'pending_review';
    const poLine = purchaseOrder.lineItems[0];
    const totalAmount = roundMoney(purchaseOrder.totalAmount * (isMismatch ? 1.18 : 1));
    const invoice = await Invoice.create({
      invoiceNumber, vendor: vendor._id, purchaseOrder: purchaseOrder._id,
      lineItems: [{ description: poLine.description, quantity: poLine.quantity + (isMismatch ? 1 : 0), unitPrice: poLine.unitPrice, totalPrice: poLine.totalPrice }],
      subtotal: roundMoney(totalAmount / 1.18), taxAmount: roundMoney(totalAmount - totalAmount / 1.18), totalAmount,
      currency: 'INR', invoiceDate, dueDate, status,
      ocrRawText: `DEMO INVOICE\n${vendor.companyName}\nInvoice Number: ${invoiceNumber}\nDate: ${invoiceDate.toLocaleDateString('en-GB')}\nTotal Amount: INR ${totalAmount.toLocaleString('en-IN')}`,
      ocrExtractedData: { rawVendorName: vendor.companyName, rawInvoiceNumber: invoiceNumber, rawDate: invoiceDate.toLocaleDateString('en-GB'), rawTotal: String(totalAmount), rawLineItems: [] },
      discrepancies: isMismatch ? [{ field: 'totalAmount', poValue: purchaseOrder.totalAmount, invoiceValue: totalAmount, percentageDiff: 18, severity: 'critical' }] : [],
      hasDiscrepancies: isMismatch,
      exceptionNotes: isMismatch ? '' : undefined,
      uploadedBy: users.clerk._id,
      ...(status === 'approved' ? { approvedBy: users.manager._id, approvedAt: new Date(invoiceDate.getTime() + 86400000) } : {}),
      ...(status === 'rejected' ? { rejectedBy: users.manager._id, rejectedAt: new Date(), rejectionReason: 'Demo rejection: supporting details require correction.' } : {}),
      isOverdue: status === 'approved' && dueDate < new Date(),
    });
    await AuditLog.create({
      entityType: 'Invoice', entityId: invoice._id, action: 'INVOICE_UPLOADED', performedBy: users.clerk._id,
      description: `Demo invoice ${invoiceNumber} uploaded`, metadata: { status, seedData: true },
    });
    const actionByStatus = {
      approved: 'APPROVED', rejected: 'REJECTED',
      pending_review: 'EXCEPTION_FLAGGED', on_hold: 'ON_HOLD',
    }[status];
    if (actionByStatus) await AuditLog.create({
      entityType: 'Invoice', entityId: invoice._id, action: actionByStatus,
      performedBy: status === 'pending_review' || status === 'on_hold' ? users.clerk._id : users.manager._id,
      description: `Demo invoice ${invoiceNumber} is ${status.replaceAll('_', ' ')}`,
      metadata: { status, seedData: true },
    });
  }

  console.log(`Seed ready: ${demoUsers.length} roles, ${vendors.length} vendors, ${purchaseOrders.length} purchase orders, ${statuses.length} invoices.`);
  console.log('Demo login accounts: admin@apSystem.com / Admin@123; manager@apSystem.com / Manager@123; clerk@apSystem.com / Clerk@123');
} catch (error) {
  console.error(`Seeding failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
