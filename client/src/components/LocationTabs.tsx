import type { ReactNode } from 'react';
import type { Location } from '../api/types.js';

interface LocationTabsProps {
  locations: Location[];
  active: string;
  onSelect: (id: string) => void;
  trailing?: ReactNode;
}

export function LocationTabs({ locations, active, onSelect, trailing }: LocationTabsProps) {
  return (
    <section className="locations">
      <p>LOCATION</p>
      {locations.map(l => (
        <button key={l.id} className={`location ${l.id === active ? 'selected' : ''}`} onClick={() => onSelect(l.id)}>
          {l.name} <span>{l.code}</span>
        </button>
      ))}
      {trailing}
    </section>
  );
}
