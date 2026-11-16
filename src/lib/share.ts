import { api } from "./api";

export type ShareOutcome =
  | { status: "shared" }
  | { status: "cancelled" }
  | { status: "unsupported" }
  | { status: "failed"; message: string };

export function nativeFileSharingAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function"
  );
}

/** Streams the server-generated PDF into memory as a real File — no download, nothing hosted. */
export async function buildDocumentFile(pdfPath: string, fileName: string): Promise<File> {
  const blob = await api<Blob>(pdfPath);
  return new File([blob], fileName, { type: "application/pdf" });
}

export function documentShareCaption(kind: "devis" | "facture", reference: string, customerName: string): string {
  const documentLabel = kind === "devis" ? "devis" : "facture";
  return `Bonjour ${customerName.trim()},\n\nVeuillez trouver ci-joint votre ${documentLabel} ${reference} de Khalil Déco Plâtre.`;
}

/** Hands the PDF and its caption to the native share sheet — never a link. */
export async function shareFileWithSheet(file: File, text?: string): Promise<ShareOutcome> {
  if (!nativeFileSharingAvailable()) return { status: "unsupported" };
  if (!navigator.canShare({ files: [file] })) return { status: "unsupported" };

  try {
    await navigator.share(text ? { files: [file], text } : { files: [file] });
    return { status: "shared" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { status: "cancelled" };
    if (error instanceof DOMException && error.name === "NotSupportedError") return { status: "unsupported" };
    return {
      status: "failed",
      message: error instanceof Error ? error.message : "Le partage du fichier a échoué.",
    };
  }
}

export function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} Mo`
    : `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}
