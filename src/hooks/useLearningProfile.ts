/**
 * The student's opt-in learning profile ("Seu jeito de aprender"), shared
 * between Settings (which edits it) and the chat (which sends the adaptations).
 * Stored per-device in localStorage only — never on our servers — and synced
 * across components and tabs.
 */
import { useEffect, useState } from 'react';
import { EMPTY_PROFILE, normalizeProfile, type LearningProfile } from '../lib/learningProfile';

const KEY = 'erwin-learning-profile';
const EVENT = 'erwin:learning-profile-change';

export function getLearningProfile(): LearningProfile {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeProfile(JSON.parse(raw)) : EMPTY_PROFILE;
  } catch {
    return EMPTY_PROFILE;
  }
}

function setStored(value: LearningProfile | null) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* SSR / no window */
  }
}

/** [profile, update, clear] — clear removes every trace from this device. */
export function useLearningProfile(): [
  LearningProfile,
  (next: LearningProfile) => void,
  () => void,
] {
  const [value, setValue] = useState<LearningProfile>(getLearningProfile);

  useEffect(() => {
    const sync = () => setValue(getLearningProfile());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const update = (next: LearningProfile) => {
    const clean = normalizeProfile(next);
    setStored(clean);
    setValue(clean);
  };

  const clear = () => {
    setStored(null);
    setValue(EMPTY_PROFILE);
  };

  return [value, update, clear];
}
