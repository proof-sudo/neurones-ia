import { requireView } from "@/lib/session";
import { backendFetch } from "@/lib/backend";
import { ErrorState } from "@/components/ui/ErrorState";
import { DocumentsView } from "@/components/views/DocumentsView";
import type { GedCategory, GedFile, GedStatus, QuarantineEntry } from "@/lib/api/documents";

export default async function DocumentsPage() {
  await requireView("documents");

  const [treeResult, statusResult, filesResult, quarantineResult] = await Promise.allSettled([
    backendFetch<{ categories: GedCategory[] }>("/v1/ged/tree"),
    backendFetch<GedStatus>("/v1/ged/status"),
    backendFetch<{ files: GedFile[]; total: number }>("/v1/ged/files"),
    backendFetch<{ quarantine: QuarantineEntry[]; total: number; retention_days: number }>("/v1/ged/quarantine"),
  ]);

  if (treeResult.status === "rejected" || statusResult.status === "rejected") {
    const err = treeResult.status === "rejected" ? treeResult.reason : statusResult.status === "rejected" ? statusResult.reason : null;
    return (
      <ErrorState
        title="Documents (GED) indisponible"
        error={err instanceof Error ? err.message : null}
      />
    );
  }

  return (
    <DocumentsView
      initialCategories={treeResult.value.categories}
      initialStatus={statusResult.value}
      initialFiles={filesResult.status === "fulfilled" ? filesResult.value.files : []}
      initialQuarantine={quarantineResult.status === "fulfilled" ? quarantineResult.value.quarantine : []}
      initialRetentionDays={quarantineResult.status === "fulfilled" ? quarantineResult.value.retention_days : 7}
    />
  );
}
