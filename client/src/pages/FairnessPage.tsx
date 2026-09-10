import { api } from '../api/client.js';
import { useApiData } from '../hooks/useApiData.js';
import { useRealtimeRefetch } from '../hooks/useRealtimeRefetch.js';
import type { FairnessReport } from '../api/types.js';

export default function FairnessPage() {
  const { data: report, reload } = useApiData(() => api.get<FairnessReport>('/dashboard/fairness'), []);
  useRealtimeRefetch(reload);
  if (!report) return null;

  const maxHours = Math.max(1, ...report.rows.map(r => r.totalHours), ...report.rows.map(r => r.desiredHours));

  return (
    <>
      <section className="section-title"><div><p className="eyebrow">COASTAL EATS · FAIRNESS</p><h2>Fairness analytics</h2></div></section>
      <section className="grid">
        <article className="panel fairness" style={{ gridColumn: 1 }}>
          <div className="panel-head">
            <div><h2>Premium-shift fairness score</h2><p>Friday/Saturday evenings, weighted equally per person with a stake</p></div>
            <span className="score">{report.score} <small>/ 100</small></span>
          </div>
          <div className="fairness-copy">
            <span className="badge">{report.score >= 75 ? 'Distributed fairly' : 'Uneven distribution'}</span>
            <p>A fair share of premium shifts this period is about <strong>{report.fairShare.toFixed(1)}h</strong> per person with any assignments. The score falls as individual deviations from that share grow.</p>
          </div>
          <div className="progress"><i style={{ width: `${report.score}%` }} /></div>
        </article>
        <article className="panel attention" style={{ gridColumn: 2 }}>
          <div className="panel-head"><div><h2>How to read this</h2></div></div>
          <div className="attention-item"><div className="icon blue">◔</div><div><strong>Premium deviation</strong><p>Positive = more premium hours than a fair share; negative = fewer.</p></div></div>
          <div className="attention-item"><div className="icon amber">$</div><div><strong>Desired-hours gap</strong><p>Actual hours minus each person's stated desired weekly hours.</p></div></div>
        </article>
      </section>
      <section className="section-title"><div><p className="eyebrow">DISTRIBUTION</p><h2>Hours by team member</h2></div></section>
      <div className="table fairness-table">
        <div className="thead"><span>PERSON</span><span>TOTAL / DESIRED</span><span>PREMIUM SHIFTS</span><span>PREMIUM DEVIATION</span></div>
        {report.rows.length === 0 && <p className="empty">No staff in scope.</p>}
        {report.rows.map(r => (
          <div className="row" key={r.id}>
            <div className="shift-name"><div><strong>{r.name}</strong><small>{r.desiredHours}h desired</small></div></div>
            <div className="hours-bar">
              <i className={r.gapToDesired < -4 ? 'under' : r.gapToDesired > 4 ? 'over' : ''} style={{ '--w': `${Math.round((r.totalHours / maxHours) * 100)}%` } as React.CSSProperties} />
              <b>{r.totalHours.toFixed(1)}h</b>
            </div>
            <div>{r.premiumShiftCount} shift{r.premiumShiftCount === 1 ? '' : 's'} <small>({r.premiumHours.toFixed(1)}h)</small></div>
            <div className={r.premiumDeviation > 2 ? 'warn' : r.premiumDeviation < -2 ? 'danger' : ''}>
              {r.premiumDeviation >= 0 ? '+' : ''}{r.premiumDeviation.toFixed(1)}h
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
