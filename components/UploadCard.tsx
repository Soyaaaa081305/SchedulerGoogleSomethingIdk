"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  ErrorBanner,
  NoticeBanner,
  Spinner,
} from "@/components/ui";
import type { ScheduleDTO, SettingsDTO } from "@/lib/types";
import { mergeDuplicateRows } from "@/lib/scheduleUtils";
import type { ParsedCourse } from "@/lib/gemini";
import { parseICS } from "@/lib/icsImport";
import { useToast } from "@/components/ToastProvider";
import UploadWizard from "@/components/UploadWizard";
import type { Row } from "@/components/CourseRowEditor";

const MAX_DIMENSION = 1600;
const IMAGE_PREPARATION_TIMEOUT_MS = 1_000;

/**
 * Downscales large photos client-side so phone snapshots fit under the 5 MB
 * upload limit and Gemini gets a crisp, reasonably sized image. Falls back to
 * the original file when decoding fails (e.g. HEIC on unsupported browsers).
 */
async function compressImage(file: File): Promise<File> {
  try {
    // Tiny images already fit comfortably under the upload limit; avoid
    // decoding them on the main thread just to learn they need no resizing.
    if (file.size <= 256_000) return file;
    if (typeof createImageBitmap === "undefined" || file.type === "image/gif") return file;
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    // Small JPEG/PNG that already fits — keep the original bytes.
    if (scale === 1 && file.size <= 1_500_000) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

async function prepareImage(file: File): Promise<File> {
  if (file.size <= 256_000) return file;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      compressImage(file),
      new Promise<File>((resolve) => {
        timeoutId = setTimeout(() => resolve(file), IMAGE_PREPARATION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function uploadImage(file: File, signal: AbortSignal): Promise<ParsedCourse[]> {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch("/api/upload", { method: "POST", body: form, signal });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Upload failed");
  }
  const data = (await res.json()) as { courses?: ParsedCourse[] };
  if (!Array.isArray(data.courses)) throw new Error("The schedule reader returned an invalid response.");
  return data.courses;
}

export default function UploadCard({
  onSaved,
  onSyncRequested,
  existing,
  settings,
  onSettingsChange,
}: {
  onSaved: (schedules: ScheduleDTO[], deferCalendarSync?: boolean) => void;
  onSyncRequested: (schedules: ScheduleDTO[]) => void;
  /** Saved classes — used to flag duplicates in the review wizard. */
  existing: ScheduleDTO[];
  settings: SettingsDTO | null;
  onSettingsChange: (s: SettingsDTO) => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadIdRef = useRef(0);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Preparing your image…");
  const [rows, setRows] = useState<Row[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      uploadIdRef.current += 1;
      uploadControllerRef.current?.abort("unmounted");
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const replacePreview = useCallback((nextUrl: string | null) => {
    const previous = previewUrlRef.current;
    previewUrlRef.current = nextUrl;
    if (previous) URL.revokeObjectURL(previous);
    setPreviewUrl(nextUrl);
  }, []);

  const clearRows = () => {
    setRows([]);
    setNotice(null);
    setError(null);
    setLoading(false);
  };

  const clearAll = () => {
    uploadIdRef.current += 1;
    uploadControllerRef.current?.abort("cancelled");
    uploadControllerRef.current = null;
    clearRows();
    replacePreview(null);
    setLoadingLabel("Preparing your image…");
    if (inputRef.current) inputRef.current.value = "";
  };

  const isIcsFile = (file: File) =>
    file.name.toLowerCase().endsWith(".ics") || file.type === "text/calendar" || file.type === "application/octet-stream";

  const handleFile = useCallback(
    async (file: File) => {
      const requestId = ++uploadIdRef.current;
      uploadControllerRef.current?.abort("replaced");
      const controller = new AbortController();
      uploadControllerRef.current = controller;
      setError(null);
      setNotice(null);
      setRows([]);
      if (file.size > 5 * 1024 * 1024) {
        setLoading(false);
        setError("File is too large. Please use a file smaller than 5 MB.");
        return;
      }

      // ICS import — parse locally, no AI needed
      if (isIcsFile(file)) {
        replacePreview(null);
        setLoading(true);
        setLoadingLabel("Reading calendar file…");
        try {
          const text = await file.text();
          if (requestId !== uploadIdRef.current) return;
          const courses = parseICS(text);
          if (courses.length === 0) {
            setError("No classes found in that .ics file. Check the file and try again.");
          } else {
            const merged = mergeDuplicateRows(courses);
            setRows(merged.map((c, i) => ({ ...c, id: `new-${i}-${Date.now()}`, selected: true })));
            setNotice(`Found ${merged.length} course${merged.length > 1 ? "s" : ""} in .ics file. Review them, then sync.`);
            toast("info", "Classes from .ics — review and sync.");
          }
        } catch (err) {
          if (requestId === uploadIdRef.current) {
            setError(err instanceof Error ? err.message : "Could not read .ics file");
          }
        } finally {
          if (requestId === uploadIdRef.current) setLoading(false);
        }
        return;
      }

      if (!file.type.startsWith("image/")) {
        setLoading(false);
        setError("That file is not an image or .ics. Upload a photo of your schedule or an .ics file.");
        return;
      }
      replacePreview(URL.createObjectURL(file));

      setLoading(true);
      setLoadingLabel("Preparing your image…");
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const toUpload = await prepareImage(file);
        if (requestId !== uploadIdRef.current) return;
        if (toUpload !== file) {
          replacePreview(URL.createObjectURL(toUpload));
        }
        setLoadingLabel("Reading your schedule…");
        timeoutId = setTimeout(() => controller.abort("timeout"), 55_000);
        const courses = await uploadImage(toUpload, controller.signal);
        if (requestId !== uploadIdRef.current) return;
        if (courses.length === 0) {
          setError("No courses were detected in that image. Try a clearer photo of your timetable.");
        } else {
          const merged = mergeDuplicateRows(courses);
          setRows(merged.map((c, i) => ({ ...c, id: `new-${i}-${Date.now()}`, selected: true })));
          const dedupNote =
            merged.length < courses.length
              ? ` (${courses.length - merged.length} duplicate${courses.length - merged.length > 1 ? "s" : ""} merged)`
              : "";
          setNotice(
            `Found ${merged.length} course${merged.length > 1 ? "s" : ""}${dedupNote}. Review them, then sync to your Google Calendar.`
          );
          toast("info", "Classes detected — review and sync in a few steps.");
        }
      } catch (err) {
        if (requestId === uploadIdRef.current) {
          if (controller.signal.reason === "timeout") {
            setError("Reading your schedule took too long. Try a smaller or clearer image, then retry.");
          } else if (controller.signal.aborted) {
            return;
          } else {
            setError(err instanceof Error ? err.message : "Upload failed");
          }
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (requestId === uploadIdRef.current) {
          setLoading(false);
          setLoadingLabel("Preparing your image…");
          if (uploadControllerRef.current === controller) uploadControllerRef.current = null;
        }
      }
    },
    [replacePreview, toast]
  );

  return (
    <Card title="Upload your schedule">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload schedule image or .ics file"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        onPaste={(e) => {
          const items = e.clipboardData?.items;
          if (!items) return;
          for (const item of items) {
            if (item.type.startsWith("image/")) {
              e.preventDefault();
              const file = item.getAsFile();
              if (file) void handleFile(file);
              break;
            }
          }
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragging
            ? "border-[#c8102e] bg-[#fdeeef]"
            : "border-zinc-300 hover:border-[#c8102e]"
        }`}
      >
        {previewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Your uploaded schedule"
              className="max-h-96 w-auto rounded-lg border border-zinc-200 shadow-sm"
            />
            <p className="text-sm font-medium text-zinc-800">
              Looking good! Click or paste another image to replace it.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-zinc-800">
              Drop a photo or .ics file here
            </p>
            <p className="text-xs text-zinc-500">
              or click to browse, or paste (Ctrl/Cmd+V) — photo, screenshot, or exported .ics
            </p>
            <div className="mt-2 flex flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screenshots/app-upload.jpg"
                alt="Example timetable photo"
                className="h-24 w-auto rounded-md border border-zinc-200 opacity-80 shadow-sm transition-opacity hover:opacity-100"
              />
              <span className="text-[11px] text-zinc-400">like this ↑</span>
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.ics,text/calendar"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {loading && (
        <div className="mt-4 flex justify-center">
          <Spinner label={loadingLabel} />
        </div>
      )}

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {notice && (
        <div className="mt-4">
          <NoticeBanner message={notice} />
          <button
            type="button"
            onClick={clearAll}
            className="mt-2 text-xs font-medium text-zinc-400 underline transition-colors hover:text-zinc-600"
          >
            Clear photo
          </button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-zinc-600">
            Your classes were read — the review screen is open. Edit anything
            that looks wrong, then confirm.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <UploadWizard
          rows={rows}
          existing={existing}
          onClose={clearRows}
          onSaved={onSaved}
          onSyncRequested={onSyncRequested}
          settings={settings}
          onSettingsChange={onSettingsChange}
        />
      )}
    </Card>
  );
}
