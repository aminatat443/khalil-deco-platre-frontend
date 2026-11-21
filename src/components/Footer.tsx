import { Phone, Mail, MapPin } from "lucide-react";

const Footer = () => {
  return (
    <footer id="contact" className="bg-[#18231c] text-white">
      <div className="container-custom section-padding pb-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_1fr] lg:gap-16">
          <div>
            <a href="#accueil" className="inline-flex items-center gap-3" aria-label="Khalil Déco Plâtre, retour en haut">
              <img src="/khalil_deco_platre_logo_trans.png" alt="" width="180" height="64" loading="lazy" className="h-14 w-auto max-w-[200px] object-contain" />
            </a>
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/65">
              Décoration en plâtre, moulures et faux plafonds modernes depuis plus de 10 ans.
            </p>
            <a href="#calculateur" className="mt-6 inline-flex min-h-11 items-center border border-white/30 px-4 text-sm font-medium transition-colors hover:border-white hover:bg-white/5 motion-reduce:transition-none">
              Estimer mon projet
            </a>
          </div>

          <nav aria-label="Navigation secondaire">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Explorer</h2>
            <ul className="mt-4 space-y-3 text-sm text-white/75">
              <li><a className="transition-colors hover:text-white motion-reduce:transition-none" href="#realisations">Réalisations</a></li>
              <li><a className="transition-colors hover:text-white motion-reduce:transition-none" href="#apropos">Notre approche</a></li>
              <li><a className="transition-colors hover:text-white motion-reduce:transition-none" href="#avis">Avis clients</a></li>
            </ul>
          </nav>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Contact</h2>
            <ul className="mt-4 space-y-4 text-sm text-white/75">
              <li>
                <a className="inline-flex min-h-10 items-center gap-3 transition-colors hover:text-white motion-reduce:transition-none" href="tel:+221769321902">
                  <Phone size={16} className="shrink-0 text-[#b8cdbb]" />
                  +221 76 932 19 02
                </a>
              </li>
              <li>
                <a className="inline-flex min-h-10 items-center gap-3 break-all transition-colors hover:text-white motion-reduce:transition-none" href="mailto:contact@khalildecoplâtre.com">
                  <Mail size={16} className="shrink-0 text-[#b8cdbb]" />
                  contact@khalildecoplâtre.com
                </a>
              </li>
              <li className="inline-flex min-h-10 items-center gap-3">
                <MapPin size={16} className="shrink-0 text-[#b8cdbb]" />
                Dakar, Sénégal
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Khalil Déco Plâtre. Tous droits réservés.
          </p>
          <a href="#accueil" className="min-h-10 inline-flex items-center text-white/65 hover:text-white">Retour en haut ↑</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
