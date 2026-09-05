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

export function useTextToSpeech(lang: string) {
  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined';
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
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
      const want = lang.toLowerCase();
      const base = want.split('-')[0];
      return (
        voices.find((v) => v.lang?.toLowerCase() === want) ||
        voices.find((v) => v.lang?.toLowerCase().startsWith(base)) ||
        null
      );
    } catch {
      return null;
    }
  }, [lang]);

  const stop = useCallback(() => {
    if (!supported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    keyRef.current = null;
    setSpeakingKey(null);
  }, [supported]);

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
        keyRef.current = null;
        setSpeakingKey(null);
        return;
      }
      const clean = stripForSpeech(text);
      if (!clean) {
        keyRef.current = null;
        setSpeakingKey(null);
        return;
      }
      try {
        const u = new SpeechSynthesisUtterance(clean);
        u.lang = lang;
        const v = pickVoice();
        if (v) u.voice = v;
        u.onend = () => {
          if (keyRef.current === key) {
            keyRef.current = null;
            setSpeakingKey(null);
          }
        };
        u.onerror = u.onend;
        keyRef.current = key;
        setSpeakingKey(key);
        window.speechSynthesis.speak(u);
      } catch {
        keyRef.current = null;
        setSpeakingKey(null);
      }
    },
    [supported, lang, pickVoice],
  );

  return { supported, speakingKey, speak, stop };
}
