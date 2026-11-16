import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import heroCeiling1 from "@/assets/hero-ceiling.jpg";
import heroCeiling2 from "@/assets/hero-ceiling-2.jpg";
import heroCeiling3 from "@/assets/hero-ceiling-3.jpg";
import { api } from "@/lib/api";

const slides = [heroCeiling1, heroCeiling2, heroCeiling3];
type ContentSlide = {
  mediaUrl: string;
  mediaType: "image" | "video";
  title: string;
  description: string;
  button_text: string;
  button_url: string;
};

const mediaPreloads = new Map<string, Promise<boolean>>();
function preloadMedia(slide: ContentSlide): Promise<boolean> {
  const key = slide.mediaType + ":" + slide.mediaUrl;
  const cached = mediaPreloads.get(key);
  if (cached) return cached;
  const loading = new Promise<boolean>((resolve) => {
    let settled = false;
    let timeout = 0;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(ready);
    };
    timeout = window.setTimeout(() => finish(false), 10000);
    if (slide.mediaType === "video") {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.oncanplay = () => finish(true);
      video.onerror = () => finish(false);
      video.src = slide.mediaUrl;
      video.load();
    } else {
      const image = new Image();
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      image.src = slide.mediaUrl;
      if (image.complete) finish(image.naturalWidth > 0);
    }
  });
  mediaPreloads.set(key, loading);
  return loading;
}

const fallbackSlide = (mediaUrl: string): ContentSlide => ({
  mediaUrl,
  mediaType: "image",
  title: "",
  description: "",
  button_text: "",
  button_url: "",
});

