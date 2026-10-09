import { notFound } from "next/navigation";
import PreviewSettings from "./preview-settings";

export const dynamic = "force-dynamic";

export default function E2ESettingsPreviewPage() {
  if (process.env.NODE_ENV !== "development" || process.env.E2E_TEST_MODE !== "true") {
    notFound();
  }
  return <PreviewSettings />;
}
