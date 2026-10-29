import { byId } from './dom';

export type ToastKind = 'success' | 'error' | 'info';

let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(message: string, kind: ToastKind = 'info'): void {
  const el = byId('toast');
  el.textContent = message;
  el.className = `toast show${kind === 'info' ? '' : ` ${kind}`}`;
  clearTimeout(timer);
  timer = setTimeout(() => {
    el.className = 'toast';
  }, 3200);
}
