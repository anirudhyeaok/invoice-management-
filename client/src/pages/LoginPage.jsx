import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, FileCheck2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [setupHint, setSetupHint] = useState(false);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  useEffect(() => {
    api.get('/auth/setup-status').then(({ data }) => setSetupHint(data.data.needsSetup))
      .catch(() => setServiceUnavailable(true));
  }, []);
  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try { await signIn({ email, password }); navigate('/dashboard', { replace: true }); }
    catch (err) {
      if (!err.response) {
        setServiceUnavailable(true);
        setError('The API cannot be reached. Check that the app and local database are running.');
      } else setError(err.response.data?.message || 'Could not sign in. Check the email and password.');
    } finally { setBusy(false); }
  }

  return <main className="login-shell">
    <section className="login-story">
      <Link className="brand" to="/login" aria-label="Accounts payable home"><span className="brand-icon"><FileCheck2 size={20} /></span></Link>
      <div className="story-copy">
        <div className="eyebrow"><span className="eyebrow-dot" /> FINANCE, IN SYNC</div>
        <h1>Every invoice.<br /><span>Right on track.</span></h1>
        <p>One calm, clear place to move invoices from arrival to approval to paid.</p>
        <div className="story-rule" />
        <div className="story-points"><div><span className="point-icon"><ShieldCheck size={17} /></span><span><b>Built around your workflow</b><small>Clear steps, fewer follow-ups</small></span></div><div><span className="point-icon"><LockKeyhole size={17} /></span><span><b>Your records stay protected</b><small>Role-aware access at every step</small></span></div></div>
      </div>
      <div className="story-footer"><span>ACCOUNTS PAYABLE PROTOTYPE</span><span>DEMO WORKSPACE</span></div>
      <div className="decor decor-one" /><div className="decor decor-two" />
    </section>
    <section className="login-panel">
      <div className="login-panel-top"><span>First time here? Ask your team administrator for an account.</span><span className="secure-label"><LockKeyhole size={13} /> SECURE SIGN IN</span></div>
      <div className="login-card-wrap">
        <div className="mobile-brand"><span className="brand-icon"><FileCheck2 size={19} /></span><b>Accounts payable</b></div>
        <div className="form-heading"><span className="welcome-tag">WELCOME BACK</span><h2>Sign in to your<br />workspace</h2><p>Use the account provided for your project role.</p></div>
        {serviceUnavailable && <div className="form-error service-error" role="status">Can’t reach the API. Run <code>npm run dev</code> and check that local MongoDB is available.</div>}
        {setupHint && !serviceUnavailable && <div className="form-error service-error" role="status">No project accounts are set up yet. Run <code>npm --prefix server run seed</code>, then use one of the demo roles.</div>}
        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="email">Work email</label>
          <div className="input-wrap"><Mail size={17} /><input id="email" type="email" autoComplete="username" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="password-label"><label htmlFor="password">Password</label><button type="button" className="text-link" onClick={() => setShowRecovery(!showRecovery)}>Forgot password?</button></div>
          <div className="input-wrap"><LockKeyhole size={17} /><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /><button type="button" className="icon-button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          {showRecovery && <div className="recovery-note" role="status">Password reset email is not configured in this course prototype. Use the demo credentials from the project walkthrough or ask the administrator for access.</div>}
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="submit-button" disabled={busy}>{busy ? <span className="spinner" /> : <>Sign in <ArrowRight size={17} /></>}</button>
        </form>
        <div className="form-assurance"><ShieldCheck size={15} /><span>Your session is encrypted and protected</span></div>
      </div>
      <div className="panel-footer"><span>Accounts are provided for the course demo.</span><span>PRIVACY&nbsp;&nbsp; · &nbsp;&nbsp;HELP</span></div>
    </section>
  </main>;
}
