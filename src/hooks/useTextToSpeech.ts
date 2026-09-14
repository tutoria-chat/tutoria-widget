/**
 * Text-to-speech for tutor answers, built on the browser's SpeechSynthesis.
 *
 * This is the accessibility win: students who read slowly, have low vision, or
 * are dyslexic can listen to the answer instead. Only one message speaks at a
 * time; calling speak() again with the same key toggles it off.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** Strip Markdown/LaTeX so the voice reads prose, not symbols and backticks. */
export function stripForSpeech(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → text
    .replace(/\$\$[\s\S]*?\$\$/g, ' ') // display math
    .replace(/\$[^$\n]*\$/g, ' ') // inline math
    .replace(/\\\[[\s\S]*?\\\]/g, ' ') // \[ … \]
    .replace(/\\\([\s\S]*?\\\)/g, ' ') // \( … \)
    .replace(/\\[a-zA-Z]+/g, ' ') // leftover LaTeX commands
    .replace(/^[>#\s]+/gm, '') // heading / blockquote markers
    .replace(/^[\s]*[-*+]\s+/gm, '') // list bullets
    .replace(/[*_~`>#|{}]/g, '') // stray Markdown/LaTeX punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

export function useTextToSpeech(lang: string, rate = 0.9) {
  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined';
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  // The cleaned text being read + the char index of the word currently spoken,
  // so the UI can highlight it and follow along.
  const [spokenText, setSpokenText] = useState('');
  const [charIndex, setCharIndex] = useState(0);
  const keyRef = useRef<string | null>(null);

  // Nudge the (async) voice list to populate so pickVoice has options ready.
  useEffect(() => {
    if (!supported) return;
    try {
      window.speechSynthesis.getVoices();
      const handler = () => window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener?.('voiceschanged', handler);
      return () => {
        window.speechSynthesis.removeEventListener?.('voiceschanged', handler);
        window.speechSynthesis.cancel();
      };
    } catch {
      /* speechSynthesis flaky in some embeds — degrade silently */
    }
  }, [supported]);

  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    try {
      const voices = window.speechSynthesis.getVoices() || [];
      const want = lang.toLowerCase(); // e.g. 'pt-br'
      const base = want.split('-')[0]; // e.g. 'pt'
      const norm = (v: SpeechSynthesisVoice) => (v.lang || '').toLowerCase().replace('_', '-');
      // Exact region first (pt-BR, not pt-PT).
      const exact = voices.find((v) => norm(v) === want || norm(v).startsWith(want));
      if (exact) return exact;
      // Portuguese is region-sensitive: never substitute a Portugal voice for
      // a Brazilian one — leave the choice to the engine via utterance.lang.
      if (base === 'pt') return null;
      return voices.find((v) => norm(v).startsWith(base)) || null;
    } catch {
      return null;
    }
  }, [lang]);

  const reset = useCallback(() => {
    keyRef.current = null;
    setSpeakingKey(null);
    setSpokenText('');
    setCharIndex(0);
  }, []);

  const stop = useCallback(() => {
    if (supported) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
    reset();
  }, [supported, reset]);

  /** Speak `text` for `key`; calling again with the same key stops it. */
  const speak = useCallback(
    (key: string, text: string) => {
      if (!supported) return;
      const wasSpeaking = keyRef.current;
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
      if (wasSpeaking === key) {
        reset();
        return;
      }
      const clean = stripForSpeech(text);
      if (!clean) {
        reset();
        return;
      }
      try {
        const u = new SpeechSynthesisUtterance(clean);
        u.lang = lang;
        u.rate = rate;
        const v = pickVoice();
        if (v) u.voice = v;
        // Follow along word by word (charIndex points at the current word).
        u.onboundary = (e) => {
          if (keyRef.current === key && typeof e.charIndex === 'number') {
            setCharIndex(e.charIndex);
          }
        };
        u.onend = () => {
          if (keyRef.current === key) reset();
        };
        u.onerror = u.onend;
        keyRef.current = key;
        setSpeakingKey(key);
        setSpokenText(clean);
        setCharIndex(0);
        window.speechSynthesis.speak(u);
      } catch {
        reset();
      }
    },
    [supported, lang, rate, pickVoice, reset],
  );

  return { supported, speakingKey, spokenText, charIndex, speak, stop };
}
