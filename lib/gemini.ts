import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { normalizeDay, normalizeTime } from "@/lib/days";

export interface ParsedCourse {
  courseName: string;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
  room: string | null;
}

const MODEL = "gemini-3.6-flash";

const genAI = () => new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

function scheduleModel() {
  return genAI().getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });
}

const SCHEDULE_PROMPT = `You are an assistant that extracts class schedules from images of timetables or course schedules.

Look carefully at the image and extract EVERY course/class you can see. For each course return:
- courseName: the subject or course name (e.g. "Math 101", "Programming 1"). If the name is ambiguous, keep it short and clear.
- daysOfWeek: array of the days the class meets. Use full English words like "MONDAY" (or "TUE", "WED", "THU", "FRI", "SAT", "SUN").
- startTime and endTime: in 24-hour format "HH:MM" (e.g. "08:00", "13:30").
- room: the room/location if visible, otherwise null.

Rules:
- Only return courses you are confident about. Do not invent classes.
- If a class meets on multiple days, list all of them.
- Return JSON only, in exactly this shape:
{"courses":[{"courseName":"string","daysOfWeek":["MONDAY"],"startTime":"HH:MM","endTime":"HH:MM","room":"string or null"}]}`;

async function generateJson<T>(parts: (string | Part)[]): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const model = scheduleModel();
  const result = await model.generateContent(parts);
  const text = result.response.text();
  return JSON.parse(text) as T;
}

export async function extractScheduleFromImage(mimeType: string, base64Data: string): Promise<ParsedCourse[]> {
  const raw = await generateJson<{ courses?: Array<Record<string, unknown>> }>([
    {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    },
    { text: SCHEDULE_PROMPT },
  ]);

  const courses: ParsedCourse[] = [];
  const seen = new Set<string>();

  for (const c of raw.courses ?? []) {
    const name = typeof c.courseName === "string" ? c.courseName.trim() : "";
    if (!name) continue;

    const daysRaw =
      Array.isArray(c.daysOfWeek)
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
    const key = `${name}|${days.join(",")}|${start}|${end}`;
    if (seen.has(key)) continue;
    seen.add(key);

    courses.push({ courseName: name, daysOfWeek: days, startTime: start, endTime: end, room });
  }

  return courses;
}