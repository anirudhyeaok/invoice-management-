import { useState } from 'react';
import { CalendarDays, Download, FileSpreadsheet } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../components/ToastProvider';

const statuses = [
  ['pending_review', 'Needs review'], ['pending_approval', 'Pending approval'], ['approved', 'Approved'],
  ['paid', 'Paid'], ['rejected', 'Rejected'], ['on_hold', 'On hold'],
];

async function errorMessage(blob) {
  try { return JSON.parse(await blob.text()).message || 'The report could not be downloaded.'; }
  catch { return 'The report could not be downloaded.'; }
}

export default function ReportsPage() {
  const notify = useToast();
  const [filters, setFilters] = useState({ status: '', startDate: '', endDate: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function downloadReport(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const response = await api.get('/reports/invoices.csv', { params, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notify('Invoice report downloaded.');
    } catch (downloadError) {
      const message = downloadError.response?.data instanceof Blob ? await errorMessage(downloadError.response.data) : downloadError.response?.data?.message || 'The report could not be downloaded.';
      setError(message);
      notify(message, 'error');
    } finally { setBusy(false); }
  }
  return <section className="module-page">
    <div className="page-heading"><div><span className="welcome-tag">REPORTING</span><h1>Invoice report</h1><p>Download one complete spreadsheet of invoice, approval, and payment details.</p></div></div>
    <form className="report-card" onSubmit={downloadReport}>
      <div className="report-card-heading"><span className="report-icon"><FileSpreadsheet size={20} /></span><div><h2>Export invoices to CSV</h2><p>Open the file in Excel or Google Sheets. Leave filters empty to include every invoice.</p></div></div>
      <div className="form-grid report-filters"><label className="field-label">Invoice status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field-label"><span><CalendarDays size={13} /> From invoice date</span><input type="date" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} /></label><label className="field-label"><span><CalendarDays size={13} /> To invoice date</span><input type="date" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} /></label></div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="report-columns"><b>Included in the file</b><span>Invoice and vendor details · invoice and due dates · amounts and currency · status · purchase order · exception/hold/rejection notes · approval details · payment references and dates · upload and update timestamps</span></div>
      <div className="upload-actions"><span>Only managers and admins can export the complete register.</span><button className="primary-link" disabled={busy}>{busy ? 'Preparing report…' : <><Download size={15} /> Download CSV</>}</button></div>
    </form>
  </section>;
}
