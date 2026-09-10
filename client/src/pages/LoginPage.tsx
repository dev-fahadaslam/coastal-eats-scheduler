import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import type { Role, User } from '../api/types.js';

const ROLE_LABELS: Record<Role, string> = { admin: 'Admin', manager: 'Manager', staff: 'Staff' };

export default function LoginPage() {
  const { login } = useAuth();
  const [accounts, setAccounts] = useState<User[]>([]);
  const [role, setRole] = useState<Role>('admin');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    api.get<User[]>('/auth/accounts').then(setAccounts).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) return accounts.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    return accounts.filter(u => u.role === role);
  }, [accounts, role, search]);

  const selected = accounts.find(u => u.id === selectedId) ?? null;

  async function handleSignIn() {
    if (!selectedId) return;
    setLeaving(true);
    setTimeout(() => { void login(selectedId); }, 260);
  }

  return (
    <div className={`login-screen ${leaving ? 'leaving' : ''}`}>
      <div className="login-visual">
        <span className="blob b1" /><span className="blob b2" /><span className="blob b3" />
        <div className="login-visual-content">
          <div className="brand"><span className="brand-mark">S</span><span>ShiftSync</span></div>
          <p className="org">COASTAL EATS · OPERATIONS</p>
          <h2>Run every location from one place.</h2>
          <ul className="visual-points">
            <li>4 locations across 2 time zones</li>
            <li>Real-time coverage, swaps &amp; approvals</li>
            <li>Built-in overtime &amp; fairness guardrails</li>
          </ul>
        </div>
      </div>
      <div className="login-panel">
        <div className="login-card">
          <h1>Sign in to continue</h1>
          <p className="sub">Pick a demo account to continue — this prototype represents authentication in the UI only.</p>
          <div className="role-tabs" role="tablist">
            {(Object.keys(ROLE_LABELS) as Role[]).map(r => (
              <button key={r} type="button" className={r === role && !search ? 'active' : ''}
                onClick={() => { setRole(r); setSearch(''); }}>
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          <div className="account-picker">
            <input
              type="text" placeholder="Search by name or email" value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="account-list">
              {filtered.length === 0 ? <p className="empty">No matching accounts.</p> : filtered.map(u => (
                <button
                  key={u.id} type="button"
                  className={`account-row ${u.id === selectedId ? 'selected' : ''}`}
                  onClick={() => setSelectedId(u.id)}
                >
                  <span className="avatar">{u.initials}</span>
                  <span><strong>{u.name}</strong><small>{u.email}</small></span>
                  {u.id === selectedId ? <span className="check">✓</span> : null}
                </button>
              ))}
            </div>
          </div>
          <button type="button" id="signin-btn" className="primary" disabled={!selected} onClick={handleSignIn}>
            {selected ? `Sign in as ${selected.name}` : 'Select an account'}
          </button>
        </div>
      </div>
    </div>
  );
}
