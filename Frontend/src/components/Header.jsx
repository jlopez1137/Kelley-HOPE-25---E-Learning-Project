import { useEffect, useState } from 'react';
import { API_LABEL } from '../config';
import { checkHealth } from '../api';

const POLL_MS = 15_000;

export default function Header() {
  const [status, setStatus] = useState('checking'); // checking | connected | disconnected

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      const ok = await checkHealth();
      if (!cancelled) setStatus(ok ? 'connected' : 'disconnected');
    };
    probe();
    const timer = setInterval(probe, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const label = {
    checking: 'Checking backend…',
    connected: `Connected · ${API_LABEL}`,
    disconnected: 'Backend unreachable',
  }[status];

  return (
    <header className="header">
      <h1 className="header__title">Prompt Engineering Tutor</h1>
      <div className={`status status--${status}`}>
        <span className="status__dot" />
        {label}
      </div>
    </header>
  );
}
