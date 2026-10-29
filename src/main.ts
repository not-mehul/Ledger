// ============================================================
// Ledger — app entry point.
// Owns the in-memory entry list and wires the UI components to
// persistence (src/data) and import/export (src/platform).
// ============================================================

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Dialog } from '@capacitor/dialog';

import { openStore, type EntryStore } from './data/store';
import { isSameVisit, mergeImported, type Entry } from './domain/entry';
import { byId, plural } from './ui/dom';
import { EntryForm } from './ui/entry-form';
import { LedgerView } from './ui/ledger-view';
import { toast } from './ui/toast';
import { exportEntries, readImportFile } from './platform/transfer';

type Tab = 'new' | 'logbook';

let store: EntryStore | null = null;
let entries: Entry[] = [];
let activeTab: Tab = 'new';

const form = new EntryForm();
const ledger = new LedgerView({ onEdit: editEntry, onDelete: deleteEntry });

// ---------- status & tabs ----------

function refresh(): void {
  byId('entryBadge').textContent = String(entries.length);
  ledger.setEntries(entries);
  setStatus(`${plural(entries.length, 'entry', 'entries')} · on device`, store !== null);
}

function setStatus(message: string, ok: boolean): void {
  const status = byId('fileStatus');
  status.textContent = message;
  status.classList.toggle('connected', ok);
  byId('fileDot').classList.toggle('connected', ok);
}

function switchTab(tab: Tab): void {
  activeTab = tab;
  const isNew = tab === 'new';
  byId('viewNew').hidden = !isNew;
  byId('viewLogbook').hidden = isNew;
  for (const [id, selected] of [['tabNew', isNew], ['tabLogbook', !isNew]] as const) {
    const btn = byId(id);
    btn.classList.toggle('active', selected);
    btn.setAttribute('aria-selected', String(selected));
  }
  form.monthPicker.close();
}

function requireStore(): EntryStore {
  if (!store) throw new Error('Storage is unavailable.');
  return store;
}

// ---------- entry actions ----------

async function saveEntry(): Promise<void> {
  const result = form.read();
  if ('error' in result) {
    toast(result.error, 'error');
    return;
  }
  const { draft } = result;

  // A new entry for a visit that's already logged updates that entry instead.
  const duplicate = form.editingId ? undefined : entries.find((e) => isSameVisit(e, draft));
  const entry = form.toEntry(draft, form.editingId ?? duplicate?.id);
  const isUpdate = entries.some((e) => e.id === entry.id);

  try {
    await requireStore().upsert(entry);
  } catch (err) {
    console.error('Save failed:', err);
    toast('Save failed — your entry is still in the form.', 'error');
    return;
  }

  entries = isUpdate ? entries.map((e) => (e.id === entry.id ? entry : e)) : [...entries, entry];
  form.reset();
  refresh();
  toast(
    isUpdate
      ? `Updated: ${entry.city}, ${entry.state}.`
      : `Saved: ${entry.city}, ${entry.state} — ${entry.score}/100`,
    'success',
  );
}

function editEntry(id: string): void {
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  form.load(entry);
  switchTab('new');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast(`Loaded ${entry.city}, ${entry.state} for editing.`);
}

async function deleteEntry(id: string): Promise<void> {
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;

  const { value: confirmed } = await Dialog.confirm({
    title: 'Delete entry?',
    message: `${entry.city}, ${entry.state} will be permanently removed from your ledger.`,
    okButtonTitle: 'Delete',
    cancelButtonTitle: 'Cancel',
  });
  if (!confirmed) return;

  try {
    await requireStore().remove(id);
  } catch (err) {
    console.error('Delete failed:', err);
    toast('Delete failed.', 'error');
    return;
  }

  entries = entries.filter((e) => e.id !== id);
  if (form.editingId === id) form.reset();
  refresh();
  toast('Entry deleted.');
}

// ---------- import / export ----------

async function exportLedger(): Promise<void> {
  if (!entries.length) {
    toast('Nothing to export yet.', 'error');
    return;
  }
  try {
    const { savedTo } = await exportEntries(entries);
    toast(savedTo ? `Saved to ${savedTo}` : 'Export ready to share.', 'success');
  } catch (err) {
    console.error('Export failed:', err);
    toast('Export failed.', 'error');
  }
}

async function importLedger(file: File): Promise<void> {
  try {
    const { entries: imported, skipped } = await readImportFile(file);
    if (!imported.length) {
      toast('No Ledger entries found in that file.', 'error');
      return;
    }

    const plan = mergeImported(entries, imported);
    await requireStore().upsertMany(plan.toSave);
    entries = await requireStore().list();
    refresh();

    const parts = [`${plan.added} added`, `${plan.updated} updated`];
    if (plan.unchanged) parts.push(`${plan.unchanged} already up to date`);
    if (skipped) parts.push(`${skipped} unreadable`);
    toast(`Import complete: ${parts.join(', ')}.`, 'success');
  } catch (err) {
    console.error('Import failed:', err);
    toast('Import failed.', 'error');
  }
}

// ---------- wiring ----------

function wireEvents(): void {
  byId('tabNew').addEventListener('click', () => switchTab('new'));
  byId('tabLogbook').addEventListener('click', () => switchTab('logbook'));
  byId('btnSave').addEventListener('click', () => void saveEntry());
  byId('btnClear').addEventListener('click', () => form.reset());
  byId('btnExport').addEventListener('click', () => void exportLedger());

  const fileInput = byId<HTMLInputElement>('importFile');
  byId('btnImport').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = ''; // allow re-importing the same file
    if (file) void importLedger(file);
  });

  // Android back: close the picker, then return to the Entry tab, then exit.
  if (Capacitor.isNativePlatform()) {
    void App.addListener('backButton', () => {
      if (form.monthPicker.isOpen) form.monthPicker.close();
      else if (activeTab !== 'new') switchTab('new');
      else void App.exitApp();
    });
  }
}

async function start(): Promise<void> {
  wireEvents();
  try {
    store = await openStore();
    entries = await store.list();
  } catch (err) {
    console.error('Storage failed to initialise:', err);
    setStatus('Storage unavailable', false);
    toast('Could not open the on-device database.', 'error');
    return;
  }
  refresh();
}

void start();
