import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight, FileText, Plus, Store } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

const money = (value, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value || 0);
export default function DashboardPage() {
  const { user } = useAuth();
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: async () => (await api.get('/invoices?limit=100')).data.data.invoices });
  const vendors = useQuery({ queryKey: ['vendors'], queryFn: async () => (await api.get('/vendors')).data.data.vendors });
  const rows = invoices.data || [];
  const pending = rows.filter((row) => ['pending_review', 'pending_approval'].includes(row.status));
  const paidRows = rows.filter((row) => row.status === 'paid');
  const paidTotals = paidRows.reduce((totals, row) => ({ ...totals, [row.currency || 'INR']: (totals[row.currency || 'INR'] || 0) + row.totalAmount }), {});
  const paidSummary = Object.entries(paidTotals).map(([currency, amount]) => money(amount, currency)).join(' · ') || money(0);
  const cards = [
    { title: 'Invoices in register', value: invoices.isLoading ? '—' : rows.length, note: 'All recorded invoices', icon: FileText },
    { title: 'Need attention', value: invoices.isLoading ? '—' : pending.length, note: 'Review or approval needed', icon: ArrowUpRight },
    { title: 'Paid invoices', value: invoices.isLoading ? '—' : paidSummary, note: 'Totals grouped by currency', icon: Store },
  ];
  return <section className="module-page"><div className="page-heading"><div><span className="welcome-tag">YOUR WORKSPACE</span><h1>Good to have you, {user?.name?.split(' ')[0]}.</h1><p>A clear view of your accounts payable activity.</p></div><Link className="primary-link" to="/invoices/upload"><Plus size={16} /> Add invoice</Link></div><div className="kpi-grid">{cards.map(({ title, value, note, icon: Icon }) => <article className="kpi-card" key={title}><div className="kpi-top"><span>{title}</span><Icon size={17} /></div><b>{value}</b><small>{note}</small></article>)}</div><div className="dashboard-lower"><article className="detail-card recent-card"><div className="card-title-row"><div><h2>Recent invoices</h2><p>Your latest activity</p></div><Link to="/invoices">All invoices <ArrowUpRight size={14} /></Link></div>{invoices.isLoading ? <div className="table-message">Loading activity…</div> : !rows.length ? <div className="empty-inline"><FileText size={20} /><span>No invoices yet. Add your first invoice to begin.</span></div> : <div className="recent-list">{rows.slice(0, 5).map((invoice) => <Link className="recent-row" to={`/invoices/${invoice._id}`} key={invoice._id}><span className="recent-mark"><FileText size={16} /></span><span className="recent-info"><b>{invoice.invoiceNumber}</b><small>{invoice.vendor?.companyName || 'Vendor'} · {new Date(invoice.createdAt).toLocaleDateString('en-IN')}</small></span><span className="recent-amount">{money(invoice.totalAmount, invoice.currency)}</span></Link>)}</div>}</article><article className="detail-card directory-card"><span className="directory-icon"><Store size={18} /></span><h2>Vendor directory</h2><p>{vendors.isLoading ? 'Loading vendor records…' : `${vendors.data?.length || 0} vendors saved for invoice intake.`}</p><Link to="/vendors">Manage vendors <ArrowUpRight size={14} /></Link></article></div></section>;
}
