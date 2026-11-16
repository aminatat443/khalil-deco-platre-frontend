import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Calculator, ClipboardList, Ruler } from "lucide-react";

const reasons = [
  { icon: Ruler, title: "Pensé pour votre pièce", desc: "Chaque projet est étudié selon les dimensions de la pièce et le style souhaité." },
  { icon: Calculator, title: "Une estimation claire", desc: "Le calcul s’appuie sur les tarifs et les modèles configurés par l’entreprise." },
  { icon: ClipboardList, title: "Mesures confirmées", desc: "Les dimensions restent modifiables après la visite technique." },
];

const WhyUsSection = () => {
  const reduceMotion = useReducedMotion();

  return (
    <section id="apropos" aria-labelledby="about-title" className="section-padding bg-white">
      <div className="container-custom">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: reduceMotion ? 0 : 0.45 }}
            className="max-w-xl"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Notre savoir-faire</span>
            <h2 id="about-title" className="mt-4 font-heading text-4xl font-medium leading-[1.05] text-foreground sm:text-5xl lg:text-6xl">
              Le plâtre donne du relief à vos espaces.
            </h2>
            <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground">
              Khalil Déco Plâtre met son savoir-faire artisanal au service de plafonds décoratifs, de moulures et de finitions intérieures.
            </p>
            <a href="#calculateur" className="group mt-7 inline-flex min-h-11 items-center gap-3 border-b border-primary pb-2 text-sm font-semibold text-primary transition-colors hover:text-[#203d2a] motion-reduce:transition-none">
              Estimer mon projet <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" />
            </a>
          </motion.div>

          <div>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: reduceMotion ? 0 : 0.4 }}
              className="flex items-end gap-5 border-y border-border py-6 sm:py-8"
            >
              <span className="font-heading text-7xl font-medium leading-none text-primary sm:text-8xl">10+</span>
              <p className="max-w-xs pb-1 text-sm leading-6 text-muted-foreground">
                années d’expérience dans le travail du plâtre décoratif
              </p>
            </motion.div>
            <div className="grid gap-x-10 sm:grid-cols-2">
            {reasons.map((r, i) => (
            <motion.div
              key={r.title}
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: reduceMotion ? 0 : 0.4, delay: reduceMotion ? 0 : i * 0.04 }}
              className="border-b border-border py-5 sm:py-6"
            >
              <div className="mb-3 flex items-center gap-3 text-primary">
                <r.icon className="size-4" aria-hidden="true" />
                <span className="text-[11px] font-semibold tracking-[0.16em]">0{i + 1}</span>
              </div>
              <h3 className="font-heading text-xl font-medium text-foreground">{r.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{r.desc}</p>
            </motion.div>
          ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyUsSection;
