// Keeps the toast (dusk-dawn §8.12) clear of whatever is docked at the
// bottom of the screen: the compare tray, an open sheet. Each holder asks
// for a lift in pixels; the toast rises by the largest one, so two holders
// never undo each other.

const lifts = new Map<symbol, number>();

function apply(): void {
  const highest = Math.max(0, ...lifts.values());
  const style = document.body.style;
  if (highest) style.setProperty('--toast-lift', `${Math.round(highest)}px`);
  else style.removeProperty('--toast-lift');
}

/** Holds a lift until the returned function is called. Call `set` again as the holder resizes. */
export function holdToastLift(): { set: (px: number) => void; release: () => void } {
  const key = Symbol('toast-lift');
  return {
    set(px) {
      lifts.set(key, px);
      apply();
    },
    release() {
      lifts.delete(key);
      apply();
    },
  };
}

/** Lifts the toast above `el` while it sits at the bottom of the screen, as long as `el` is mounted. */
export function liftAbove(el: HTMLElement, gap = 12): () => void {
  const lift = holdToastLift();
  const measure = () => {
    const rect = el.getBoundingClientRect();
    // Docked: at, or floating just above, the bottom edge (the sticky compare tray sits 12px up).
    const docked = rect.height > 0 && rect.bottom >= innerHeight - 40;
    // Never so high that the toast leaves the screen.
    lift.set(docked ? Math.min(innerHeight - rect.top + gap, innerHeight - 120) : 0);
  };
  const observer = new ResizeObserver(measure);
  observer.observe(el);
  // Size changes, the viewport, scrolling (a sticky tray docks and undocks) and
  // the end of an entrance animation all move it.
  addEventListener('resize', measure);
  addEventListener('scroll', measure, { passive: true });
  el.addEventListener('animationend', measure);
  el.addEventListener('transitionend', measure);
  measure();
  return () => {
    observer.disconnect();
    removeEventListener('resize', measure);
    removeEventListener('scroll', measure);
    el.removeEventListener('animationend', measure);
    el.removeEventListener('transitionend', measure);
    lift.release();
  };
}
