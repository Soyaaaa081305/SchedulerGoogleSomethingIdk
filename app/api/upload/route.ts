import { NextResponse } from "next/server";
import { extractScheduleFromImage } from "@/lib/gemini";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { rateLimit } from "@/lib/rateLimit";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const userId = await requireUser();

    if (!rateLimit(`upload:${userId}`, { maxRequests: 5, windowMs: 60_000 })) {
      throw new ApiError(429, "Too many uploads. Please wait a minute and try again.");
    }

    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      throw new ApiError(400, "Missing image file");
    }
    if (!file.type.startsWith("image/")) {
      throw new ApiError(400, "Uploaded file must be an image");
    }
    if (file.size > MAX_BYTES) {
      throw new ApiError(400, "Image is too large (max 5 MB)");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    let courses;
    try {
      courses = await extractScheduleFromImage(file.type, base64);
    } catch (err) {
      console.error("[upload] Gemini failed:", err);
      throw new ApiError(502, "Could not read your schedule. Try a clearer photo of the timetable.");
    }

    return NextResponse.json({ courses });
  } catch (err) {
    return handleError(err);
  }
}