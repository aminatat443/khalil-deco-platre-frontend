import { useEffect, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { useParams } from "react-router-dom";
import { SiWhatsapp } from "react-icons/si";
import { api, formatCurrency } from "@/lib/api";
import { normalizeWhatsapp, whatsappSiteMessageUrl } from "@/lib/phone";

type PublicInvoiceData = {
  invoice: {
    number: string;
    quoteNumber: string;
    status: string;
    issued_at: string;
    customer: { name: string; phone: string; whatsapp?: string; email: string; address: string };
    project: { totalArea: number; location: string; description: string; rooms: Array<{ name: string; area: number }> };
    items: Array<{ key: string; kind?: string; floorName?: string; apartmentName?: string; sectionName?: string; roomName?: string; parentRoomName?: string; ceilingTypeName?: string; label: string; unit: string; quantity: number; unitPrice: number; amount: number }>;
    totals: { subtotal: number; discount: number; total: number };
    company: { name: string; phone: string; email: string; address: string; rccm?: string; ninea?: string };
    documentSettings: { paymentTerms: string; generalTerms: string; legalText: string };
    payments: Array<{ amount: number; method: string; reference: string | null; paid_at: string }>;
    paid: number;
    remaining: number;
  };
  expiresAt: string;
};

export default function PublicInvoice() {
  const { number = "", token = "" } = useParams();
  const [data, setData] = useState<PublicInvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const endpoint = `/public/invoices/${encodeURIComponent(number)}/${encodeURIComponent(token)}`;

  useEffect(() => {
    api<PublicInvoiceData>(endpoint)
      .then(setData)
      .catch(() => setError("Ce lien de facture est invalide ou a expiré."))
      .finally(() => setLoading(false));
  }, [endpoint]);

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

  if (loading) return <main className="public-document grid min-h-screen place-items-center bg-[#f7f8f6] text-sm text-[#626c65]">Chargement de la facture…</main>;
  if (!data) return <main className="public-document grid min-h-screen place-items-center bg-[#f7f8f6] p-5"><section className="w-full max-w-lg border-t border-[#dfe5df] bg-white p-7 text-center"><h1 className="font-heading text-3xl font-semibold text-[#202923]">Lien indisponible</h1><p role="alert" className="mt-3 text-sm text-[#626c65]">{error}</p><a href="/" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#315c40]"><ArrowLeft size={16} />Retour au site</a></section></main>;

  const { invoice } = data;
  const statusColor = invoice.status === "Payée" ? "border-[#cdded0] bg-[#eef5ef] text-[#3f6948]" : "border-[#ead7c4] bg-[#fbf2e8] text-[#98643c]";
  const companyWhatsappDial = normalizeWhatsapp(invoice.company.phone, invoice.company.phone)?.dial ?? null;
  const whatsappUrl = whatsappSiteMessageUrl(
    companyWhatsappDial,
    `Bonjour, j’ai une question au sujet de la facture ${invoice.number}.`,
    typeof window === "undefined" ? "" : window.location.origin,
  );

  return <main className="public-document min-h-screen bg-[#f7f8f6] px-4 py-7 pb-20 text-[#202923] sm:px-8 sm:py-12">
    <div className="mx-auto max-w-4xl">
      <a href="/" aria-label="Retour à l’accueil de Khalil Déco Plâtre" className="inline-flex items-center gap-2 text-sm text-[#687068] hover:text-[#29352f]"><ArrowLeft size={16} /><img src="/khalil_deco_platre_logo_trans.png" alt="Khalil Déco Plâtre" className="h-14 w-auto max-w-[210px] object-contain" /></a>
      <header className="mt-7 flex flex-wrap items-start justify-between gap-4 border-b border-[#dcd9d1] pb-6"><div><p className="text-xs font-semibold tracking-[0.16em] text-[#a97850]">FACTURE DÉFINITIVE</p><h1 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">{invoice.number}</h1><p className="mt-2 text-sm text-[#72766e]">Émise le {new Date(invoice.issued_at).toLocaleDateString("fr-FR")} · Devis {invoice.quoteNumber}</p></div><span role="status" className={`border px-3 py-2 text-xs font-semibold ${statusColor}`}>{invoice.status}</span></header>

      <section className="mt-6 grid gap-6 border-b border-[#e4e1d9] pb-6 sm:grid-cols-2"><div><h2 className="text-xs font-semibold tracking-wide text-[#a97850]">FACTURÉ À</h2><p className="mt-2 font-semibold">{invoice.customer.name}</p><p className="mt-1 text-sm text-[#687068]">{invoice.customer.phone}{invoice.customer.whatsapp ? ` · WhatsApp ${invoice.customer.whatsapp}` : ""}</p>{invoice.customer.email && <p className="mt-1 text-sm text-[#687068]">{invoice.customer.email}</p>}<p className="mt-1 text-sm text-[#687068]">{invoice.customer.address}</p></div><div><h2 className="text-xs font-semibold tracking-wide text-[#a97850]">CHANTIER</h2><p className="mt-2 font-semibold">{invoice.project.location}</p><p className="mt-1 text-sm text-[#687068]">{invoice.project.totalArea} m² · {invoice.project.rooms.map((room) => room.name).join(", ")}</p><p className="mt-2 text-sm leading-6 text-[#687068]">{invoice.project.description}</p></div></section>

      <section aria-label="Détail de la facture" className="mt-6">
        <div className="space-y-3 lg:hidden">
          {invoice.items.map((item) => <article key={item.key} className="border border-[#e5e9e4] bg-white p-4">
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
            <caption className="sr-only">Détail des pièces et des tarifs de la facture {invoice.number}</caption>
            <thead className="bg-[#f4f6f3] text-[11px] uppercase tracking-wide text-[#626c65]"><tr><th className="w-[40%] px-4 py-3">Étage / Appartement / Pièce</th><th className="w-[17%] px-3 py-3 text-right">Surface</th><th className="w-[20%] px-3 py-3 text-right">Prix unitaire</th><th className="w-[23%] px-4 py-3 text-right">Montant</th></tr></thead>
            <tbody className="divide-y divide-[#edf0ed]">{invoice.items.map((item) => <tr key={item.key}><td className={`break-words px-4 py-3 ${item.kind === "bathroom" ? "pl-8" : ""}`}>{["room", "bathroom"].includes(item.kind || "") && <p className="mb-1 text-[11px] font-medium text-[#315c40]">{item.floorName} · {item.apartmentName}</p>}<span>{item.kind === "bathroom" ? `↳ ${item.roomName} de ${item.parentRoomName}` : item.roomName || item.label}</span>{item.ceilingTypeName && <p className="mt-1 text-xs text-[#626c65]">{item.ceilingTypeName}</p>}</td><td className="break-words px-3 py-3 text-right">{item.quantity} {item.unit}</td><td className="break-words px-3 py-3 text-right">{formatCurrency(item.unitPrice)}</td><td className="break-words px-4 py-3 text-right font-medium">{formatCurrency(item.amount)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="ml-auto mt-5 max-w-sm space-y-2 text-sm"><div className="flex justify-between gap-4 text-[#687068]"><span>Sous-total</span><span>{formatCurrency(invoice.totals.subtotal)}</span></div>{invoice.totals.discount > 0 && <div className="flex justify-between gap-4 text-[#687068]"><span>Remise</span><span>- {formatCurrency(invoice.totals.discount)}</span></div>}<div className="flex justify-between gap-4 border-t border-[#dcd9d1] pt-3 text-base font-semibold"><span>Total</span><span>{formatCurrency(invoice.totals.total)}</span></div><div className="flex justify-between gap-4 text-[#687068]"><span>Montant payé</span><span>{formatCurrency(invoice.paid)}</span></div><div className="flex justify-between gap-4 font-semibold"><span>Reste à payer</span><span className={invoice.remaining === 0 ? "text-[#3f6948]" : "text-[#98643c]"}>{formatCurrency(invoice.remaining)}</span></div></section>

      <section className="mt-7 grid gap-6 border-t border-[#e4e1d9] pt-6 sm:grid-cols-2"><div><h2 className="text-xs font-semibold tracking-wide text-[#a97850]">PAIEMENTS ENREGISTRÉS</h2>{invoice.payments.length ? <div className="mt-2 divide-y divide-[#efede7]">{invoice.payments.map((payment, index) => <div key={`${payment.paid_at}-${index}`} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2 text-sm"><span>{payment.method}{payment.reference ? ` · ${payment.reference}` : ""}</span><span>{new Date(payment.paid_at).toLocaleDateString("fr-FR")} · {formatCurrency(payment.amount)}</span></div>)}</div> : <p className="mt-2 text-sm text-[#85877f]">Aucun paiement enregistré.</p>}</div><div><h2 className="text-xs font-semibold tracking-wide text-[#a97850]">ÉMIS PAR</h2><p className="mt-2 font-semibold">{invoice.company.name}</p><p className="mt-1 whitespace-pre-line text-sm text-[#687068]">{[invoice.company.address, invoice.company.phone, invoice.company.email, invoice.company.rccm && `RCCM : ${invoice.company.rccm}`, invoice.company.ninea && `NINEA : ${invoice.company.ninea}`].filter(Boolean).join("\n")}</p></div></section>

      {invoice.documentSettings.paymentTerms && <p className="mt-5 whitespace-pre-line text-sm leading-6 text-[#687068]">{invoice.documentSettings.paymentTerms}</p>}{invoice.documentSettings.generalTerms && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#687068]">{invoice.documentSettings.generalTerms}</p>}{invoice.documentSettings.legalText && <p className="mt-3 whitespace-pre-line text-xs leading-5 text-[#85877f]">{invoice.documentSettings.legalText}</p>}
      {error && <p role="alert" className="mt-6 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button type="button" onClick={downloadPdf} className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#d7d4cc] bg-white px-4 py-3 text-sm font-semibold hover:bg-[#faf9f6]"><Download size={16} />Télécharger la facture PDF</button>
        {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#cbd8cd] px-4 py-3 text-sm font-semibold text-[#294b35] hover:bg-[#f0f5f0]"><SiWhatsapp size={17} />Écrire sur WhatsApp</a>}
      </div>
      <p className="mt-8 text-xs text-[#85877f]">Lien confidentiel valable jusqu’au {new Date(data.expiresAt).toLocaleDateString("fr-FR")}.</p>
    </div>
  </main>;
}