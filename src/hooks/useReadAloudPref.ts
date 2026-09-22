/**
 * "Read tutor answers aloud automatically" preference, shared between the chat
 * (which acts on it) and Settings (which toggles it). Stored per-viewer in
 * localStorage and synced across components via a window event.
 */
import { useEffect, useState } from 'react';

const KEY = 'erwin-read-aloud';
const EVENT = 'erwin:read-aloud-change';

export function getReadAloud(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function setReadAloud(value: boolean) {
  try {
    localStorage.setItem(KEY, value ? '1' : '0');
  } catch {
    /* storage unavailable — keep it in-memory for this session */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
  } catch {
    /* SSR / no window */
  }
}

export function useReadAloudPref(): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState<boolean>(getReadAloud);

  useEffect(() => {
    const sync = () => setValue(getReadAloud());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const update = (next: boolean) => {
    setReadAloud(next);
    setValue(next);
  };

  return [value, update];
}
