import { useState, useEffect } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";

const navLinks = [
  { label: "Réalisations", href: "#realisations" },
  { label: "Notre approche", href: "#apropos" },
  { label: "Contact", href: "#contact" },
];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "border-b border-[#e7eae5] bg-white/95 shadow-[0_8px_24px_-22px_rgba(27,39,31,0.5)] backdrop-blur-md"
          : "bg-gradient-to-b from-black/35 to-transparent"
      }`}
    >
      <div className="container-custom flex h-16 items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
        <a href="#accueil" aria-label="Khalil Déco Plâtre, accueil" className="flex min-w-0 items-center">
          <img src="/khalil_deco_platre_logo_trans.png" alt="Khalil Déco Plâtre" width="180" height="64" className="h-14 w-auto max-w-[190px] object-contain sm:h-16 sm:max-w-[220px]" />
        </a>

        <div className="hidden items-center gap-5 lg:flex xl:gap-7">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-[13px] font-medium transition-colors motion-reduce:transition-none ${
                scrolled ? "text-[#334139] hover:text-[#315c40]" : "text-white/90 hover:text-white"
              }`}
            >
              {link.label}
            </a>
          ))}
          <a href="#calculateur" className={`inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold transition-colors motion-reduce:transition-none ${scrolled ? "bg-[#294b35] text-white hover:bg-[#203d2a]" : "bg-white text-[#24352a] hover:bg-white/90"}`}>
            Demander un devis <ArrowUpRight size={15} />
          </a>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={mobileOpen}
          aria-controls="navigation-mobile"
          className={`grid size-11 shrink-0 place-items-center transition-colors motion-reduce:transition-none lg:hidden ${scrolled || mobileOpen ? "text-[#26362b]" : "text-white"}`}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div id="navigation-mobile" className="border-t border-[#e7eae5] bg-white px-4 pb-5 pt-2 shadow-[0_18px_28px_-28px_rgba(27,39,31,0.6)] lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="flex min-h-12 items-center border-b border-[#eef0ec] text-sm font-medium text-[#334139] transition-colors hover:text-[#315c40] motion-reduce:transition-none"
              >
                {link.label}
              </a>
            ))}
            <a href="#calculateur" onClick={() => setMobileOpen(false)} className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 bg-[#294b35] px-4 text-sm font-semibold text-white">
              Demander un devis <ArrowUpRight size={16} />
            </a>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
