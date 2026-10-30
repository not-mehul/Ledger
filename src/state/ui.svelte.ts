// Navigation and transient UI state shared between components.

import type { Entry } from '../domain/entry';

export type Tab = 'entry' | 'ledger' | 'map' | 'settings';
export type ToastKind = 'success' | 'error' | 'info';

class UiState {
  tab = $state<Tab>('entry');
  /** Entry loaded into the form for editing. */
  editing = $state.raw<Entry | null>(null);
  /** Card to expand and scroll to when the ledger tab opens. */
  focusEntryId = $state<string | null>(null);
  toast = $state<{ message: string; kind: ToastKind; key: number } | null>(null);
  exportOpen = $state(false);
  /** Overlays (dialogs, popups) register here so the Android back button can close them. */
  private closers: (() => void)[] = [];

  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  notify(message: string, kind: ToastKind = 'info'): void {
    this.toast = { message, kind, key: Date.now() };
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = null), 3400);
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
