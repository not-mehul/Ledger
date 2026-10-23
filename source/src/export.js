import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { METRICS, METRIC_GROUPS } from "./metrics.js";

// 7 -> "███████░░░"
function ratingBar(value, width = 10) {
  const filled = Math.max(0, Math.min(width, Math.round(value)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

// Same as dates.js formatMonth(); the shipped bundle carries both copies.
function formatMonthForExport(value) {
  if (!value) return "";
  if (value.includes("-W")) {
    const [yearStr, weekStr] = value.split("-W");
    const year = parseInt(yearStr);
    const week = parseInt(weekStr);
    const jan4 = new Date(year, 0, 4);
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1 + (week - 1) * 7);
    value = monday.toISOString().split("T")[0];
  }
  const parts = value.split("-");
  return parts.length >= 2
    ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1).toLocaleDateString(
        "en-US",
        { year: "numeric", month: "long" },
      )
    : value;
}

function buildMarkdown(entries) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const iso = now.toISOString();

  let md = `# ✈️ Travel Logbook\n`;
  md += `*A record of cities visited, their character, and your place in them.*\n\n`;
  md += `> **Total cities logged:** ${entries.length}\n`;
  md += `> **Exported:** ${dateStr} · ${timeStr}\n`;
  md += `<!-- exportedAt:${iso} -->\n\n`;
  md += `---\n\n`;

  [...entries]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((entry) => {
      const dot = entry.score >= 85 ? "🟢" : entry.score >= 65 ? "🟡" : "🔴";
      md += `## ${entry.city} · ${entry.state}\n`;
      md += `*${formatMonthForExport(entry.date)} · ${dot} Score: **${entry.score}** / 100*\n\n`;
      md += `<!-- data:${JSON.stringify(entry)} -->\n\n`;
      METRIC_GROUPS.forEach((group) => {
        md += `### ${group.label}\n`;
        md += `| Metric | Rating | Weight |\n`;
        md += `|--------|--------|--------|\n`;
        group.ids.forEach((id) => {
          const metric = METRICS.find((m) => m.id === id);
          const rating = entry.ratings[id] ?? 5;
          md += `| ${metric.label} | \`${ratingBar(rating)}\` ${rating}/10 | ×${metric.weight} |\n`;
        });
        md += `\n`;
      });
      if (entry.notes) {
        md += `### Notes\n> ${entry.notes.replace(/\n/g, "\n> ")}\n\n`;
      }
      md += `---\n\n`;
    });

  return md;
}

// Web: triggers a browser download. Native: writes Download/logbook.md on
// external storage, falling back to the app's external files directory.
export async function exportLogbook(entries, notify) {
  const markdown = buildMarkdown(entries);

  if (!Capacitor.isNativePlatform()) {
    const link = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([markdown], { type: "text/markdown" })),
      download: "logbook.md",
    });
    link.click();
    URL.revokeObjectURL(link.href);
    notify?.("logbook.md downloaded.", "success");
    return { ok: true, path: "browser-download" };
  }

  try {
    if (
      (await Filesystem.checkPermissions()).publicStorage !== "granted" &&
      (await Filesystem.requestPermissions()).publicStorage !== "granted"
    ) {
      notify?.(
        'Storage permission denied. Grant "All files access" in Settings.',
        "error",
      );
      return { ok: false, reason: "permission-denied" };
    }
  } catch {}

  try {
    const result = await Filesystem.writeFile({
      path: "Download/logbook.md",
      data: markdown,
      directory: Directory.ExternalStorage,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    notify?.("Saved to Downloads/logbook.md", "success");
    return { ok: true, path: result.uri };
  } catch (primaryErr) {
    console.warn("Primary export failed, falling back:", primaryErr);
    try {
      const result = await Filesystem.writeFile({
        path: "logbook.md",
        data: markdown,
        directory: Directory.External,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      notify?.(
        `Saved to app storage (${result.uri.split("/").slice(-3).join("/")}). Grant "All files access" to save to Downloads.`,
        "success",
      );
      return { ok: true, path: result.uri, fallback: true };
    } catch (fallbackErr) {
      console.error("Fallback export failed:", fallbackErr);
      notify?.(
        "Export failed: " +
          (fallbackErr.message || primaryErr.message || "unknown"),
        "error",
      );
      return { ok: false, reason: "write-failed" };
    }
  }
}
