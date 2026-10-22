import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCircle2, CreditCard, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from '../components/ToastProvider';

const money = (amount, currency = 'INR') => {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount || 0); }
  catch { return `${currency} ${Number(amount || 0).toLocaleString('en-IN')}`; }
};

export default function PaymentPage() {
  const cache = useQueryClient();
  const notify = useToast();
  const [activeId, setActiveId] = useState('');
  const [error, setError] = useState('');
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: async () => (await api.get('/invoices?limit=100')).data.data.invoices });
  const records = (invoices.data || []).filter((invoice) => invoice.status === 'approved' || invoice.paymentStatus === 'paid' || invoice.status === 'paid');

  async function recordPayment(invoice) {
    const amount = money(invoice.totalAmount, invoice.currency);
    if (!window.confirm(`Are you sure you want to record payment of ${amount} for invoice ${invoice.invoiceNumber}?`)) return;
    setError('');
    setActiveId(invoice._id);
    try {
      await api.post(`/payments/${invoice._id}/record`);
      notify('Payment recorded!');
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['invoices'] }),
        cache.invalidateQueries({ queryKey: ['invoice', invoice._id] }),
        cache.invalidateQueries({ queryKey: ['invoice-history', invoice._id] }),
      ]);
    } catch (paymentError) {
      setError(paymentError.response?.data?.message || 'Could not record payment. Refresh the page and try again.');
    } finally {
      setActiveId('');
    }
  }

  return <section className="module-page">
    <div className="page-heading"><div><span className="welcome-tag">INVOICE SETTLEMENT</span><h1>Payments</h1><p>Record payments for manager-approved invoices.</p></div></div>
    {error && <div className="gateway-error" role="alert">{error}</div>}
    <div className="table-toolbar"><span>{invoices.isLoading ? 'Loading invoices…' : `${records.length} approved or paid invoices`}</span></div>
    {invoices.isLoading ? <div className="table-message">Loading invoices…</div> : invoices.isError ? <div className="table-message error-text">Payment records could not be loaded. Check the API and database connection.</div> : !records.length ? <div className="table-message"><FileText size={22} /><b>No invoices are ready for payment</b><span>Once a manager approves an invoice, it will appear here.</span></div> : <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Vendor</th><th>Due date</th><th>Amount</th><th>Payment</th><th>Action</th></tr></thead><tbody>{records.map((invoice) => {
      const paid = invoice.paymentStatus === 'paid' || invoice.status === 'paid';
      return <tr key={invoice._id}><td><Link className="table-primary" to={`/invoices/${invoice._id}`}>{invoice.invoiceNumber}</Link><small className="table-sub">{invoice.status.replaceAll('_', ' ')}</small></td><td>{invoice.vendor?.companyName || '—'}</td><td>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : '—'}</td><td className="amount-cell">{money(invoice.totalAmount, invoice.currency)}</td><td><span className={`payment-state ${paid ? 'payment-paid' : 'payment-unpaid'}`}>{paid ? 'Paid' : 'Ready to record'}</span></td><td>{paid ? <span className="paid-confirmation"><CheckCircle2 size={14} /> Recorded</span> : <button className="primary-link pay-button" disabled={activeId === invoice._id} onClick={() => recordPayment(invoice)}>{activeId === invoice._id ? 'Recording…' : <><CreditCard size={14} /> Record payment</>}</button>}</td></tr>;
    })}</tbody></table></div>}
    <Link className="report-back-link" to="/invoices">View the full invoice register</Link>
  </section>;
}
