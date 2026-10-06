'use client';

import { useEffect, useState } from 'react';
import { Icon } from './ui';

const KEY = 'medcompare:theme';

/** Sun/moon toggle. Light is the default; the choice is remembered. */
export function ThemeSwitch() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem(KEY, next ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', next);
  };

  return (
    <button type="button" onClick={toggle} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} className="grid size-9 place-items-center rounded-lg text-ink-3 transition hover:bg-surface-2 hover:text-ink">
      <Icon name={dark ? 'sun' : 'moon'} className="size-[18px]" />
    </button>
  );
}
