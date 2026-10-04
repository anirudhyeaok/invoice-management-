import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileUp, UploadCloud } from 'lucide-react';
import api from '../lib/api';

export default function InvoiceUploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [vendorId, setVendorId] = useState('');
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const vendors = useQuery({ queryKey: ['vendors'], queryFn: async () => (await api.get('/vendors')).data.data.vendors });
  const purchaseOrders = useQuery({ queryKey: ['purchase-orders', vendorId], queryFn: async () => (await api.get('/purchase-orders', { params: vendorId ? { vendorId } : {} })).data.data.purchaseOrders, enabled: Boolean(vendorId) });

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!file) return setError('Choose the invoice file first.');
    const form = new FormData();
    form.append('file', file);
    form.append('vendorId', vendorId);
    if (purchaseOrderId) form.append('purchaseOrderId', purchaseOrderId);
    if (invoiceNumber) form.append('invoiceNumber', invoiceNumber);
    if (totalAmount) form.append('totalAmount', totalAmount);
    setBusy(true);
    try {
      const { data } = await api.post('/invoices', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      navigate(`/invoices/${data.data.invoice._id}`);
    } catch (err) { setError(err.response?.data?.message || 'Upload failed. Check the file and try again.'); }
    finally { setBusy(false); }
  }

  return <section className="module-page"><Link className="back-link" to="/invoices"><ArrowLeft size={15} /> Back to invoices</Link><div className="page-heading compact-heading"><div><span className="welcome-tag">INVOICE INTAKE</span><h1>Add an invoice</h1><p>Upload a PDF or image. The app extracts invoice details for review.</p></div></div><form className="upload-card" onSubmit={submit}><div className="upload-step-title"><span className="step-number">1</span><div><b>Choose invoice file</b><small>PDF, JPG or PNG · up to 10 MB</small></div></div><label className={`drop-zone${file ? ' has-file' : ''}`}><input type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} /><span className="drop-icon">{file ? <FileUp size={22} /> : <UploadCloud size={22} />}</span><b>{file ? file.name : 'Choose a file to upload'}</b><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Select from your device'}</small></label><div className="upload-step-title second-step"><span className="step-number">2</span><div><b>Link invoice details</b><small>We’ll compare it to the purchase order if you select one.</small></div></div><div className="form-grid"><label className="field-label">Vendor <select required value={vendorId} onChange={(e) => { setVendorId(e.target.value); setPurchaseOrderId(''); }}><option value="">Select a vendor</option>{(vendors.data || []).map((vendor) => <option key={vendor._id} value={vendor._id}>{vendor.companyName}</option>)}</select></label><label className="field-label">Invoice number <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Auto-detect from file" /></label><label className="field-label">Purchase order <select value={purchaseOrderId} onChange={(e) => setPurchaseOrderId(e.target.value)} disabled={!vendorId || purchaseOrders.isLoading}><option value="">No purchase order</option>{(purchaseOrders.data || []).map((po) => <option key={po._id} value={po._id}>{po.poNumber} · {po.vendor?.companyName}</option>)}</select></label><label className="field-label">Total amount <input type="number" min="0" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="Auto-detect from file" /></label></div>{vendors.isError && <p className="inline-error">Could not load vendors. Try again after the API is available.</p>}{!vendors.isLoading && !vendors.isError && !vendors.data?.length && <p className="inline-hint">Add a vendor before uploading an invoice.</p>}{error && <p className="inline-error" role="alert">{error}</p>}<div className="upload-actions"><span>OCR results will be saved with the invoice record.</span><button className="primary-link" disabled={busy || !vendors.data?.length}>{busy ? <><span className="spinner spinner-dark" /> Extracting…</> : <><UploadCloud size={16} /> Upload & extract</>}</button></div></form></section>;
}
