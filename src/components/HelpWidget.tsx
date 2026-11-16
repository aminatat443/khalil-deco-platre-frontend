import { useEffect, useState, type FormEvent } from "react";
import { Send, X } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import { normalizeWhatsapp, whatsappSiteMessageUrl } from "@/lib/phone";

type PublicCompany = { name: string; phone: string; whatsapp: string };

export default function HelpWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState<PublicCompany | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    api<PublicCompany>("/public/company").then(setCompany).catch(() => setCompany(null));
  }, []);

  if (location.pathname.startsWith("/admin")) return null;

  // The setting may hold "708289273" or "+221 70 828 92 73": wa.me needs the full international digits.
  const whatsappDial = company ? normalizeWhatsapp(company.whatsapp || company.phone, company.whatsapp)?.dial ?? null : null;
  function sendMessage(event: FormEvent) {
    event.preventDefault();
    const url = whatsappSiteMessageUrl(whatsappDial, draft, window.location.origin);
    if (!url || !draft.trim()) return;
    window.open(url, "_blank", "noopener,noreferrer");
    setDraft("");
    setOpen(false);
  }

  return <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.75rem)] right-3 z-50 flex flex-col items-end gap-3 sm:right-6">
    {open && <section aria-label="Écrire sur WhatsApp" className="flex max-h-[calc(100dvh-6rem-env(safe-area-inset-bottom))] w-[min(92vw,360px)] flex-col overflow-y-auto overscroll-contain border border-[#e4e9e3] bg-white shadow-[0_14px_38px_-24px_rgba(25,35,28,0.5)]">
      <header className="flex items-center justify-between gap-3 bg-[#1f7a4d] px-4 py-3.5 text-white">
        <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center bg-white/15"><SiWhatsapp size={19} /></span><div><p className="text-sm font-semibold">WhatsApp</p><p className="mt-0.5 text-[11px] text-white/75">{company?.name || "Khalil Déco Plâtre"}</p></div></div>
        <button type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center text-white/80 hover:bg-white/10" aria-label="Fermer"><X size={18} /></button>
      </header>
      {whatsappDial ? <form onSubmit={sendMessage} className="flex items-end gap-2 p-3">
        <textarea aria-label="Votre message WhatsApp" rows={3} maxLength={1500} autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Écrivez votre message…" className="max-h-32 min-h-11 flex-1 resize-y border border-[#dedbd3] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1f7a4d]" />
        <button type="submit" disabled={!draft.trim()} aria-label="Envoyer sur WhatsApp" className="grid size-11 shrink-0 place-items-center bg-[#1f7a4d] text-white transition hover:bg-[#25894f] disabled:cursor-not-allowed disabled:opacity-45"><Send size={17} /></button>
      </form> : <p className="p-4 text-xs leading-5 text-[#72766e]">Ajoutez le numéro WhatsApp dans la configuration de l’entreprise pour activer ce contact.</p>}
    </section>}

    <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label={open ? "Fermer WhatsApp" : "Écrire sur WhatsApp"} title="WhatsApp" className="grid size-12 place-items-center rounded-full bg-[#1f7a4d] text-white shadow-[0_8px_24px_-12px_rgba(25,35,28,0.55)] transition-colors hover:bg-[#25633f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f7a4d] motion-reduce:transition-none sm:size-14"><SiWhatsapp size={25} /></button>
  </div>;
}
