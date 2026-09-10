import { useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { getToken } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useApiData } from '../hooks/useApiData.js';
import { useRealtimeRefetch } from '../hooks/useRealtimeRefetch.js';
import type { AuditEntry, Location } from '../api/types.js';

export default function AuditPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: locations } = useApiData(() => api.get<Location[]>('/locations'), []);
  const [locationFilter, setLocationFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (locationFilter) params.set('locationIds', locationFilter);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString();
  }, [locationFilter, from, to]);

  const { data: entries, reload } = useApiData(() => api.get<AuditEntry[]>(`/audit${query ? `?${query}` : ''}`), [query]);
  useRealtimeRefetch(reload);
  const locationsById = useMemo(() => new Map((locations ?? []).map(l => [l.id, l])), [locations]);

  async function exportCsv() {
    const res = await fetch(`/api/audit/export.csv${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coastal-eats-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <section className="locations">
        <p>FILTER</p>
        <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
          <option value="">All visible locations</option>
          {(locations ?? []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        {isAdmin && <button className="ghost" style={{ marginLeft: 'auto' }} onClick={exportCsv}>⬇ Export CSV</button>}
      </section>
      <div className="table audit-table">
        <div className="thead"><span>WHEN</span><span>WHO</span><span>ACTION</span><span>DETAILS</span></div>
        {(!entries || entries.length === 0) && <p className="empty">No matching audit events.</p>}
        {entries?.map(entry => (
          <div className="row" key={entry.id}>
            <div>{new Date(entry.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
            <div>{entry.actorName}</div>
            <div><span className="badge">{entry.action}</span> {entry.locationId ? <small>{locationsById.get(entry.locationId)?.name ?? ''}</small> : null}</div>
            <div>{entry.summary}</div>
          </div>
        ))}
      </div>
    </>
  );
}
