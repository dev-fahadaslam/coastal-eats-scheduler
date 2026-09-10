import { useMemo } from 'react';
import { api, ApiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useApiData } from '../hooks/useApiData.js';
import { useRealtimeRefetch } from '../hooks/useRealtimeRefetch.js';
import { useModal } from '../context/ModalContext.js';
import { useConfirm } from '../hooks/useConfirm.js';
import { useToast } from '../context/ToastContext.js';
import { WEEKDAY_NAMES } from '../lib/time.js';
import type { AvailabilityRule, Certification, Location, User } from '../api/types.js';

interface LaborPerStaff { staffId: string; hours: number }
interface LaborSummaryLite { perStaff: LaborPerStaff[] }

function TeamMemberDetail({ person, canManage, onChanged }: { person: User; canManage: boolean; onChanged: () => void }) {
  const { closeModal } = useModal();
  const confirm = useConfirm();
  const showToast = useToast();
  const { data: certs } = useApiData(() => api.get<Certification[]>(`/users/${person.id}/certifications`), [person.id]);
  const { data: locations } = useApiData(() => api.get<Location[]>('/locations'), []);
  const { data: rules } = useApiData(() => api.get<AvailabilityRule[]>(`/users/${person.id}/availability`), [person.id]);
  const locationsById = useMemo(() => new Map((locations ?? []).map(l => [l.id, l])), [locations]);

  async function removeCert(locationId: string) {
    const ok = await confirm({
      title: 'Remove this certification?', danger: true, confirmLabel: 'Remove certification',
      body: `${person.name} will no longer be eligible for new assignments at this location. Past shifts and history are kept.`,
    });
    if (!ok) return;
    try {
      await api.del(`/users/${person.id}/certifications/${locationId}`);
      showToast('Certification removed. Historical shifts remain on record.', 'success');
      onChanged();
      closeModal();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not remove certification.', 'warning');
    }
  }

  return (
    <>
      <p className="eyebrow">TEAM MEMBER</p>
      <h2>{person.name}</h2>
      <p className="sub">{person.email} · desires {person.desiredHours}h/week</p>
      <h3 className="modal-subhead">Certifications</h3>
      <ul className="detail-list">
        {(certs ?? []).length === 0 && <li>No certifications on record.</li>}
        {(certs ?? []).map(c => {
          const loc = locationsById.get(c.locationId);
          const active = !c.validTo;
          return (
            <li key={c.id}>
              {loc?.name ?? c.locationId} — {active
                ? <span className="badge good-badge">active</span>
                : <span className="badge">ended {c.validTo?.slice(0, 10)}</span>}
              {active && canManage && <button className="link small" onClick={() => removeCert(c.locationId)}>Remove certification</button>}
            </li>
          );
        })}
      </ul>
      <h3 className="modal-subhead">Recurring availability</h3>
      <ul className="detail-list">
        {(rules ?? []).length === 0 && <li>No recurring availability on file.</li>}
        {(rules ?? []).map(r => (
          <li key={r.id}>{locationsById.get(r.locationId)?.name ?? r.locationId} — {WEEKDAY_NAMES[r.dayOfWeek]} {r.startLocal}–{r.endLocal} local</li>
        ))}
      </ul>
    </>
  );
}

export default function TeamPage() {
  const { user } = useAuth();
  const { openModal } = useModal();
  const canManage = user?.role !== 'staff';

  const { data: staff, reload: reloadStaff } = useApiData(() => api.get<User[]>('/users'), []);
  const { data: labor } = useApiData(() => api.get<LaborSummaryLite>('/dashboard/labor'), []);
  const { data: locations } = useApiData(() => api.get<Location[]>('/locations'), []);
  useRealtimeRefetch(reloadStaff);

  const locationsById = useMemo(() => new Map((locations ?? []).map(l => [l.id, l])), [locations]);
  const hoursByStaff = useMemo(() => new Map((labor?.perStaff ?? []).map(p => [p.staffId, p.hours])), [labor]);

  return (
    <>
      <section className="section-title"><div><p className="eyebrow">COASTAL EATS · TEAM</p><h2>Team directory</h2></div><span>{(staff ?? []).length} team members</span></section>
      <div className="table team-table">
        <div className="thead"><span>PERSON</span><span>SKILLS</span><span>CERTIFIED AT</span><span>HOURS THIS WEEK</span></div>
        {(staff ?? []).map(person => {
          const actual = hoursByStaff.get(person.id) ?? 0;
          const gap = actual - (person.desiredHours ?? 0);
          return (
            <div className="row" key={person.id}>
              <div className="shift-name"><div className="avatar small">{person.initials}</div><div><strong>{person.name}</strong><small>{person.email}</small></div></div>
              <div>{person.skills.map(s => <span className="badge" key={s}>{s}</span>)}</div>
              <div>{person.locationIds.map(id => locationsById.get(id)).filter(Boolean).map(l => <span className="badge" key={l!.id}>{l!.code} {l!.name}</span>)}</div>
              <div>
                <strong>{actual.toFixed(1)}h</strong> <small className={gap > 4 ? 'warn' : gap < -4 ? 'danger' : ''}>of {person.desiredHours}h desired</small>
                <button className="link small" onClick={() => openModal(<TeamMemberDetail person={person} canManage={canManage} onChanged={reloadStaff} />)}>Details</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
