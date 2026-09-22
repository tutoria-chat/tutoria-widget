/**
 * Speech-to-text for the chat composer, built on the Web Speech API
 * (SpeechRecognition / webkitSpeechRecognition). The student talks; interim
 * words stream into the input and the final transcript lands ready to send.
 *
 * Support is Chrome/Edge/Safari; unsupported browsers (e.g. Firefox) report
 * `supported: false` so the mic button can hide. In an LMS iframe the embed
 * must allow microphone access (allow="microphone") or start() errors — the
 * onError callback surfaces that to the user.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  lang: string;
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (error: string) => void;
}

export function useSpeechRecognition({ lang, onInterim, onFinal, onError }: Options) {
  const Ctor =
    typeof window !== 'undefined'
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
      : null;
  const supported = !!Ctor;
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const cbRef = useRef({ onInterim, onFinal, onError });
  cbRef.current = { onInterim, onFinal, onError };

  const stop = useCallback(() => {
    const r = recRef.current;
    if (r) {
      try {
        r.stop();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const start = useCallback(() => {
    if (!Ctor) return;
    if (recRef.current) {
      try {
        recRef.current.abort();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      if (finalText && cbRef.current.onFinal) cbRef.current.onFinal(finalText);
      if (interim && cbRef.current.onInterim) cbRef.current.onInterim(interim);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      cbRef.current.onError?.(e?.error || 'error');
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      recRef.current = null;
    }
  }, [Ctor, lang]);

  useEffect(
    () => () => {
      if (recRef.current) {
        try {
          recRef.current.abort();
        } catch {
          /* ignore */
        }
      }
    },
    [],
  );

  return { supported, listening, start, stop };
}
