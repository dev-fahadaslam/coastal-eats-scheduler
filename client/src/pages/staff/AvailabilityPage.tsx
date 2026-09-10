import { useState } from 'react';
import { api } from '../../api/client.js';
import { useApiData } from '../../hooks/useApiData.js';
import { useToast } from '../../context/ToastContext.js';
import { WEEKDAY_NAMES } from '../../lib/time.js';
import type { AvailabilityException, AvailabilityRule, Location } from '../../api/types.js';

interface AvailabilityResponse { rules: AvailabilityRule[]; exceptions: AvailabilityException[] }

export default function AvailabilityPage() {
  const showToast = useToast();
  const { data, reload } = useApiData(() => api.get<AvailabilityResponse>('/availability/me'), []);
  const { data: locations } = useApiData(() => api.get<Location[]>('/locations'), []);

  const [newRuleLocation, setNewRuleLocation] = useState('');
  const [newRuleDay, setNewRuleDay] = useState('0');
  const [newRuleStart, setNewRuleStart] = useState('09:00');
  const [newRuleEnd, setNewRuleEnd] = useState('17:00');

  const [newExLocation, setNewExLocation] = useState('');
  const [newExDate, setNewExDate] = useState('');
  const [newExType, setNewExType] = useState<'unavailable' | 'available'>('unavailable');

  const firstLocation = locations?.[0]?.id ?? '';

  async function save(rules: AvailabilityRule[], exceptions: AvailabilityException[]) {
    await api.put('/availability/me', {
      rules: rules.map(r => ({ locationId: r.locationId, dayOfWeek: r.dayOfWeek, startLocal: r.startLocal, endLocal: r.endLocal })),
      exceptions: exceptions.map(e => ({ locationId: e.locationId, date: e.date, type: e.type })),
    });
    showToast('Availability updated.', 'success');
    reload();
  }

  function removeRule(id: string) {
    void save((data?.rules ?? []).filter(r => r.id !== id), data?.exceptions ?? []);
  }
  function removeException(id: string) {
    void save(data?.rules ?? [], (data?.exceptions ?? []).filter(e => e.id !== id));
  }

  function addRule(e: React.FormEvent) {
    e.preventDefault();
    const locationId = newRuleLocation || firstLocation;
    if (!locationId) return;
    const fake: AvailabilityRule = { id: '', staffId: '', locationId, dayOfWeek: Number(newRuleDay), startLocal: newRuleStart, endLocal: newRuleEnd };
    void save([...(data?.rules ?? []), fake], data?.exceptions ?? []);
  }

  function addException(e: React.FormEvent) {
    e.preventDefault();
    const locationId = newExLocation || firstLocation;
    if (!locationId || !newExDate) return;
    const fake: AvailabilityException = { id: '', staffId: '', locationId, date: newExDate, type: newExType };
    void save(data?.rules ?? [], [...(data?.exceptions ?? []), fake]);
    setNewExDate('');
  }

  const locationsById = new Map((locations ?? []).map(l => [l.id, l]));

  return (
    <>
      <section className="section-title"><div><p className="eyebrow">MY AVAILABILITY</p><h2>Recurring hours, per location</h2></div></section>
      <p className="hint" style={{ margin: '-4px 0 18px' }}>
        A window only applies at the location you set it for — being available &ldquo;9am&ndash;5pm&rdquo; at one location never carries over to another location in a different time zone.
      </p>
      <div className="table">
        <div className="thead"><span>LOCATION</span><span>DAY</span><span>WINDOW</span><span /></div>
        {(data?.rules ?? []).length === 0 && <p className="empty">No recurring availability set.</p>}
        {data?.rules.map(r => (
          <div className="row" key={r.id}>
            <div>{locationsById.get(r.locationId)?.name ?? r.locationId}</div>
            <div>{WEEKDAY_NAMES[r.dayOfWeek]}</div>
            <div>{r.startLocal}–{r.endLocal}</div>
            <div><button className="link small" onClick={() => removeRule(r.id)}>Remove</button></div>
          </div>
        ))}
      </div>
      <form className="form-grid inline-form" onSubmit={addRule}>
        <label>Location
          <select value={newRuleLocation || firstLocation} onChange={e => setNewRuleLocation(e.target.value)}>
            {(locations ?? []).map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
          </select>
        </label>
        <label>Day
          <select value={newRuleDay} onChange={e => setNewRuleDay(e.target.value)}>
            {WEEKDAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </label>
        <label>From<input type="time" value={newRuleStart} onChange={e => setNewRuleStart(e.target.value)} /></label>
        <label>Until<input type="time" value={newRuleEnd} onChange={e => setNewRuleEnd(e.target.value)} /></label>
        <button type="submit" className="primary">Add window</button>
      </form>

      <section className="section-title"><div><p className="eyebrow">ONE-OFF</p><h2>Exceptions</h2></div></section>
      <div className="table">
        <div className="thead"><span>LOCATION</span><span>DATE</span><span>TYPE</span><span /></div>
        {(data?.exceptions ?? []).length === 0 && <p className="empty">No exceptions on file.</p>}
        {data?.exceptions.map(ex => (
          <div className="row" key={ex.id}>
            <div>{locationsById.get(ex.locationId)?.name ?? ex.locationId}</div>
            <div>{ex.date}</div>
            <div>{ex.type}</div>
            <div><button className="link small" onClick={() => removeException(ex.id)}>Remove</button></div>
          </div>
        ))}
      </div>
      <form className="form-grid inline-form" onSubmit={addException}>
        <label>Location
          <select value={newExLocation || firstLocation} onChange={e => setNewExLocation(e.target.value)}>
            {(locations ?? []).map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
          </select>
        </label>
        <label>Date<input type="date" required value={newExDate} onChange={e => setNewExDate(e.target.value)} /></label>
        <label>Type
          <select value={newExType} onChange={e => setNewExType(e.target.value as 'unavailable' | 'available')}>
            <option value="unavailable">Unavailable all day</option>
            <option value="available">Available (custom window)</option>
          </select>
        </label>
        <button type="submit" className="primary">Add exception</button>
      </form>
    </>
  );
}
