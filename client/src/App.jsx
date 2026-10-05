import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProtectedRoute from './routes/ProtectedRoute';
import WorkspaceLayout from './components/WorkspaceLayout';
import InvoiceListPage from './pages/InvoiceListPage';
import InvoiceUploadPage from './pages/InvoiceUploadPage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import VendorListPage from './pages/VendorListPage';
import UserManagementPage from './pages/UserManagementPage';
import ApprovalQueuePage from './pages/ApprovalQueuePage';
import PaymentPage from './pages/PaymentPage';
import ReportsPage from './pages/ReportsPage';
import ErrorBoundary from './components/ErrorBoundary';
import ToastProvider from './components/ToastProvider';
import './styles.css';
import './workspace.css';

function App() {
  return <ErrorBoundary><ToastProvider><AuthProvider><BrowserRouter><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}><Route element={<WorkspaceLayout />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/invoices" element={<InvoiceListPage />} />
      <Route path="/invoices/upload" element={<InvoiceUploadPage />} />
      <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
      <Route element={<ProtectedRoute allowedRoles={['manager', 'admin']} />}><Route path="/approvals" element={<ApprovalQueuePage />} /></Route>
      <Route path="/vendors" element={<VendorListPage />} />
      <Route element={<ProtectedRoute allowedRoles={['clerk', 'admin']} />}><Route path="/payments" element={<PaymentPage />} /></Route>
      <Route element={<ProtectedRoute allowedRoles={['manager', 'admin']} />}><Route path="/reports" element={<ReportsPage />} /></Route>
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}><Route path="/settings/users" element={<UserManagementPage />} /></Route>
    </Route></Route>
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes></BrowserRouter></AuthProvider></ToastProvider></ErrorBoundary>;
}
export default App;
