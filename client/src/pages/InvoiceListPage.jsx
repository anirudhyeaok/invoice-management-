import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import api from '../lib/api';

const labels = { pending_review: 'Needs review', pending_approval: 'Pending approval', approved: 'Approved', paid: 'Paid', rejected: 'Rejected', on_hold: 'On hold' };
const money = (n, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n || 0);

export default function InvoiceListPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: ['invoices'], queryFn: async () => (await api.get('/invoices?limit=100')).data.data.invoices });
  return <section className="module-page"><div className="page-heading"><div><span className="welcome-tag">ACCOUNTS PAYABLE</span><h1>Invoices</h1><p>Track every invoice from intake through payment.</p></div><Link className="primary-link" to="/invoices/upload"><Plus size={16} /> Add invoice</Link></div><div className="table-toolbar"><span>{isLoading ? 'Loading invoices…' : `${data?.length || 0} invoices`}</span><div className="invoice-filters"><select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter invoices by status"><option value="">All statuses</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><label className="search-box"><Search size={15} /><input placeholder="Search invoice number" value={query} onChange={(e) => setQuery(e.target.value.toLowerCase())} /></label></div></div><InvoiceRows invoices={data || []} loading={isLoading} error={error} query={query} status={status} /></section>;
}

function InvoiceRows({ invoices, loading, error, query, status }) {
  const filtered = invoices.filter((invoice) => (!status || invoice.status === status) && (invoice.invoiceNumber.toLowerCase().includes(query) || invoice.vendor?.companyName?.toLowerCase().includes(query)));
  if (loading) return <div className="table-message">Loading your invoices…</div>;
  if (error) return <div className="table-message error-text">Invoices could not be loaded. Check that the API and database are running.</div>;
  if (!filtered.length) return <div className="table-message">No invoices yet. Add an invoice to start your register.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Vendor</th><th>Invoice date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{filtered.map((invoice) => <tr key={invoice._id}><td><Link className="table-primary" to={`/invoices/${invoice._id}`}>{invoice.invoiceNumber}</Link><small className="table-sub">Added {new Date(invoice.createdAt).toLocaleDateString('en-IN')}</small></td><td>{invoice.vendor?.companyName || '—'}</td><td>{invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('en-IN') : '—'}</td><td className="amount-cell">{money(invoice.totalAmount, invoice.currency)}</td><td><span className={`status-pill status-${invoice.status}`}>{labels[invoice.status] || invoice.status}</span></td></tr>)}</tbody></table></div>;
}
