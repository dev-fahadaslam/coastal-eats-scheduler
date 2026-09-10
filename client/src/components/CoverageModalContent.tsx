import { useEffect } from 'react';
import { api, ApiError } from '../api/client.js';
import { useModal } from '../context/ModalContext.js';
import { useToast } from '../context/ToastContext.js';
import { useSocket } from '../context/SocketContext.js';
import { useApiData } from '../hooks/useApiData.js';
import { formatDateInZone, formatTimeInZone } from '../lib/time.js';
import type { Candidate, Evaluation, Location, Shift } from '../api/types.js';

interface CoverageResponse {
  shift: Shift;
  open: number;
  candidates: Candidate[];
}

function IssuesList({ evaluation }: { evaluation: Evaluation }) {
  return (
    <>
      {evaluation.issues.length > 0 && (
        <ul className="issue-list blocking">{evaluation.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>
      )}
      {evaluation.warnings.length > 0 && (
        <ul className="issue-list warning">{evaluation.warnings.map((issue, i) => <li key={i}>{issue}</li>)}</ul>
      )}
    </>
  );
}

interface CoverageModalContentProps {
  shiftId: string;
  location: Location;
  mode: 'assign' | 'swap';
  assignmentId?: string;
  excludeStaffId?: string;
  onDone: () => void;
}

export function CoverageModalContent({ shiftId, location, mode, assignmentId, excludeStaffId, onDone }: CoverageModalContentProps) {
  const { closeModal } = useModal();
  const showToast = useToast();
  const socket = useSocket();
  const { data, reload } = useApiData(() => api.get<CoverageResponse>(`/shifts/${shiftId}/candidates`), [shiftId]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => { reload(); showToast('Candidate list refreshed — this shift changed elsewhere.', 'info'); };
    socket.on('shift-update', handler);
    return () => { socket.off('shift-update', handler); };
  }, [socket, reload, showToast]);

  async function act(staffId: string, name: string) {
    if (!data) return;
    try {
      if (mode === 'assign') {
        await api.post('/assignments', { shiftId, staffId, expectedVersion: data.shift.version });
        showToast(`${name} assigned — all constraints passed.`, 'success');
      } else {
        await api.post('/swap-requests', { type: 'swap', assignmentId, targetStaffId: staffId });
        showToast('Swap requested — they will be notified.', 'success');
      }
      onDone();
      closeModal();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'warning');
    }
  }

  if (!data) return <p className="sub">Loading candidates…</p>;
  const candidates = excludeStaffId ? data.candidates.filter(c => c.person.id !== excludeStaffId) : data.candidates;

  return (
    <>
      <p className="eyebrow">{mode === 'assign' ? 'SMART COVERAGE' : 'REQUEST A SWAP'} · {location.name}</p>
      <h2>{mode === 'assign' ? `Find coverage for a ${data.shift.skill} shift` : 'Who should take this shift?'}</h2>
      <p className="sub">
        {formatDateInZone(data.shift.start, location.timezone)} · {formatTimeInZone(data.shift.start, location.timezone)}–{formatTimeInZone(data.shift.end, location.timezone)} {location.code}.
        {mode === 'assign'
          ? ' Every candidate is checked against skills, certification, availability, rest, and overtime.'
          : " They'll need to accept, then your manager approves."}
      </p>
      <div id="candidates">
        {candidates.length === 0 && <p className="empty">No staff on record.</p>}
        {candidates.map(c => (
          <article key={c.person.id} className={`candidate ${c.evaluation.allowed ? '' : 'ineligible'}`}>
            <div className="avatar">{c.person.initials}</div>
            <div>
              <strong>{c.person.name}</strong>
              <p>{(c.person.skills ?? []).join(' · ')} · {c.evaluation.projected.weekHours.toFixed(0)}h projected this week</p>
              <IssuesList evaluation={c.evaluation} />
            </div>
            {c.evaluation.allowed && (
              <button className="primary" onClick={() => act(c.person.id, c.person.name)}>
                {mode === 'assign' ? 'Assign' : 'Request'}
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
