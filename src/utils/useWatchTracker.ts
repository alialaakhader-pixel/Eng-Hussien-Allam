import { useCallback, useEffect, useRef } from 'react';

type Flush = (lessonId: string, deltaSeconds: number, position: number, duration: number) => void;

const MAX_STEP = 3.5;   // larger forward jumps are seeks, not watching
const FLUSH_EVERY = 15; // seconds of real watching between saves

/**
 * Counts only time during which the video was really playing at normal progress.
 * Skips (seek) and rewinds are never counted. Works for an HTML5 video or any source
 * that can report (currentTime, playing, duration), such as the YouTube iframe API.
 */
export function useWatchTracker(lessonId: string | undefined, enabled: boolean, onFlush: Flush) {
  const last = useRef<number | null>(null);
  const pending = useRef(0);
  const pos = useRef(0);
  const dur = useRef(0);
  const cb = useRef(onFlush);
  cb.current = onFlush;
  const id = useRef(lessonId);

  const flush = useCallback(() => {
    if (id.current && pending.current > 0) {
      cb.current(id.current, pending.current, pos.current, dur.current);
      pending.current = 0;
    }
  }, []);

  const reset = useCallback(() => { last.current = null; }, []);

  const feed = useCallback((current: number, playing: boolean, duration: number) => {
    if (!enabled || !Number.isFinite(current)) return;
    if (Number.isFinite(duration) && duration > 0) dur.current = duration;
    pos.current = current;
    const prev = last.current;
    last.current = current;
    if (prev === null || !playing) return;
    const delta = current - prev;
    if (delta > 0 && delta <= MAX_STEP) {
      pending.current += delta;
      if (pending.current >= FLUSH_EVERY) flush();
    }
  }, [enabled, flush]);

  // lesson changed or player closed: save what we have, then start clean
  useEffect(() => {
    id.current = lessonId;
    last.current = null; pending.current = 0; pos.current = 0; dur.current = 0;
    return () => { flush(); id.current = undefined; };
  }, [lessonId, flush]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') { flush(); last.current = null; } };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [flush]);

  return { feed, flush, reset };
}
