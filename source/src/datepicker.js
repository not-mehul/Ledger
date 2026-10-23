import { isoWeekToDate } from "./dates.js";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const dateInput = () => document.getElementById("inputDate");
const popup = () => document.getElementById("dpPopup");
const grid = () => document.getElementById("dpGrid");

let viewYear = new Date().getFullYear();
let selectedMonth = new Date().getMonth();
let selectedYear = new Date().getFullYear();

export function initDatePicker() {
  dateInput().value = formatYearMonth(selectedYear, selectedMonth);
  renderPicker();
  dateInput().addEventListener("click", (e) => {
    popup().classList.toggle("open");
    e.stopPropagation();
  });
  document.addEventListener("click", (e) => {
    if (!popup().contains(e.target) && e.target !== dateInput()) {
      popup().classList.remove("open");
    }
  });
}

function renderPicker() {
  const container = grid();
  container.innerHTML = "";
  document.getElementById("dpYearLabel").textContent = viewYear;
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  MONTH_NAMES.forEach((name, i) => {
    const btn = document.createElement("div");
    btn.className = "dp-month-btn";
    btn.textContent = name;
    const isSelected = selectedYear === viewYear && selectedMonth === i;
    const isCurrent = currentYear === viewYear && currentMonth === i;
    if (isSelected) btn.classList.add("selected");
    if (isCurrent && !isSelected) btn.classList.add("current");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      selectedYear = viewYear;
      selectedMonth = i;
      dateInput().value = formatYearMonth(selectedYear, selectedMonth);
      popup().classList.remove("open");
      renderPicker();
    });
    container.appendChild(btn);
  });
}

export function shiftYear(delta) {
  viewYear += delta;
  renderPicker();
}

export function formatYearMonth(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function setPickerValue(value) {
  if (!value) return;
  if (value.includes("-W")) value = isoWeekToDate(value);
  const parts = value.split("-");
  if (parts.length >= 2) {
    selectedYear = parseInt(parts[0]);
    selectedMonth = parseInt(parts[1]) - 1;
    viewYear = selectedYear;
    dateInput().value = formatYearMonth(selectedYear, selectedMonth);
    renderPicker();
  }
}
