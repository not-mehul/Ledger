// Navigation and transient UI state shared between components.

import type { Entry } from '../domain/entry';

export type Tab = 'entry' | 'ledger' | 'map' | 'insights' | 'settings';
export type ToastKind = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  run: () => void;
  /** Called when the toast goes away without the action being taken. */
  dismissed?: () => void;
}

export interface Toast {
  message: string;
  kind: ToastKind;
  key: number;
  action?: ToastAction;
  /** Fading out. */
  leaving?: boolean;
}

export interface ConfirmRequest {
  title: string;
  message: string;
  /** The verb on the committing button: "Restore defaults", not "OK". */
  action: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

/** How long a toast stays (style.md §8.12): longer when it offers an action. */
export const TOAST_MS = 4000;
export const TOAST_ACTION_MS = 6000;
/** --dur-exit */
const TOAST_EXIT_MS = 160;

class UiState {
  tab = $state<Tab>('entry');
  /** Entry loaded into the form for editing. */
  editing = $state.raw<Entry | null>(null);
  /** Card to expand and scroll to when the ledger tab opens. */
  focusEntryId = $state<string | null>(null);
  toast = $state.raw<Toast | null>(null);
  exportOpen = $state(false);
  confirmRequest = $state.raw<ConfirmRequest | null>(null);
  /** Overlays (dialogs, popups) register here so the Android back button can close them. */
  private closers: (() => void)[] = [];

  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private toastKey = 0;

  /** Shows one toast, replacing any current one. */
  notify(message: string, kind: ToastKind = 'info', action?: ToastAction): void {
    if (!this.toast?.leaving) this.toast?.action?.dismissed?.();
    this.toast = { message, kind, key: ++this.toastKey, action };
    this.resumeToast();
  }

  /** Holds the toast on screen while it is touched or hovered. */
  pauseToast(): void {
    clearTimeout(this.toastTimer);
  }

  resumeToast(): void {
    clearTimeout(this.toastTimer);
    const toast = this.toast;
    if (!toast) return;
    this.toastTimer = setTimeout(() => this.dismissToast(toast.key), toast.action ? TOAST_ACTION_MS : TOAST_MS);
  }

  dismissToast(key: number): void {
    const toast = this.toast;
    if (toast?.key !== key || toast.leaving) return;
    clearTimeout(this.toastTimer);
    toast.action?.dismissed?.();
    this.toast = { ...toast, action: undefined, leaving: true };
    setTimeout(() => {
      if (this.toast?.key === key) this.toast = null;
    }, TOAST_EXIT_MS);
  }

  /** Runs the toast's action and closes it. */
  actOnToast(): void {
    const toast = this.toast;
    if (!toast?.action) return;
    clearTimeout(this.toastTimer);
    this.toast = null;
    toast.action.run();
  }

  /** Asks in a confirm modal (style.md §8.10). Only for what can't be undone. */
  confirm(request: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
    this.confirmRequest?.resolve(false);
    return new Promise((resolve) => {
      this.confirmRequest = {
        ...request,
        resolve: (ok) => {
          this.confirmRequest = null;
          resolve(ok);
        },
      };
    });
  }

  go(tab: Tab): void {
    this.tab = tab;
    globalThis.scrollTo?.({ top: 0 });
  }

  edit(entry: Entry): void {
    this.editing = entry;
    this.go('entry');
  }

  showInLedger(id: string): void {
    this.focusEntryId = id;
    this.go('ledger');
  }

  pushOverlay(close: () => void): () => void {
    this.closers.push(close);
    return () => {
      this.closers = this.closers.filter((c) => c !== close);
    };
  }

  /** Handles Android back. Returns false when the app should exit. */
  back(): boolean {
    const close = this.closers.pop();
    if (close) {
      close();
      return true;
    }
    if (this.tab !== 'entry') {
      this.go('entry');
      return true;
    }
    return false;
  }
}

export const ui = new UiState();
