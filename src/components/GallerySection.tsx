import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type GalleryMedia = { url: string; type: "image" | "video" };
type GalleryProject = {
  id: string | number;
  title: string;
  description: string;
  category: string;
  location: string;
  created_at?: string;
  project_date: string | null;
  imageUrl: string;
  mediaType: "image" | "video";
  gallery: GalleryMedia[];
};

type PublicRealization = {
  id: number;
  sort_order: number;
  title: string;
  description?: string;
  category: string;
  location?: string;
  created_at?: string;
  project_date?: string | null;
  imageUrl: string;
  mime_type: string;
  gallery: GalleryMedia[];
};

const GallerySection = () => {
  const [realizations, setRealizations] = useState<GalleryProject[] | null>(null);
  const [selected, setSelected] = useState<GalleryProject | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(4);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    api<{ realizations: PublicRealization[] }>("/public/content")
      .then((content) => {
        const projects = content.realizations.map<GalleryProject>((item) => ({
          id: item.id,
          sort_order: item.sort_order,
          title: item.title,
          description: item.description || "",
          category: item.category || "",
          location: item.location || "",
          created_at: item.created_at,
          project_date: item.project_date || null,
          imageUrl: item.imageUrl,
          mediaType: item.mime_type.startsWith("video/") ? "video" : "image",
          gallery: item.gallery,
        }));
        projects.sort((a, b) => a.sort_order - b.sort_order || Number(a.id) - Number(b.id));
        setRealizations(projects);
      })
      .catch(() => setRealizations([]));
  }, []);

  const projects = realizations || [];
  const visibleProjects = projects.slice(0, visibleCount);
  const selectedMedia: GalleryMedia[] = selected
    ? [{ url: selected.imageUrl, type: selected.mediaType }, ...selected.gallery]
    : [];
  const activeMedia = selectedMedia[galleryIndex];

  const moveGallery = (direction: number) => {
    setGalleryIndex((index) => (index + direction + selectedMedia.length) % selectedMedia.length);
  };

  return (
    <section id="realisations" aria-labelledby="gallery-title" className="section-padding bg-[#f7f8f6]">
      <div className="container-custom">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: reduceMotion ? 0 : 0.45 }}
          className="mb-8 flex flex-col items-start justify-between gap-5 sm:mb-10 sm:flex-row sm:items-end"
        >
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Portfolio</span>
            <h2 id="gallery-title" className="mt-3 font-heading text-3xl font-semibold leading-tight text-foreground sm:text-4xl lg:text-5xl">Des projets réalisés</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Découvrez les réalisations publiées par l’équipe Khalil Déco Plâtre.</p>
          </div>
          <a href="#calculateur" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-[#203d2a] motion-reduce:transition-none">Parler de mon projet <ChevronRight size={16} /></a>
        </motion.div>

        {realizations === null && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:auto-rows-[220px] lg:grid-cols-4 lg:gap-5" aria-label="Chargement des réalisations">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className={`aspect-[4/3] animate-pulse bg-[#e8ebe7] motion-reduce:animate-none sm:aspect-square lg:aspect-auto ${index === 0 ? "lg:col-span-2 lg:row-span-2" : ""}`} />)}
          </div>
        )}

        {realizations !== null && (
          <>
            {projects.length > 0 ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:auto-rows-[220px] lg:grid-cols-4 lg:gap-5">
              {visibleProjects.map((project, i) => (
                <motion.button
                  type="button"
                  key={project.id}
                  onClick={() => { setGalleryIndex(0); setSelected(project); }}
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: reduceMotion ? 0 : 0.4, delay: reduceMotion ? 0 : Math.min(i, 5) * 0.04 }}
                  className={`group relative aspect-[4/3] overflow-hidden bg-[#e8ebe7] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 sm:aspect-square lg:aspect-auto ${i === 0 ? "lg:col-span-2 lg:row-span-2" : ""}`}
                >
                  {project.mediaType === "video" ? (
                    <video src={project.imageUrl} muted playsInline preload="none" className="h-full w-full object-cover" />
                  ) : (
                    <img src={project.imageUrl} alt={project.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025] motion-reduce:transition-none" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-end bg-gradient-to-t from-black/75 via-black/25 to-transparent p-4 pt-16 sm:p-5 sm:pt-20">
                    <span className="min-w-0">
                      {project.category && <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/75">{project.category}</span>}
                      <span className="block font-heading text-lg font-semibold text-white sm:text-xl">{project.title}</span>
                    </span>
                  </div>
                  <span className="absolute right-3 top-3 grid size-10 place-items-center border border-white/60 bg-black/20 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none" aria-hidden="true">
                    <ChevronRight size={18} />
                  </span>
                </motion.button>
              ))}
            </div> : <div className="mt-8 border-y border-border py-7 sm:py-8">
              <div className="max-w-2xl">
                <p className="font-heading text-xl font-medium text-foreground">Aucune réalisation publiée pour le moment.</p>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Les projets publiés par l’équipe apparaîtront ici.</p>
              </div>
            </div>}
            {visibleProjects.length < projects.length && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + 4)}
                  className="inline-flex min-h-11 items-center justify-center border border-[#ccd4cc] px-6 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:bg-white motion-reduce:transition-none"
                >
                  Voir plus
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) { setSelected(null); setGalleryIndex(0); } }}>
        <DialogContent className="max-h-[100dvh] w-screen max-w-4xl overflow-y-auto rounded-none border-[#e5e9e4] bg-white p-0 sm:max-h-[92dvh] sm:w-[calc(100vw-2rem)]">
          {selected && activeMedia && (
            <div className="grid sm:grid-cols-[1.2fr_0.8fr]">
              <div className="relative grid min-h-[45dvh] place-items-center bg-[#20231f] sm:min-h-[32rem]">
                {activeMedia.type === "video" ? (
                  <video key={activeMedia.url} src={activeMedia.url} controls autoPlay playsInline className="max-h-[70dvh] w-full object-contain" />
                ) : (
                  <img key={activeMedia.url} src={activeMedia.url} alt={selected.title} className="max-h-[70dvh] w-full object-contain" />
                )}
                {selectedMedia.length > 1 && (
                  <>
                    <button type="button" aria-label="Photo précédente" onClick={() => moveGallery(-1)} className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center bg-white/95 text-foreground"><ChevronLeft /></button>
                    <button type="button" aria-label="Photo suivante" onClick={() => moveGallery(1)} className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center bg-white/95 text-foreground"><ChevronRight /></button>
                    <span className="absolute bottom-3 right-3 bg-white/95 px-3 py-1 text-xs font-semibold text-foreground">{galleryIndex + 1} / {selectedMedia.length}</span>
                  </>
                )}
              </div>
              <div className="p-5 sm:p-8">
                <DialogHeader className="pr-10 text-left">
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent">{selected.category}</p>
                  <DialogTitle className="font-heading text-2xl text-foreground sm:text-3xl">{selected.title}</DialogTitle>
                  <DialogDescription className="leading-6">{selected.description}</DialogDescription>
                </DialogHeader>
                <dl className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
                  {selected.location && <div><dt className="font-semibold text-foreground">Lieu</dt><dd className="mt-1 text-muted-foreground">{selected.location}</dd></div>}
                  {selected.project_date && <div><dt className="font-semibold text-foreground">Date</dt><dd className="mt-1 text-muted-foreground">{new Date(selected.project_date).toLocaleDateString("fr-FR")}</dd></div>}
                  <div><dt className="font-semibold text-foreground">Galerie</dt><dd className="mt-1 text-muted-foreground">{selectedMedia.length} média{selectedMedia.length > 1 ? "s" : ""}</dd></div>
                </dl>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default GallerySection;
