import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { normalizeDay, normalizeTime } from "@/lib/days";

export interface ParsedCourse {
  courseName: string;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
  room: string | null;
}

// Primary model first, then cheaper fallbacks — used in order if a call fails.
const MODEL_CHAIN = Array.from(
  new Set(
    [process.env.GEMINI_MODEL, "gemini-3.6-flash", "gemini-3.5-flash-lite"].filter(
      (m): m is string => Boolean(m)
    )
  )
);

const REQUEST_TIMEOUT_MS = 45_000;

const SCHEDULE_PROMPT = `You are an assistant that extracts class schedules from images of timetables or course schedules.

Look carefully at the image and extract EVERY course/class you can see. For each course return:
- courseName: the subject or course name (e.g. "Math 101", "Programming 1"). If the name is ambiguous, keep it short and clear.
- daysOfWeek: array of the days the class meets. Use full English words like "MONDAY" (or "TUE", "WED", "THU", "FRI", "SAT", "SUN").
- startTime and endTime: in 24-hour format "HH:MM" (e.g. "08:00", "13:30").
- room: the room/location if visible, otherwise null.

Rules:
- Only return courses you are confident about. Do not invent classes.
- If a class meets on multiple days, list all of them. Never list the same course at the same time on different days as separate entries — merge the days instead.
- Return JSON only, in exactly this shape:
{"courses":[{"courseName":"string","daysOfWeek":["MONDAY"],"startTime":"HH:MM","endTime":"HH:MM","room":"string or null"}]}`;

function genAIInstance(): GoogleGenerativeAI {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
}

function scheduleModel(model: string) {
  return genAIInstance().getGenerativeModel({
    model,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });
}

async function generateJson<T>(model: string, parts: (string | Part)[]): Promise<T> {
  const result = await scheduleModel(model).generateContent(parts);
  const text = result.response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("The AI returned an unreadable response.");
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("AI request timed out")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Normalizes and de-duplicates the raw AI response into ParsedCourse[]. */
export function parseCoursesResponse(raw: { courses?: Array<Record<string, unknown>> } | null | undefined): ParsedCourse[] {
  const courses: ParsedCourse[] = [];
  const seen = new Set<string>();

  for (const c of raw?.courses ?? []) {
    const name = typeof c.courseName === "string" ? c.courseName.trim() : "";
    if (!name) continue;

    const daysRaw = Array.isArray(c.daysOfWeek)
      ? c.daysOfWeek.filter((d): d is string => typeof d === "string")
      : [];

    const days: string[] = [];
    for (const d of daysRaw) {
      const norm = normalizeDay(d);
      if (norm && !days.includes(norm)) days.push(norm);
    }
    if (days.length === 0) continue;

    // Some models may output times like "8:00 AM - 9:30 AM" in a single field.
    const start = normalizeTime(typeof c.startTime === "string" ? c.startTime : "");
    const end = normalizeTime(typeof c.endTime === "string" ? c.endTime : "");
    if (!start || !end) continue;

    const room = typeof c.room === "string" && c.room.trim() ? c.room.trim() : null;
    const key = `${name.toLowerCase()}|${days.join(",")}|${start}|${end}`;
    if (seen.has(key)) continue;
    seen.add(key);

    courses.push({ courseName: name, daysOfWeek: days, startTime: start, endTime: end, room });
  }

  return courses;
}

export async function extractScheduleFromImage(mimeType: string, base64Data: string): Promise<ParsedCourse[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("[gemini] GEMINI_API_KEY is not set");
    throw new Error("AI service is not configured. Please contact the administrator.");
  }

  const parts: (string | Part)[] = [
    { inlineData: { mimeType, data: base64Data } },
    { text: SCHEDULE_PROMPT },
  ];

  let lastError: unknown = null;
  for (const model of MODEL_CHAIN) {
    try {
      const raw = await withTimeout(generateJson<{ courses?: Array<Record<string, unknown>> }>(model, parts), REQUEST_TIMEOUT_MS);
      const parsed = parseCoursesResponse(raw);
      if (parsed.length > 0) return parsed;
      // Empty result: try the next model once before giving up.
      lastError = new Error("No courses detected");
    } catch (err) {
      lastError = err;
      console.warn(`[gemini] model ${model} failed:`, err instanceof Error ? err.message : err);
    }
  }

  if (lastError instanceof Error && /No courses detected/.test(lastError.message)) {
    return [];
  }
  throw lastError instanceof Error ? lastError : new Error("The AI could not read this timetable.");
}
