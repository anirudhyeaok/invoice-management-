import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AlertCircle, ArrowUpRight, CreditCard, ExternalLink, FileText, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from '../components/ToastProvider';

let checkoutScript;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve(true);
  if (!checkoutScript) checkoutScript = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => { checkoutScript = null; resolve(false); };
    document.head.appendChild(script);
  });
  return checkoutScript;
}

const money = (amount, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount || 0);
const paymentLabel = { unpaid: 'Ready to pay', processing: 'Checkout started', paid: 'Paid', failed: 'Try again' };

export default function PaymentPage() {
  const cache = useQueryClient();
  const notify = useToast();
  const [activeId, setActiveId] = useState('');
  const [error, setError] = useState('');
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: async () => (await api.get('/invoices?limit=100')).data.data.invoices });
  const gateway = useQuery({ queryKey: ['payment-gateway-config'], queryFn: async () => (await api.get('/payments/config')).data.data });
  const records = (invoices.data || []).filter((invoice) => invoice.status === 'approved' || ['paid', 'processing', 'failed'].includes(invoice.paymentStatus));

  async function payInvoice(invoice) {
    setError('');
    setActiveId(invoice._id);
    try {
      const { data } = await api.post(`/payments/${invoice._id}/order`);
      const checkout = data.data.checkout;
      if (!(await loadCheckout())) throw new Error('Secure checkout could not load. Check your internet connection and try again.');
      let verified = false;
      const modal = new window.Razorpay({
        key: checkout.keyId,
        order_id: checkout.orderId,
        amount: checkout.amount,
        currency: checkout.currency,
        name: 'Accounts Payable',
        description: `Invoice ${checkout.invoiceNumber} · ${checkout.vendorName}`,
        theme: { color: '#244c3d' },
        handler: async (response) => {
          try {
            await api.post(`/payments/${invoice._id}/verify`, response);
            verified = true;
            notify(`Payment for ${checkout.invoiceNumber} was verified.`);
            await Promise.all([cache.invalidateQueries({ queryKey: ['invoices'] }), cache.invalidateQueries({ queryKey: ['invoice', invoice._id] }), cache.invalidateQueries({ queryKey: ['invoice-history', invoice._id] })]);
          } catch (verificationError) {
            setError(verificationError.response?.data?.message || verificationError.message || 'The provider returned a payment, but it could not be verified. Ask an admin to check the payment record.');
            notify('Payment confirmation needs attention.', 'error');
          } finally { setActiveId(''); }
        },
        modal: { ondismiss: async () => {
          if (!verified) {
            await api.post(`/payments/${invoice._id}/failed`, { orderId: checkout.orderId, message: 'Checkout closed before payment confirmation' }).catch(() => {});
            await cache.invalidateQueries({ queryKey: ['invoices'] });
            setActiveId('');
          }
        } },
      });
      modal.open();
    } catch (payError) {
      setError(payError.response?.data?.message || payError.message || 'Could not start checkout.');
      setActiveId('');
    }
  }

  return <section className="module-page">
    <div className="page-heading"><div><span className="welcome-tag">INVOICE SETTLEMENT</span><h1>Payments</h1><p>Pay approved INR invoices through the secure payment provider checkout.</p></div><span className="secure-label payment-secure"><ShieldCheck size={15} /> PROVIDER VERIFIED</span></div>
    <div className="payment-notice"><CreditCard size={20} /><div><b>How payment works</b><span>The app creates a provider order from the approved invoice total. The clerk completes checkout, then the server verifies the provider signature and captured amount before marking the invoice paid.</span></div></div>
    {!gateway.isLoading && gateway.data && !gateway.data.ready && <div className="gateway-setup" role="status"><AlertCircle size={17} /><span><b>Payment checkout is not connected yet.</b> Add Razorpay test keys to <code>server/.env</code> to enable the checkout. The key secret stays on the server.</span></div>}
    {error && <div className="gateway-error" role="alert"><AlertCircle size={16} />{error}</div>}
    <div className="table-toolbar"><span>{invoices.isLoading ? 'Loading invoices…' : `${records.length} invoices need payment tracking`}</span></div>
    {invoices.isLoading ? <div className="table-message">Loading approved invoices…</div> : invoices.isError ? <div className="table-message error-text">Payment records could not be loaded. Check the API and database connection.</div> : !records.length ? <div className="table-message"><FileText size={22} /><b>No invoices are ready for payment</b><span>Once a manager approves an invoice, it will appear here.</span></div> : <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Vendor</th><th>Due date</th><th>Amount</th><th>Payment</th><th>Action</th></tr></thead><tbody>{records.map((invoice) => {
      const eligible = invoice.status === 'approved' && invoice.paymentStatus !== 'paid';
      const supported = invoice.currency === 'INR';
      return <tr key={invoice._id}><td><Link className="table-primary" to={`/invoices/${invoice._id}`}>{invoice.invoiceNumber}</Link><small className="table-sub">{invoice.status.replaceAll('_', ' ')}</small></td><td>{invoice.vendor?.companyName || '—'}</td><td>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : '—'}</td><td className="amount-cell">{money(invoice.totalAmount, invoice.currency)}</td><td><span className={`payment-state payment-${invoice.paymentStatus || 'unpaid'}`}>{paymentLabel[invoice.paymentStatus] || 'Ready to pay'}</span></td><td>{invoice.paymentStatus === 'paid' ? <span className="paid-confirmation"><ShieldCheck size={14} /> Confirmed</span> : eligible && supported ? <button className="primary-link pay-button" disabled={!gateway.data?.ready || activeId === invoice._id} onClick={() => payInvoice(invoice)}>{activeId === invoice._id ? 'Opening…' : <><CreditCard size={14} /> {invoice.paymentStatus === 'processing' ? 'Continue checkout' : 'Pay invoice'}</>}</button> : eligible ? <span className="unsupported-currency">INR checkout only</span> : <span className="muted">—</span>}</td></tr>;
    })}</tbody></table></div>}
    <p className="payment-footnote"><ExternalLink size={13} /> Card and bank details are entered only in the provider’s hosted checkout. This prototype uses test credentials; no live charges are configured.</p>
    <Link className="report-back-link" to="/invoices">View the full invoice register <ArrowUpRight size={14} /></Link>
  </section>;
}
