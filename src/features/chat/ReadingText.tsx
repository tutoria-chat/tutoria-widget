/**
 * Renders the answer being read aloud as plain text with the current word
 * highlighted (karaoke style) and kept in view. Shown in place of the Markdown
 * only while that message is speaking; the char index comes from the speech
 * synthesis `onboundary` event.
 */
import { useEffect, useMemo, useRef } from 'react';

interface ReadingTextProps {
  text: string;
  charIndex: number;
}

export default function ReadingText({ text, charIndex }: ReadingTextProps) {
  // Split into word/space chunks, tracking each chunk's start offset.
  const parts = useMemo(() => {
    const out: { text: string; start: number; isWord: boolean }[] = [];
    let offset = 0;
    for (const chunk of text.split(/(\s+)/)) {
      if (chunk.length === 0) continue;
      out.push({ text: chunk, start: offset, isWord: /\S/.test(chunk) });
      offset += chunk.length;
    }
    return out;
  }, [text]);

  // The word currently spoken = last word whose start is at/before charIndex.
  const activeIdx = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i].isWord) continue;
      if (parts[i].start <= charIndex) idx = i;
      else break;
    }
    return idx;
  }, [parts, charIndex]);

  const activeRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIdx]);

  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
      {parts.map((p, i) => {
        if (!p.isWord) return <span key={i}>{p.text}</span>;
        const active = i === activeIdx;
        return (
          <span
            key={i}
            ref={active ? activeRef : undefined}
            className={
              active
                ? 'rounded bg-[#5ce1e6]/30 font-medium text-foreground shadow-[0_0_0_1px_rgba(92,225,230,0.5)]'
                : i < activeIdx
                  ? 'text-foreground/50 transition-colors'
                  : 'transition-colors'
            }
          >
            {p.text}
          </span>
        );
      })}
    </div>
  );
}
