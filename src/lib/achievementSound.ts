/**
 * A short celebratory "unlock" chime, synthesized with the Web Audio API so we
 * ship no audio asset. Plays an ascending C-E-G-C arpeggio. Best-effort: if the
 * browser blocks audio (no user gesture yet) or lacks Web Audio, it stays silent.
 */
export function playAchievementSound(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = now + i * 0.09;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });

    setTimeout(() => ctx.close().catch(() => {}), 900);
  } catch {
    /* audio unavailable or blocked — celebrate silently */
  }
}
