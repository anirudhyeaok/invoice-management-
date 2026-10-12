import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileUp, UploadCloud } from 'lucide-react';
import api from '../lib/api';

const currencies = ['INR', 'USD', 'AUD', 'CAD', 'EUR', 'JPY', 'CNY'];

export default function InvoiceUploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [vendorId, setVendorId] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [currency, setCurrency] = useState('auto');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const vendors = useQuery({
    queryKey: ['vendors', 'lookup', vendorSearch.trim()],
    queryFn: async () => (await api.get('/vendors', { params: { search: vendorSearch.trim(), status: 'active' } })).data.data.vendors,
    enabled: vendorSearch.trim().length >= 2 && !vendorId,
  });
  const createVendor = useMutation({
    mutationFn: async (companyName) => (await api.post('/vendors', { companyName })).data.data.vendor,
    onSuccess: async (vendor) => {
      await queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setVendorId(vendor._id);
      setVendorSearch(vendor.companyName);
      setPurchaseOrderId('');
      setShowVendorSuggestions(false);
    },
  });
  const purchaseOrders = useQuery({
    queryKey: ['purchase-orders', vendorId],
    queryFn: async () => (await api.get('/purchase-orders', { params: vendorId ? { vendorId } : {} })).data.data.purchaseOrders,
    enabled: Boolean(vendorId),
  });

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!file) return setError('Choose the invoice file first.');
    if (!vendorId) return setError('Choose a vendor from the suggestions or add it as a new vendor.');

    const form = new FormData();
    form.append('file', file);
    form.append('vendorId', vendorId);
    if (purchaseOrderId) form.append('purchaseOrderId', purchaseOrderId);
    if (invoiceNumber.trim()) form.append('invoiceNumber', invoiceNumber.trim());
    if (totalAmount) form.append('totalAmount', totalAmount);
    if (currency !== 'auto') form.append('currency', currency);

    setBusy(true);
    try {
      const { data } = await api.post('/invoices', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      navigate(`/invoices/${data.data.invoice._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed. Check the file and try again.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="module-page">
    <Link className="back-link" to="/invoices"><ArrowLeft size={15} /> Back to invoices</Link>
    <div className="page-heading compact-heading">
      <div>
        <span className="welcome-tag">INVOICE INTAKE</span>
        <h1>Add an invoice</h1>
        <p>Upload a PDF or image. The app reads the invoice and saves it for review.</p>
      </div>
    </div>

    <form className="upload-card" onSubmit={submit}>
      <div className="upload-step-title">
        <span className="step-number">1</span>
        <div><b>Choose invoice file</b><small>PDF, JPG or PNG · up to 10 MB locally, 4 MB on Vercel</small></div>
      </div>
      <label className={`drop-zone${file ? ' has-file' : ''}`}>
        <input type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        <span className="drop-icon">{file ? <FileUp size={22} /> : <UploadCloud size={22} />}</span>
        <b>{file ? file.name : 'Choose a file to upload'}</b>
        <small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Select from your device'}</small>
      </label>

      <div className="upload-step-title second-step">
        <span className="step-number">2</span>
        <div><b>Check invoice details</b><small>We’ll compare it to a purchase order if you select one.</small></div>
      </div>
      <div className="form-grid">
        <div className="field-label vendor-lookup-field">
          <label htmlFor="vendor-lookup">Vendor</label>
          <input id="vendor-lookup" autoComplete="off" value={vendorSearch} placeholder="Type a company name, e.g. Wipro" aria-autocomplete="list" aria-expanded={showVendorSuggestions && !vendorId} onFocus={() => setShowVendorSuggestions(true)} onBlur={() => setTimeout(() => setShowVendorSuggestions(false), 120)} onChange={(event) => { setVendorSearch(event.target.value); setVendorId(''); setPurchaseOrderId(''); setError(''); setShowVendorSuggestions(true); }} />
          {vendorId && <small className="vendor-selected-note">Vendor selected. Edit the name to search again.</small>}
          {showVendorSuggestions && !vendorId && vendorSearch.trim().length >= 2 && <div className="vendor-suggestions" role="listbox">
            {(vendors.data || []).map((vendor) => <button type="button" role="option" key={vendor._id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setVendorId(vendor._id); setVendorSearch(vendor.companyName); setPurchaseOrderId(''); setShowVendorSuggestions(false); }}><b>{vendor.companyName}</b>{vendor.contactName && <small>{vendor.contactName}</small>}</button>)}
            {!vendors.isLoading && !(vendors.data || []).some((vendor) => vendor.companyName.toLowerCase() === vendorSearch.trim().toLowerCase()) && <button type="button" className="vendor-create-option" disabled={createVendor.isPending} onMouseDown={(event) => event.preventDefault()} onClick={() => createVendor.mutate(vendorSearch.trim())}><b>+ Add “{vendorSearch.trim()}” as a new vendor</b><small>{createVendor.isPending ? 'Saving vendor…' : 'You can add contact details later'}</small></button>}
            {vendors.isLoading && <p>Searching vendors…</p>}
            {vendors.isError && <p className="inline-error">Could not search existing vendors.</p>}
          </div>}
          {createVendor.isError && <small className="inline-error">{createVendor.error.response?.data?.message || 'Could not add this vendor.'}</small>}
        </div>
        <label className="field-label">Invoice number
          <input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Auto-detect from file" />
        </label>
        <label className="field-label">Purchase order
          <select value={purchaseOrderId} onChange={(event) => setPurchaseOrderId(event.target.value)} disabled={!vendorId || purchaseOrders.isLoading}>
            <option value="">No purchase order</option>
            {(purchaseOrders.data || []).map((po) => <option key={po._id} value={po._id}>{po.poNumber} · {po.vendor?.companyName}</option>)}
          </select>
        </label>
        <label className="field-label">Total amount due
          <input type="number" min="0.01" step="0.01" value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} placeholder="Auto-detect from file" />
        </label>
        <label className="field-label">Currency
          <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
            <option value="auto">Detect from invoice</option>
            {currencies.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
      </div>
      <p className="inline-hint">The app looks for the final amount due, not the subtotal. If the currency symbol is unclear, choose the currency printed on the invoice.</p>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="upload-actions">
        <span>Extracted details can be corrected on the invoice review page.</span>
        <button className="primary-link" disabled={busy || !vendorId}>
          {busy ? <><span className="spinner spinner-dark" /> Reading invoice…</> : <><UploadCloud size={16} /> Upload & extract</>}
        </button>
      </div>
    </form>
  </section>;
}
