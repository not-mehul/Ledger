import { currentMonthString, parseMonth, toMonthString } from '../lib/dates';
import { byId } from './dom';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Month-of-visit picker: a read-only input that opens a year/month grid. */
export class MonthPicker {
  private readonly input = byId<HTMLInputElement>('inputDate');
  private readonly popup = byId('dpPopup');
  private readonly grid = byId('dpGrid');
  private readonly yearLabel = byId('dpYearLabel');

  private year = 0;
  private monthIndex = 0;
  private viewYear = 0;

  constructor() {
    this.value = currentMonthString();

    this.input.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggle();
      } else if (e.key === 'Escape') {
        this.close();
      }
    });
    this.popup.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
        this.input.focus();
      }
    });
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.popup.contains(e.target as Node)) this.close();
    });

    byId('dpPrevYear').addEventListener('click', () => this.shiftYear(-1));
    byId('dpNextYear').addEventListener('click', () => this.shiftYear(1));
    this.grid.addEventListener('click', (e) => {
      const btn = (e.target as Element).closest<HTMLButtonElement>('[data-month]');
      if (!btn) return;
      e.stopPropagation();
      this.year = this.viewYear;
      this.monthIndex = Number(btn.dataset.month);
      this.sync();
      this.close();
      this.input.focus();
    });
  }

  /** "YYYY-MM" */
  get value(): string {
    return toMonthString(this.year, this.monthIndex);
  }

  set value(month: string) {
    const parsed = parseMonth(month) ?? parseMonth(currentMonthString())!;
    this.year = parsed.year;
    this.monthIndex = parsed.monthIndex;
    this.viewYear = parsed.year;
    this.sync();
  }

  get isOpen(): boolean {
    return this.popup.classList.contains('open');
  }

  close(): void {
    this.popup.classList.remove('open');
    this.input.setAttribute('aria-expanded', 'false');
  }

  private toggle(): void {
    if (this.isOpen) {
      this.close();
      return;
    }
    this.viewYear = this.year;
    this.render();
    this.popup.classList.add('open');
    this.input.setAttribute('aria-expanded', 'true');
    (
      this.grid.querySelector<HTMLButtonElement>('.selected') ??
      this.grid.querySelector<HTMLButtonElement>('[data-month]')
    )?.focus();
  }

  private shiftYear(offset: number): void {
    this.viewYear += offset;
    this.render();
  }

  private sync(): void {
    this.input.value = this.value;
    this.render();
  }

  private render(): void {
    const now = new Date();
    this.yearLabel.textContent = String(this.viewYear);
    this.grid.innerHTML = MONTHS.map((name, idx) => {
      const selected = this.year === this.viewYear && this.monthIndex === idx;
      const current = now.getFullYear() === this.viewYear && now.getMonth() === idx;
      const cls = ['dp-month-btn', selected && 'selected', current && !selected && 'current']
        .filter(Boolean)
        .join(' ');
      return `<button type="button" class="${cls}" data-month="${idx}" aria-pressed="${selected}">${name}</button>`;
    }).join('');
  }
}
