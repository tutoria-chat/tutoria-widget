/**
 * Read-aloud speed, shared between the chat (which speaks) and Settings (which
 * sets it). Stored per-viewer in localStorage and synced across components.
 * Default is slightly slower than normal for easier listening.
 */
import { useEffect, useState } from 'react';

const KEY = 'erwin-speech-rate';
const EVENT = 'erwin:speech-rate-change';

export const SPEECH_RATES = [0.75, 0.9, 1, 1.15] as const;
export const DEFAULT_SPEECH_RATE = 0.9;

export function getSpeechRate(): number {
  try {
    const raw = parseFloat(localStorage.getItem(KEY) || '');
    return Number.isFinite(raw) && raw >= 0.5 && raw <= 2 ? raw : DEFAULT_SPEECH_RATE;
  } catch {
    return DEFAULT_SPEECH_RATE;
  }
}

function setStored(value: number) {
  try {
    localStorage.setItem(KEY, String(value));
  } catch {
    /* storage unavailable */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
  } catch {
    /* SSR / no window */
  }
}

export function useSpeechRatePref(): [number, (value: number) => void] {
  const [value, setValue] = useState<number>(getSpeechRate);

  useEffect(() => {
    const sync = () => setValue(getSpeechRate());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const update = (next: number) => {
    setStored(next);
    setValue(next);
  };

  return [value, update];
}
