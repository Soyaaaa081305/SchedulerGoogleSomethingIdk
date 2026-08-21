"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  ErrorBanner,
  NoticeBanner,
  Spinner,
} from "@/components/ui";
import type { ScheduleDTO, SettingsDTO } from "@/lib/types";
import type { ParsedCourse } from "@/lib/gemini";
import { useToast } from "@/components/ToastProvider";
import UploadWizard from "@/components/UploadWizard";
import type { Row } from "@/components/CourseRowEditor";

const PREVIEW_KEY = "scheduler-upload-preview";

async function uploadImage(file: File): Promise<ParsedCourse[]> {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Upload failed");
  }
  const data = (await res.json()) as { courses: ParsedCourse[] };
  return data.courses;
}

function readSavedPreview(): string | null {
  try {
    return localStorage.getItem(PREVIEW_KEY);
  } catch {
    return null;
  }
}

function savePreview(dataUrl: string) {
  try {
    localStorage.setItem(PREVIEW_KEY, dataUrl);
  } catch {
    // private mode or full — ignore
  }
}

function clearSavedPreview() {
  try {
    localStorage.removeItem(PREVIEW_KEY);
  } catch {
    // ignore
  }
}

export default function UploadCard({
  onSaved,
  settings,
  onSettingsChange,
}: {
  onSaved: (s: ScheduleDTO) => void;
  settings: SettingsDTO | null;
  onSettingsChange: (s: SettingsDTO) => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => readSavedPreview());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const clearRows = () => {
    setRows([]);
    setNotice(null);
    setError(null);
    setLoading(false);
  };

  const clearAll = () => {
    clearRows();
    if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    clearSavedPreview();
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setNotice(null);
      if (!file.type.startsWith("image/")) {
        setError("That file is not an image. Upload a photo or screenshot of your schedule.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Image is too large. Please use a file smaller than 5 MB.");
        return;
      }
      if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);

      const blobUrl = URL.createObjectURL(file);
      setPreviewUrl(blobUrl);

      try {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        savePreview(dataUrl);
      } catch {
        // non-critical — ignore
      }

      setLoading(true);
      try {
        const courses = await uploadImage(file);
        if (courses.length === 0) {
          setError("No courses were detected in that image. Try a clearer photo of your timetable.");
        } else {
          setRows(courses.map((c, i) => ({ ...c, id: `new-${i}-${Date.now()}`, selected: true })));
          setNotice(
            `Found ${courses.length} course${courses.length > 1 ? "s" : ""}. Review them in the next steps, then they'll sync to your Google Calendar.`
          );
          toast("info", "Classes detected — review and sync in a few steps.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setLoading(false);
      }
    },
    [previewUrl, toast]
  );

  return (
    <Card title="Upload your schedule">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload schedule image"
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
              Drop a photo of your class schedule here
            </p>
            <p className="text-xs text-zinc-500">
              or click to browse, or just paste (Ctrl/Cmd + V) — a photo or
              screenshot of your timetable works best
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
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
          <Spinner label="Reading your schedule…" />
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
          onClose={clearRows}
          onSaved={onSaved}
          settings={settings}
          onSettingsChange={onSettingsChange}
          onCleared={clearRows}
        />
      )}
    </Card>
  );
}