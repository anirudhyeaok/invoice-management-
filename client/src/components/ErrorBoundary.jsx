import { Component } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error) { console.error('Workspace page failed to render:', error); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return <main className="workspace-error"><div><AlertTriangle size={25} /><span className="welcome-tag">PAGE ERROR</span><h1>This page could not be displayed</h1><p>Reload the workspace. Your saved invoice records are not changed by this error.</p><button className="primary-link" onClick={() => window.location.reload()}><RotateCw size={15} /> Reload page</button></div></main>;
  }
}