const HeroSection = () => {
  const [current, setCurrent] = useState(0);
  const [contentSlides, setContentSlides] = useState<ContentSlide[]>([]);
  const [failedMedia, setFailedMedia] = useState<Set<string>>(() => new Set());
  const displaySlides: ContentSlide[] = contentSlides.length
    ? contentSlides
    : slides.map(fallbackSlide);
  const activeIndex = current % displaySlides.length;
  const activeSlide = displaySlides[activeIndex];
  const backgroundSlide = failedMedia.has(activeSlide.mediaUrl)
    ? fallbackSlide(heroCeiling1)
    : activeSlide;

  useEffect(() => {
    let mounted = true;
    api<{ slides: ContentSlide[] }>("/public/content")
      .then(async (content) => {
        const firstSlide = content.slides[0];
        if (firstSlide && !(await preloadMedia(firstSlide))) {
          setFailedMedia((previous) => new Set(previous).add(firstSlide.mediaUrl));
        }
        if (mounted && content.slides.length) setContentSlides(content.slides);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Change immediately on click: waiting for a slow image/video made the arrows look broken.
  const goTo = useCallback((index: number) => {
    const slideCount = displaySlides.length;
    setCurrent(((index % slideCount) + slideCount) % slideCount);
  }, [displaySlides.length]);

  const next = useCallback(() => {
    const slideCount = displaySlides.length;
    setCurrent((index) => (index + 1) % slideCount);
  }, [displaySlides.length]);
  const prev = useCallback(() => {
    const slideCount = displaySlides.length;
    setCurrent((index) => (index - 1 + slideCount) % slideCount);
  }, [displaySlides.length]);

  useEffect(() => {
    const upcoming = displaySlides[(activeIndex + 1) % displaySlides.length];
    preloadMedia(upcoming).then((ready) => {
      if (!ready) setFailedMedia((previous) => new Set(previous).add(upcoming.mediaUrl));
    });
  }, [activeIndex, displaySlides]);

  useEffect(() => {
    const interval = window.setInterval(next, 5000);
    return () => window.clearInterval(interval);
  }, [next]);

  return (
    <section id="accueil" className="hero-viewport relative flex items-center overflow-hidden bg-[#20231f]">
      <AnimatePresence initial={false}>
        <motion.div
          key={backgroundSlide.mediaType + ":" + backgroundSlide.mediaUrl}
          initial={{ opacity: 0, scale: 1.015 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.85, ease: "easeInOut" }}
          className="pointer-events-none absolute inset-0"
        >
          {backgroundSlide.mediaType === "video" ? (
            <video
              src={backgroundSlide.mediaUrl}
              autoPlay
              muted
              loop
              playsInline
              onError={() => setFailedMedia((previous) => new Set(previous).add(activeSlide.mediaUrl))}
              className="h-full w-full object-cover"
            />
          ) : (
            <img
              src={backgroundSlide.mediaUrl}
              alt=""
              aria-hidden="true"
              onError={() => {
                if (backgroundSlide.mediaUrl !== heroCeiling1) {
                  setFailedMedia((previous) => new Set(previous).add(activeSlide.mediaUrl));
                }
              }}
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div className="hero-content relative z-10 container-custom w-full px-4 sm:px-6 lg:px-8">
        <motion.div
          key={activeSlide.mediaUrl}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="mx-10 max-w-2xl sm:mx-12 lg:mx-16"
        >
          <span className="mb-3 inline-block text-xs font-body uppercase tracking-[0.2em] text-[#f0d7b2] drop-shadow-[0_1px_5px_rgba(0,0,0,0.8)] sm:mb-5 sm:text-sm sm:tracking-[0.3em]">
            Artisan du plâtre depuis plus de 10 ans
          </span>

          <h1 className="mb-4 font-heading text-[clamp(1.4rem,6.8vw,2.1rem)] font-bold leading-[1.12] text-primary-foreground drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)] sm:mb-6 sm:text-[clamp(2.4rem,7.5vh,5.5rem)] sm:leading-[1.1]">
            {activeSlide.title || (
              <>
                Donnez du caractère à votre intérieur avec des plafonds{" "}
                <span className="text-[#f0d7b2]">décoratifs uniques</span>
              </>
            )}
          </h1>

          <p className="mb-5 max-w-lg font-body text-[clamp(0.875rem,2.1vh,1.125rem)] leading-relaxed text-primary-foreground drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)] sm:mb-8">
            {activeSlide.description ||
              "Spécialiste de la décoration en plâtre, moulures et faux plafonds modernes. Chaque projet est une œuvre d'art."}
          </p>

          <div className="flex flex-wrap gap-3 sm:gap-4">
            <a
              href="#realisations"
              className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-3 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:shadow-elevated sm:min-h-14 sm:px-8 sm:py-4 sm:text-base"
            >
              Voir nos réalisations
            </a>
            <a
              href={activeSlide.button_url || "#calculateur"}
              className="inline-flex min-h-11 items-center rounded-lg border-2 border-primary-foreground/30 px-4 py-3 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:bg-primary-foreground/10 sm:min-h-14 sm:px-8 sm:py-4 sm:text-base"
            >
              {activeSlide.button_text || "Demander un devis"}
            </a>
          </div>
        </motion.div>
      </div>

      <button
        type="button"
        onClick={prev}
        aria-label="Diapositive précédente"
        className="absolute left-2 top-1/2 z-20 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-foreground/35 text-primary-foreground backdrop-blur-sm transition-colors hover:bg-foreground/60 sm:left-4 sm:size-12"
      >
        <ChevronLeft size={26} />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Diapositive suivante"
        className="absolute right-2 top-1/2 z-20 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-foreground/35 text-primary-foreground backdrop-blur-sm transition-colors hover:bg-foreground/60 sm:right-4 sm:size-12"
      >
        <ChevronRight size={26} />
      </button>

      <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-3 sm:bottom-7">
        {displaySlides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={"Afficher la diapositive " + (i + 1)}
            aria-current={i === activeIndex ? "true" : undefined}
            className={"h-3 rounded-full transition-all duration-300 " + (i === activeIndex ? "w-8 bg-primary" : "w-3 bg-primary-foreground/45 hover:bg-primary-foreground/75")}
          />
        ))}
      </div>
    </section>
  );
};

export default HeroSection;
