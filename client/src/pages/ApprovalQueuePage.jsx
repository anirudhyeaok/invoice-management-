import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck } from 'lucide-react';
import api from '../lib/api';

const money = (n, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(n || 0);
export default function ApprovalQueuePage() {
  const { data = [], isLoading, error } = useQuery({ queryKey: ['approval-queue'], queryFn: async () => (await api.get('/invoices/approvals/queue')).data.data.invoices });
  return <section className="module-page"><div className="page-heading"><div><span className="welcome-tag">MANAGER WORKSPACE</span><h1>Approval queue</h1><p>Review invoice details and the source document before deciding.</p></div><span className="queue-count"><ClipboardCheck size={16} /> {data.length} waiting</span></div>
    {isLoading ? <div className="table-message">Loading approval queue…</div> : error ? <div className="table-message error-text">Could not load the queue.</div> : !data.length ? <div className="table-message"><CheckCircle2 size={22} /><b>Queue is clear</b><span>New invoices submitted for approval will appear here.</span></div> :
      <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Vendor</th><th>Submitted by</th><th>Amount</th><th>Review</th></tr></thead><tbody>{data.map((invoice) => <tr key={invoice._id}><td><Link className="table-primary" to={`/invoices/${invoice._id}`}>{invoice.invoiceNumber}</Link><small className="table-sub">{new Date(invoice.createdAt).toLocaleDateString('en-IN')}</small></td><td>{invoice.vendor?.companyName || '—'}</td><td>{invoice.uploadedBy?.name || '—'}</td><td className="amount-cell">{money(invoice.totalAmount, invoice.currency)}</td><td><Link className="secondary-button" to={`/invoices/${invoice._id}`}>Review invoice</Link></td></tr>)}</tbody></table></div>}
  </section>;
}
