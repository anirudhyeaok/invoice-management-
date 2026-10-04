import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BarChart3, ClipboardCheck, FileCheck2, FileText, LayoutDashboard, LogOut, Store, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function WorkspaceLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const links = [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/invoices', label: 'Invoices', icon: FileText },
    ...(['manager', 'admin'].includes(user?.role) ? [{ to: '/approvals', label: 'Approval queue', icon: ClipboardCheck }] : []),
    { to: '/vendors', label: 'Vendors', icon: Store },
    ...(user?.role === 'admin' ? [{ to: '/settings/users', label: 'Team members', icon: Users }] : []),
  ];
  return <div className="workspace"><aside className="sidebar"><a className="brand sidebar-brand" href="/dashboard" aria-label="Accounts payable home"><span className="brand-icon"><FileCheck2 size={19} /></span></a><div className="workspace-caption">WORKSPACE</div><nav>{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}><Icon size={17} />{label}</NavLink>)}</nav><div className="sidebar-bottom"><span className="workspace-caption">SIGNED IN AS</span><div className="side-profile"><span className="avatar">{user?.name?.slice(0, 1).toUpperCase()}</span><span><b>{user?.name}</b><small>{user?.role}</small></span></div><button className="side-signout" onClick={async () => { await signOut(); navigate('/login'); }}><LogOut size={15} /> Sign out</button></div></aside><div className="workspace-main"><header className="workspace-top"><span>Accounts Payable</span><span className="secure-label"><BarChart3 size={14} /> FINANCE WORKSPACE</span></header><div className="workspace-page"><Outlet /></div></div></div>;
}
