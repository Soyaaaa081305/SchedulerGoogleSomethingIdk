import { NextResponse } from "next/server";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { extractSchema } from "@/lib/validators";
import { extractTasksFromText } from "@/lib/gemini";

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = await req.json();
    const parsed = extractSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, "Paste some text to analyze");

    let tasks;
    try {
      tasks = await extractTasksFromText(parsed.data.text);
    } catch (err) {
      console.error("[tasks/extract] Gemini failed:", err);
      throw new ApiError(502, "Could not extract tasks. Please try again.");
    }

    return NextResponse.json({ tasks });
  } catch (err) {
    return handleError(err);
  }
}