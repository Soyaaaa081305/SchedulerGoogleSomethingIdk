import type { ParsedCourse } from "@/lib/gemini";

const RRULE_BYDAY: Record<string, string> = {
  MO: "MON",
  TU: "TUE",
  WE: "WED",
  TH: "THU",
  FR: "FRI",
  SA: "SAT",
  SU: "SUN",
};

function unescapeText(v: string): string {
  return v.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function parseIcsTime(value: string): string | null {
  // value like 20250824T083000 or 20250824T083000Z or 083000
  const m = value.match(/T?(\d{2})(\d{2})(\d{2})?/);
  if (!m) return null;
  const h = m[1];
  const min = m[2];
  if (Number(h) > 23 || Number(min) > 59) return null;
  return `${h}:${min}`;
}

function parseByDay(rrule: string): string[] {
  const m = rrule.match(/BYDAY=([^;]+)/i);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((d) => RRULE_BYDAY[d.trim().toUpperCase()] ?? "")
    .filter(Boolean);
}

export function parseICS(icsText: string): ParsedCourse[] {
  // Unfold: lines starting with space/tab are continuations
  const unfolded = icsText.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const events: ParsedCourse[] = [];
  let cur: Record<string, string> | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "BEGIN:VEVENT") {
      cur = {};
    } else if (line === "END:VEVENT" && cur) {
      const summary = cur["SUMMARY"] ? unescapeText(cur["SUMMARY"]) : "";
      const location = cur["LOCATION"] ? unescapeText(cur["LOCATION"]) : null;
      const dtstart = cur["DTSTART"] ?? "";
      const dtend = cur["DTEND"] ?? "";
      const rrule = cur["RRULE"] ?? "";

      const startTime = parseIcsTime(dtstart);
      const endTime = parseIcsTime(dtend);
      if (!summary || !startTime || !endTime) {
        cur = null;
        continue;
      }

      let daysOfWeek = parseByDay(rrule);
      // Fallback: if no BYDAY, derive from DTSTART weekday? Use start date's day?
      // For now leave empty - validators will catch, but we try to infer from DTSTART date
      if (daysOfWeek.length === 0 && dtstart) {
        // DTSTART like 20250824T083000 - try to get weekday from date part
        const datePart = dtstart.match(/(\d{4})(\d{2})(\d{2})/);
        if (datePart) {
          const d = new Date(`${datePart[1]}-${datePart[2]}-${datePart[3]}T00:00:00`);
          if (!Number.isNaN(d.getTime())) {
            const idx = d.getUTCDay(); // 0 Sun
            const map = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
            daysOfWeek = [map[idx]];
          }
        }
      }

      events.push({
        courseName: summary,
        daysOfWeek,
        startTime,
        endTime,
        room: location || null,
      });
      cur = null;
    } else if (cur !== null) {
      const sep = line.indexOf(":");
      if (sep === -1) continue;
      const keyPart = line.slice(0, sep);
      const value = line.slice(sep + 1);
      const key = keyPart.split(";")[0].toUpperCase();
      // Keep first occurrence; for DTSTART with TZID we store value
      if (!cur[key]) cur[key] = value;
    }
  }

  // Merge same course+time into one with unioned days (like scheduleUtils)
  const merged: ParsedCourse[] = [];
  for (const e of events) {
    const twin = merged.find((m) => m.courseName.toLowerCase() === e.courseName.toLowerCase() && m.startTime === e.startTime && m.endTime === e.endTime);
    if (twin) {
      for (const d of e.daysOfWeek) if (!twin.daysOfWeek.includes(d)) twin.daysOfWeek.push(d);
    } else {
      merged.push({ ...e, daysOfWeek: [...e.daysOfWeek] });
    }
  }

  return merged;
}
