import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDocumentFile,
  documentShareCaption,
  nativeFileSharingAvailable,
  shareFileWithSheet,
} from "@/lib/share";
import { companyCountry, normalizeWhatsapp, whatsappConversationUrl, whatsappRecipient, whatsappSiteMessageUrl } from "@/lib/phone";

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // %PDF-1.7

function setNavigatorShare(share: unknown, canShare: unknown) {
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
  Object.defineProperty(navigator, "canShare", { value: canShare, configurable: true });
}

function mockPdfEndpoint() {
  // jsdom only accepts its own Blob class when building File contents.
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => "application/pdf" },
    blob: async () => new Blob([PDF_BYTES], { type: "application/pdf" }),
  }));
}

function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe("buildDocumentFile", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the server PDF into an in-memory File without downloading it", async () => {
    const fetchMock = mockPdfEndpoint();
    vi.stubGlobal("fetch", fetchMock);

    const file = await buildDocumentFile("/admin/quotes/12/pdf", "DEV-12.pdf");

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/quotes/12/pdf", expect.objectContaining({ credentials: "include" }));
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("DEV-12.pdf");
    expect(file.type).toBe("application/pdf");
    expect(file.size).toBe(PDF_BYTES.byteLength);
    expect(await readBytes(file)).toEqual(PDF_BYTES);
  });
});

describe("shareFileWithSheet", () => {
  beforeEach(() => setNavigatorShare(undefined, undefined));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const file = () => new File([PDF_BYTES], "DEV-12.pdf", { type: "application/pdf" });

  it("reports unsupported when the browser has no native share", async () => {
    expect(nativeFileSharingAvailable()).toBe(false);
    await expect(shareFileWithSheet(file())).resolves.toEqual({ status: "unsupported" });
  });

  it("reports unsupported when the PDF cannot be attached", async () => {
    const share = vi.fn();
    setNavigatorShare(share, () => false);

    await expect(shareFileWithSheet(file())).resolves.toEqual({ status: "unsupported" });
    expect(share).not.toHaveBeenCalled();
  });

  it("shares the PDF alone, with no text and no title", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigatorShare(share, (data: ShareData) => Boolean(data.files?.length));

    await expect(shareFileWithSheet(file())).resolves.toEqual({ status: "shared" });

    expect(share).toHaveBeenCalledWith({ files: [expect.any(File)] });
    const payload = share.mock.calls[0][0];
    expect(payload.text).toBeUndefined();
    expect(payload.title).toBeUndefined();
    expect(Object.keys(payload)).toEqual(["files"]);
    expect(payload.files).toHaveLength(1);
    expect(payload.files[0].name).toBe("DEV-12.pdf");
    expect(payload.files[0].type).toBe("application/pdf");
  });

  it("shares the PDF with a customer-specific caption", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigatorShare(share, (data: ShareData) => Boolean(data.files?.length));
    const caption = documentShareCaption("devis", "DEV-12", "Aminata Diallo");

    await expect(shareFileWithSheet(file(), caption)).resolves.toEqual({ status: "shared" });

    expect(share).toHaveBeenCalledWith({
      files: [expect.any(File)],
      text: "Bonjour Aminata Diallo,\n\nVeuillez trouver ci-joint votre devis DEV-12 de Khalil Déco Plâtre.",
    });
  });

  it("creates a caption for an invoice and trims the customer name", () => {
    expect(documentShareCaption("facture", "FAC-24", "  Aminata Diallo  ")).toBe(
      "Bonjour Aminata Diallo,\n\nVeuillez trouver ci-joint votre facture FAC-24 de Khalil Déco Plâtre.",
    );
  });

  it("never turns the document into a link or an opening", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigatorShare(share, () => true);
    vi.stubGlobal("open", vi.fn());
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");

    await shareFileWithSheet(file());

    expect(JSON.stringify(share.mock.calls[0][0])).not.toMatch(/https?:|wa\.me|web\.whatsapp|share-link/);
    expect(window.open).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it("reports a user cancellation instead of an error", async () => {
    setNavigatorShare(vi.fn().mockRejectedValue(new DOMException("User dismissed", "AbortError")), () => true);

    await expect(shareFileWithSheet(file())).resolves.toEqual({ status: "cancelled" });
  });

  it("surfaces the browser message when sharing fails", async () => {
    setNavigatorShare(vi.fn().mockRejectedValue(new Error("Share target unavailable")), () => true);

    await expect(shareFileWithSheet(file())).resolves.toEqual({
      status: "failed",
      message: "Share target unavailable",
    });
  });
});

