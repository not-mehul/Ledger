// Drives one deterministic UI scenario (seed data, add, edit, delete, sort, search, export,
// reload) against a served build of the app and writes a JSON trace of DOM, toasts,
// localStorage and the exported Markdown. Run it against the original APK bundle and the
// rebuilt source/ and diff the two traces; see README.md.
//
// Usage: [TZ_ID=Asia/Kolkata] node tools/equivalence-check.mjs <baseUrl> <outFile>
// Requires `playwright` (npm install --no-save playwright in the repo root).
import { chromium } from "playwright";
import fs from "node:fs";

const [baseUrl, outFile] = process.argv.slice(2);
const trace = [];
const snap = (label, value) => trace.push({ label, value });

const browser = await chromium.launch();
const context = await browser.newContext({ acceptDownloads: true, timezoneId: process.env.TZ_ID || "UTC" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("dialog", (d) => d.accept());
await page.clock.setFixedTime(new Date("2026-03-15T10:00:00Z"));

// Seed legacy + normal data before first load.
await page.addInitScript(() => {
  if (sessionStorage.getItem("seeded")) return;
  sessionStorage.setItem("seeded", "1");
  localStorage.setItem(
    "tlb_entries",
    JSON.stringify([
      { id: "legacy1", city: "Pune", state: "India", date: "2024-W14", score: 61.2,
        ratings: { greenery: 7, airQuality: 4, safety: 8 }, notes: "Old week format", savedAt: "2024-04-02T00:00:00Z" },
      { id: "m1", city: "Lisbon", state: "Portugal", date: "2025-06", score: 80.3,
        ratings: { greenery: 8, airQuality: 8, temperature: 9, visualBeauty: 9, cleanliness: 7, walkability: 8,
          foodQuality: 9, foodAffordability: 7, safety: 8, friendliness: 9, internet: 7, returnDesire: 9 },
        notes: "Line one\nLine <b>two</b> --> end", savedAt: "2025-06-20T00:00:00Z" },
    ]),
  );
});

const html = (sel) => page.$eval(sel, (el) => el.innerHTML);
const text = (sel) => page.$eval(sel, (el) => el.textContent);
const setSlider = (id, v) =>
  page.$eval(`#sl-${id}`, (el, v) => { el.value = String(v); el.dispatchEvent(new Event("input", { bubbles: true })); }, v);

await page.goto(baseUrl);
await page.waitForFunction(() => document.getElementById("fileStatus").textContent !== "Loading…");
snap("status", await text("#fileStatus"));
snap("badge", await text("#entryBadge"));
snap("viewNew", await html("#viewNew"));

// Fill a new entry.
await page.fill("#inputCity", "Austin");
await page.fill("#inputState", "Texas");
await page.click("#inputDate");
snap("pickerOpen", await page.$eval("#dpPopup", (el) => el.className));
await page.click("#dpPrevYear");
await page.click("#dpGrid >> text=Mar");
snap("date", await page.inputValue("#inputDate"));
for (const [id, v] of [["greenery", 9], ["airQuality", 2], ["safety", 10], ["internet", 3], ["returnDesire", 8]]) {
  await setSlider(id, v);
}
snap("scoreDisplay", await text("#scoreDisplay"));
snap("scoreDesc", await text("#scoreDesc"));
snap("scoreArc", await page.$eval("#scoreArc", (el) => [el.getAttribute("stroke"), el.getAttribute("stroke-dashoffset")]));
await page.fill("#inputNotes", "Tacos\n& <script>x</script>");
await page.click("#btnSave");
snap("toastSave", await text("#toast"));
snap("afterSaveForm", await html("#viewNew"));

// Validation path.
await page.click("#btnSave");
snap("toastValidation", await text("#toast"));

// Logbook views.
await page.click("#tabLogbook");
snap("list-date", await html("#entriesList"));
await page.click("#sortScore");
snap("list-score", await html("#entriesList"));
await page.click("#sortCity");
snap("list-city", await html("#entriesList"));
await page.fill("#searchLogbook", "tacos");
snap("list-search", await html("#entriesList"));
await page.fill("#searchLogbook", "zzz");
snap("list-nomatch", await html("#entriesList"));
await page.fill("#searchLogbook", "");
await page.click("#sortDate");

// Toggle + edit legacy entry.
await page.click('[data-action="toggle"][data-id="legacy1"]');
snap("cardOpen", await page.$eval("#card-legacy1", (el) => el.className));
await page.click('[data-action="edit"][data-id="legacy1"]');
snap("editDate", await page.inputValue("#inputDate"));
snap("editForm", await html("#viewNew"));
snap("btnSave", await text("#btnSave"));
await setSlider("cleanliness", 1);
await page.click("#btnSave");
snap("toastUpdate", await text("#toast"));

// Delete.
await page.click("#tabLogbook");
await page.click('[data-action="toggle"][data-id="m1"]');
await page.click('[data-action="delete"][data-id="m1"]');
snap("toastDelete", await text("#toast"));
snap("list-afterDelete", await html("#entriesList"));
snap("status-final", await text("#fileStatus"));

// Export.
const [download] = await Promise.all([page.waitForEvent("download"), page.click("#btnExport")]);
snap("exportName", download.suggestedFilename());
snap("export", fs.readFileSync(await download.path(), "utf8"));
snap("localStorage", await page.evaluate(() => JSON.parse(localStorage.getItem("tlb_entries"))));

// Reload persists.
await page.reload();
await page.waitForFunction(() => document.getElementById("fileStatus").textContent !== "Loading…");
snap("badgeAfterReload", await text("#entryBadge"));
snap("errors", errors);

fs.writeFileSync(outFile, JSON.stringify(trace, null, 2));
await browser.close();
console.log(`${trace.length} snapshots, ${errors.length} page errors -> ${outFile}`);
