import { useEffect, useState } from 'react';

function format(): string {
  return new Date().toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' });
}

export function useLiveClock(): string {
  const [text, setText] = useState(format);
  useEffect(() => {
    const id = setInterval(() => setText(format()), 30000);
    return () => clearInterval(id);
  }, []);
  return text;
}