describe("numéro WhatsApp du destinataire", () => {
  const company = "+221708289273";

  it("lit tous les formats saisies avec indicatif : +221, 00221, sans +, espaces, tirets, parenthèses, points", () => {
    const expected = { dial: "221771234567", label: "+221 77 123 45 67" };
    for (const typed of [
      "+221 77 123 45 67",
      "+221771234567",
      "00221 77 123 45 67",
      "00221771234567",
      "221 77 123 45 67",
      "+221 (77) 123-45-67",
    ]) {
      expect(normalizeWhatsapp(typed, company), typed).toEqual(expected);
    }
  });

  it("complète un numéro sénégalais saisi sans indicatif, avec ou sans 0 initial", () => {
    for (const typed of ["77 123 45 67", "771234567", "(77) 123-45-67", "077 123 45 67", "77.123.45.67"]) {
      expect(normalizeWhatsapp(typed, company), typed).toEqual({ dial: "221771234567", label: "+221 77 123 45 67" });
    }
    expect(normalizeWhatsapp("70.82.89.27.3", company)).toEqual({ dial: "221708289273", label: "+221 70 828 92 73" });
    expect(normalizeWhatsapp("33 955 12 34", company)).toEqual({ dial: "221339551234", label: "+221 33 955 12 34" });
  });

  it("normalise le numéro WhatsApp de l’entreprise configuré dans l’administration", () => {
    expect(normalizeWhatsapp("+221 76 932 19 02")).toEqual({
      dial: "221769321902",
      label: "+221 76 932 19 02",
    });
    expect(whatsappConversationUrl(normalizeWhatsapp("769321902")?.dial ?? null)).toBe("https://wa.me/221769321902");
  });

  it("garde l'indicatif du client quand il vient d'un autre pays", () => {
    expect(normalizeWhatsapp("+33 6 12 34 56 78", company)).toEqual({ dial: "33612345678", label: "+33 6 12 34 56 78" });
    expect(normalizeWhatsapp("+1 415 555 2671", company)).toEqual({ dial: "14155552671", label: "+1 415 555 2671" });
    expect(companyCountry("+44 20 7946 0958")).toBe("GB");
    expect(companyCountry("708289273")).toBe("SN");
  });

  it("refuse une saisie ambiguë ou fautive au lieu d'ouvrir la mauvaise conversation", () => {
    expect(normalizeWhatsapp("78289273", company)).toBeNull();
    expect(normalizeWhatsapp("06 12 34 56 78", company)).toBeNull();
    expect(normalizeWhatsapp("5454+9+9+9", company)).toBeNull();
    expect(normalizeWhatsapp("+221 221 70 828 92 73", company)).toBeNull();
    expect(normalizeWhatsapp("", company)).toBeNull();
  });

  it("affiche le numéro international et n'envoie jamais un numéro brut à WhatsApp", () => {
    expect(whatsappRecipient("78 123 45 67", company)).toEqual({ label: "+221 78 123 45 67", dial: "221781234567" });
    expect(whatsappRecipient("78289273", company)).toEqual({ label: "78289273 — numéro incomplet", dial: null });
    expect(whatsappRecipient("06 12 34 56 78", company)).toEqual({ label: "06 12 34 56 78 — numéro invalide", dial: null });
    expect(whatsappRecipient("", company).label).toBe("numéro à préciser dans WhatsApp");
    expect(whatsappRecipient("+221 70 555 11 22", "")).toEqual({ label: "+221 70 555 11 22", dial: "221705551122" });
  });

  it("ouvre la conversation du destinataire, jamais l'accueil de WhatsApp", () => {
    expect(whatsappConversationUrl(whatsappRecipient("78 123 45 67", company).dial)).toBe("https://wa.me/221781234567");
    expect(whatsappConversationUrl(whatsappRecipient("78289273", company).dial)).toBeNull();
    expect(whatsappConversationUrl("221781234567")).not.toMatch(/web\.whatsapp|pdf|devis|facture|token|share-link/);
  });

  it("identifie les messages du site et joint l’URL seule pour son aperçu WhatsApp", () => {
    const url = whatsappSiteMessageUrl("221781234567", "  Bonjour, un devis ?  ", "https://khalil-deco.example");
    expect(url).toMatch(/^https:\/\/wa\.me\/221781234567\?text=/);
    expect(new URL(url!).searchParams.get("text")).toBe("Bonjour, un devis ?\n\nMessage envoyé depuis le site web de Khalil Déco Plâtre.\nhttps://khalil-deco.example");
    expect(whatsappSiteMessageUrl(null, "Bonjour", "https://khalil-deco.example")).toBeNull();
  });
});
