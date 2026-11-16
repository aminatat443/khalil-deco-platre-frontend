import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Check, Download, LoaderCircle, MessageSquareText } from "lucide-react";
import { useParams } from "react-router-dom";
import { SiWhatsapp } from "react-icons/si";
import { api, formatCurrency } from "@/lib/api";
import { normalizeWhatsapp, whatsappSiteMessageUrl } from "@/lib/phone";

type PublicQuoteData = {
  quote: {
    number: string;
    status: string;
    createdAt: string;
    customer: { name: string; phone: string; whatsapp?: string; email: string; address: string };
    project: { totalArea: number; location: string; description: string; rooms: Array<{ name: string; area: number }> };
    items: Array<{ key: string; kind?: string; floorName?: string; apartmentName?: string; sectionName?: string; roomName?: string; parentRoomName?: string; ceilingTypeName?: string; label: string; unit: string; quantity: number; unitPrice: number; amount: number }>;
    totals: { subtotal: number; discount: number; total: number };
    company: { name: string; phone: string; email: string; address: string; rccm?: string; ninea?: string };
    documentSettings: { quoteValidityDays: number; paymentTerms: string; generalTerms: string; legalText: string };
  };
  expiresAt: string;
};

export default function PublicQuote() {
  const { number = "", token = "" } = useParams();
  const [data, setData] = useState<PublicQuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [changeMessage, setChangeMessage] = useState("");
  const endpoint = `/public/quotes/${encodeURIComponent(number)}/${encodeURIComponent(token)}`;

  useEffect(() => {
    api<PublicQuoteData>(endpoint)
      .then(setData)
      .catch(() => setError("Ce lien de devis est invalide ou a expiré."))
      .finally(() => setLoading(false));
  }, [endpoint]);

  const accept = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ status: string }>(`${endpoint}/accept`, { method: "POST" });
      setData((current) => current ? { ...current, quote: { ...current.quote, status: result.status } } : current);
      setNotice("Votre acceptation a été enregistrée. L’entreprise vous recontactera pour la suite.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L’acceptation n’a pas pu être enregistrée.");
    } finally {
      setBusy(false);
    }
  };

  const requestChange = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ status: string }>(`${endpoint}/change-request`, {
        method: "POST",
        body: JSON.stringify({ message: changeMessage }),
      });
      setData((current) => current ? { ...current, quote: { ...current.quote, status: result.status } } : current);
      setNotice("Votre demande de modification a été transmise à l’entreprise.");
      setChangeMessage("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Votre demande n’a pas pu être envoyée.");
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async () => {
    setError("");
    try {
      const pdf = await api<Blob>(`${endpoint}/pdf`);
      const url = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${number}.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le PDF n’a pas pu être téléchargé.");
    }
  };

  if (loading) return <main className="public-document grid min-h-screen place-items-center bg-[#f7f8f6] text-sm text-[#626c65]">Chargement du devis…</main>;
  if (!data) return <main className="public-document grid min-h-screen place-items-center bg-[#f7f8f6] p-5"><section className="w-full max-w-lg border-t border-[#dfe5df] bg-white p-7 text-center"><h1 className="font-heading text-3xl font-semibold text-[#202923]">Lien indisponible</h1><p role="alert" className="mt-3 text-sm text-[#626c65]">{error}</p><a href="/" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#315c40]"><ArrowLeft size={16} />Retour au site</a></section></main>;

  const { quote, expiresAt } = data;
  const canRespond = quote.status === "Devis envoyé";
  const companyWhatsappDial = normalizeWhatsapp(quote.company.phone, quote.company.phone)?.dial ?? null;
  const whatsappUrl = whatsappSiteMessageUrl(
    companyWhatsappDial,
    `Bonjour, j’ai une question au sujet du devis ${quote.number}.`,
    typeof window === "undefined" ? "" : window.location.origin,
  );

  return <main className="public-document min-h-screen bg-[#f7f8f6] px-4 py-7 pb-20 text-[#202923] sm:px-8 sm:py-12">
    <div className="mx-auto max-w-4xl">
      <a href="/" aria-label="Retour à l’accueil de Khalil Déco Plâtre" className="inline-flex items-center gap-2 text-sm text-[#687068] hover:text-[#29352f]"><ArrowLeft size={16} /><img src="/khalil_deco_platre_logo_trans.png" alt="Khalil Déco Plâtre" className="h-14 w-auto max-w-[210px] object-contain" /></a>
      <header className="mt-7 flex flex-wrap items-start justify-between gap-4 border-b border-[#dcd9d1] pb-6">
        <div><p className="text-xs font-semibold tracking-[0.16em] text-[#a97850]">PROPOSITION COMMERCIALE</p><h1 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">Devis {quote.number}</h1><p className="mt-2 text-sm text-[#72766e]">Émis le {new Date(quote.createdAt).toLocaleDateString("fr-FR")}</p></div>
        <span role="status" className="border border-[#ead7c4] bg-[#fbf2e8] px-3 py-2 text-xs font-semibold text-[#98643c]">{quote.status}</span>
      </header>

      <section className="mt-6 grid gap-6 border-b border-[#e4e1d9] pb-6 sm:grid-cols-2">
        <div><h2 className="text-xs font-semibold tracking-wide text-[#a97850]">CLIENT</h2><p className="mt-2 font-semibold">{quote.customer.name}</p><p className="mt-1 text-sm text-[#687068]">{quote.customer.phone}{quote.customer.whatsapp ? ` · WhatsApp ${quote.customer.whatsapp}` : ""}</p>{quote.customer.email && <p className="mt-1 text-sm text-[#687068]">{quote.customer.email}</p>}<p className="mt-1 text-sm text-[#687068]">{quote.customer.address}</p></div>
        <div><h2 className="text-xs font-semibold tracking-wide text-[#a97850]">CHANTIER</h2><p className="mt-2 font-semibold">{quote.project.location}</p><p className="mt-1 text-sm text-[#687068]">{quote.project.totalArea} m² · {quote.project.rooms.map((room) => room.name).join(", ")}</p><p className="mt-2 text-sm leading-6 text-[#687068]">{quote.project.description}</p></div>
      </section>

      <section aria-label="Détail du devis" className="mt-6">
        <div className="space-y-3 lg:hidden">
          {quote.items.map((item) => <article key={item.key} className="border border-[#e5e9e4] bg-white p-4">
            {["room", "bathroom"].includes(item.kind || "") && <p className="mb-2 text-[11px] font-medium text-[#315c40]">{item.floorName} · {item.apartmentName}</p>}
            <p className="break-words text-sm font-semibold">{item.kind === "bathroom" ? `↳ ${item.roomName} de ${item.parentRoomName}` : item.roomName || item.label}</p>
            {item.ceilingTypeName && <p className="mt-1 text-xs text-[#626c65]">{item.ceilingTypeName}</p>}
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-[#edf0ed] pt-3 text-xs">
              <div><dt className="text-[#737d75]">Quantité</dt><dd className="mt-1">{item.quantity} {item.unit}</dd></div>
              <div><dt className="text-[#737d75]">Prix unitaire</dt><dd className="mt-1">{formatCurrency(item.unitPrice)}</dd></div>
              <div className="col-span-2 flex justify-between gap-3 font-semibold"><dt>Montant</dt><dd className="text-right">{formatCurrency(item.amount)}</dd></div>
            </dl>
          </article>)}
        </div>
        <div className="hidden border border-[#e5e9e4] bg-white lg:block">
          <table className="w-full table-fixed text-left text-sm">
            <caption className="sr-only">Détail des pièces et des tarifs du devis {quote.number}</caption>
            <thead className="bg-[#f4f6f3] text-[11px] uppercase tracking-wide text-[#626c65]"><tr><th className="w-[40%] px-4 py-3">Étage / Appartement / Pièce</th><th className="w-[17%] px-3 py-3 text-right">Surface</th><th className="w-[20%] px-3 py-3 text-right">Prix unitaire</th><th className="w-[23%] px-4 py-3 text-right">Montant</th></tr></thead>
            <tbody className="divide-y divide-[#edf0ed]">{quote.items.map((item) => <tr key={item.key}><td className={`break-words px-4 py-3 ${item.kind === "bathroom" ? "pl-8" : ""}`}>{["room", "bathroom"].includes(item.kind || "") && <p className="mb-1 text-[11px] font-medium text-[#315c40]">{item.floorName} · {item.apartmentName}</p>}<span>{item.kind === "bathroom" ? `↳ ${item.roomName} de ${item.parentRoomName}` : item.roomName || item.label}</span>{item.ceilingTypeName && <p className="mt-1 text-xs text-[#626c65]">{item.ceilingTypeName}</p>}</td><td className="break-words px-3 py-3 text-right">{item.quantity} {item.unit}</td><td className="break-words px-3 py-3 text-right">{formatCurrency(item.unitPrice)}</td><td className="break-words px-4 py-3 text-right font-medium">{formatCurrency(item.amount)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="ml-auto mt-5 max-w-sm space-y-2 text-sm"><div className="flex justify-between gap-4 text-[#687068]"><span>Sous-total</span><span>{formatCurrency(quote.totals.subtotal)}</span></div>{quote.totals.discount > 0 && <div className="flex justify-between gap-4 text-[#687068]"><span>Remise</span><span>- {formatCurrency(quote.totals.discount)}</span></div>}<div className="flex justify-between gap-4 border-t border-[#dcd9d1] pt-3 text-base font-semibold"><span>Total estimatif</span><span className="text-[#815d3e]">{formatCurrency(quote.totals.total)}</span></div></section>

      <section className="mt-7 grid gap-6 border-t border-[#e4e1d9] pt-6 sm:grid-cols-2"><div><h2 className="text-xs font-semibold tracking-wide text-[#a97850]">ÉMIS PAR</h2><p className="mt-2 font-semibold">{quote.company.name}</p><p className="mt-1 whitespace-pre-line text-sm text-[#687068]">{[quote.company.address, quote.company.phone, quote.company.email, quote.company.rccm && `RCCM : ${quote.company.rccm}`, quote.company.ninea && `NINEA : ${quote.company.ninea}`].filter(Boolean).join("\n")}</p></div><div><h2 className="text-xs font-semibold tracking-wide text-[#a97850]">CONDITIONS</h2><p className="mt-2 text-sm leading-6 text-[#687068]">Validité : {quote.documentSettings.quoteValidityDays} jours{quote.documentSettings.paymentTerms ? `\n${quote.documentSettings.paymentTerms}` : ""}</p>{quote.documentSettings.generalTerms && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#687068]">{quote.documentSettings.generalTerms}</p>}{quote.documentSettings.legalText && <p className="mt-2 whitespace-pre-line text-xs leading-5 text-[#85877f]">{quote.documentSettings.legalText}</p>}</div></section>

      {error && <p role="alert" className="mt-6 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="mt-6 border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button type="button" onClick={downloadPdf} className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#d7d4cc] bg-white px-4 py-3 text-sm font-semibold hover:bg-[#faf9f6]"><Download size={16} />Télécharger le PDF</button>
        {canRespond && <button type="button" onClick={accept} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#293b32] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}Accepter le devis</button>}
        {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#cbd8cd] px-4 py-3 text-sm font-semibold text-[#294b35] hover:bg-[#f0f5f0]"><SiWhatsapp size={17} />Écrire sur WhatsApp</a>}
      </div>
      {canRespond && <form onSubmit={requestChange} className="mt-7 border-t border-[#e4e1d9] pt-6"><label className="block text-sm font-semibold">Demander une modification<textarea className="mt-2 min-h-24 w-full border border-[#dedbd3] bg-white p-3 text-sm outline-none focus:border-[#a97850]" minLength={5} maxLength={2000} required value={changeMessage} onChange={(event) => setChangeMessage(event.target.value)} placeholder="Indiquez les ajustements souhaités" /></label><button type="submit" disabled={busy} className="mt-3 inline-flex min-h-11 items-center gap-2 border border-[#d7d4cc] px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><MessageSquareText size={16} />Envoyer la demande</button></form>}
      <p className="mt-8 text-xs text-[#85877f]">Lien confidentiel valable jusqu’au {new Date(expiresAt).toLocaleDateString("fr-FR")}. Ne le partagez qu’avec le destinataire du devis.</p>
    </div>
  </main>;
}