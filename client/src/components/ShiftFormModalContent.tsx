import { useState } from 'react';
import { api, ApiError } from '../api/client.js';
import { useModal } from '../context/ModalContext.js';
import { useAuth } from '../context/AuthContext.js';
import { isoToLocalTime, dateKeyInZone, zonedTimeToUTC } from '../lib/time.js';
import { canEditShiftClient, PUBLISH_CUTOFF_HOURS, SKILLS } from '../lib/rules.js';
import type { Location, Shift } from '../api/types.js';

interface ShiftFormModalContentProps {
  location: Location;
  shift?: Shift;
  onSaved: () => void;
}

export function ShiftFormModalContent({ location, shift, onSaved }: ShiftFormModalContentProps) {
  const { closeModal } = useModal();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const editable = shift ? canEditShiftClient(shift.start) : true;

  const [skill, setSkill] = useState(shift?.skill ?? SKILLS[0]!);
  const [headcount, setHeadcount] = useState(shift?.headcount ?? 1);
  const [date, setDate] = useState(shift ? dateKeyInZone(shift.start, location.timezone) : dateKeyInZone(new Date().toISOString(), location.timezone));
  const [start, setStart] = useState(shift ? isoToLocalTime(shift.start, location.timezone) : '17:00');
  const [end, setEnd] = useState(shift ? isoToLocalTime(shift.end, location.timezone) : '23:00');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const [y, m, d] = date.split('-').map(Number) as [number, number, number];
      const [sh, sm] = start.split(':').map(Number) as [number, number];
      const [eh, em] = end.split(':').map(Number) as [number, number];
      const overnight = eh * 60 + em <= sh * 60 + sm;
      const startIso = zonedTimeToUTC(y, m, d, sh, sm, location.timezone);
      const endDate = new Date(Date.UTC(y, m - 1, d));
      if (overnight) endDate.setUTCDate(endDate.getUTCDate() + 1);
      const endIso = zonedTimeToUTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, endDate.getUTCDate(), eh, em, location.timezone);

      if (shift) {
        await api.patch(`/shifts/${shift.id}`, {
          changes: { skill, headcount, start: startIso, end: endIso },
          override: isAdmin && !editable,
        });
      } else {
        await api.post('/shifts', { locationId: location.id, skill, headcount, start: startIso, end: endIso });
      }
      onSaved();
      closeModal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p className="eyebrow">{shift ? 'EDIT SHIFT' : 'NEW SHIFT'} · {location.name}</p>
      <h2>{shift ? 'Edit shift' : 'Create a shift'}</h2>
      {shift && !editable && (
        <p className="sub warn-text">
          Inside the {PUBLISH_CUTOFF_HOURS}-hour publish cutoff.{isAdmin ? ' As admin you may still override.' : ' Ask an admin to override if this must change.'}
        </p>
      )}
      <form className="form-grid" onSubmit={submit}>
        {error && <div className="form-error">{error}</div>}
        <label>Skill required
          <select value={skill} onChange={e => setSkill(e.target.value)}>
            {SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Headcount
          <input type="number" min={1} max={8} value={headcount} onChange={e => setHeadcount(Number(e.target.value))} />
        </label>
        <label>Date ({location.code} local)
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </label>
        <label>Start time
          <input type="time" value={start} onChange={e => setStart(e.target.value)} required />
        </label>
        <label>End time
          <input type="time" value={end} onChange={e => setEnd(e.target.value)} required />
        </label>
        <p className="hint">Overnight is fine — an end time earlier than the start time is treated as past midnight.</p>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={closeModal}>Cancel</button>
          <button type="submit" className="primary" disabled={saving || (Boolean(shift) && !editable && !isAdmin)}>
            {shift ? 'Save changes' : 'Create shift'}
          </button>
        </div>
      </form>
    </>
  );
}
