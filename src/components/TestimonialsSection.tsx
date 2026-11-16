import { useEffect, useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MessageSquareQuote, Star } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";

type Review = { name: string; rating: number; comment: string; createdAt: string; ceilingTypeName?: string; realizationTitle?: string };
type CeilingTypeOption = { key: string; name: string; calculation: string };
const REVIEW_PAGE_SIZE = 6;

const TestimonialsSection = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false);
  const [ceilingTypes, setCeilingTypes] = useState<CeilingTypeOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [ceilingTypeKey, setCeilingTypeKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reduceMotion = useReducedMotion();
  const featuredReview = reviews[0];
  const otherReviews = reviews.slice(1);

  useEffect(() => {
    api<Review[]>(`/public/reviews?offset=0&limit=${REVIEW_PAGE_SIZE + 1}`)
      .then((page) => {
        setReviews(page.slice(0, REVIEW_PAGE_SIZE));
        setHasMoreReviews(page.length > REVIEW_PAGE_SIZE);
      })
      .catch((reason) => toast.error(reason instanceof Error ? reason.message : "Impossible de charger les avis."));
    api<CeilingTypeOption[]>("/public/pricing")
      .then((prices) => setCeilingTypes(prices.filter((price) => price.calculation === "area" && !["main_oeuvre", "materiaux"].includes(price.key))))
      .catch(() => setCeilingTypes([]));
  }, []);

  const openModal = () => { setError(""); setModalOpen(true); };

  const loadMoreReviews = async () => {
    if (loadingMoreReviews) return;
    setLoadingMoreReviews(true);
    try {
      const page = await api<Review[]>(`/public/reviews?offset=${reviews.length}&limit=${REVIEW_PAGE_SIZE + 1}`);
      setReviews((current) => [...current, ...page.slice(0, REVIEW_PAGE_SIZE)]);
      setHasMoreReviews(page.length > REVIEW_PAGE_SIZE);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Impossible de charger les avis suivants.");
    } finally {
      setLoadingMoreReviews(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await api("/public/reviews", {
        method: "POST",
        body: JSON.stringify({
          displayName: name,
          rating,
          comment,
          ...(ceilingTypeKey ? { ceilingTypeKey } : {}),
        }),
      });
      setModalOpen(false);
      setName(""); setComment(""); setRating(5); setCeilingTypeKey("");
      toast.success("Merci pour votre avis. Il sera publié après validation.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’envoyer cet avis.");
    } finally { setBusy(false); }
  };

  return (
    <section id="avis" aria-labelledby="reviews-title" className="section-padding bg-white">
      <div className="container-custom">
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: reduceMotion ? 0 : 0.45 }} className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Avis clients</span>
              <h2 id="reviews-title" className="mt-3 font-heading text-4xl font-medium leading-tight text-foreground sm:text-5xl">Leurs retours, en toute simplicité.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Seuls les avis validés par l’équipe sont affichés.</p>
          </div>
          <button type="button" onClick={openModal} className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 border border-[#294b35] px-5 py-3 text-sm font-semibold text-[#294b35] transition-colors hover:bg-[#f4f7f4] motion-reduce:transition-none sm:w-auto">
            <MessageSquareQuote size={17} /> Donner son avis
          </button>
        </motion.div>

        {featuredReview ? <div className={`mt-10 grid border-y border-border ${otherReviews.length ? "lg:grid-cols-[1.1fr_0.9fr]" : ""}`}>
          <motion.article
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: reduceMotion ? 0 : 0.4 }}
            className={`py-7 sm:py-9 ${otherReviews.length ? "lg:border-r lg:border-border lg:pr-10" : ""}`}
          >
            <div className="mb-5 flex gap-1" aria-label={featuredReview.rating + " sur 5"}>{Array.from({ length: 5 }, (_, i) => <Star key={i} className={"size-4 " + (i < featuredReview.rating ? "fill-[#b59664] text-[#b59664]" : "text-[#dfe3dd]")} />)}</div>
            {featuredReview.comment && <p className="max-w-3xl font-heading text-2xl font-medium leading-snug text-foreground sm:text-3xl">“{featuredReview.comment}”</p>}
            <p className="mt-6 text-sm font-semibold text-foreground">{featuredReview.name}</p>
            {(featuredReview.ceilingTypeName || featuredReview.realizationTitle) && <p className="mt-1 text-xs text-primary">{featuredReview.ceilingTypeName ? `Type de plafond : ${featuredReview.ceilingTypeName}` : `Réalisation : ${featuredReview.realizationTitle}`}</p>}
          </motion.article>
          {otherReviews.length > 0 && <div className="divide-y divide-border lg:pl-10">
            {otherReviews.map((review, index) => <motion.article
              key={review.createdAt + review.name + index}
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: reduceMotion ? 0 : 0.4, delay: reduceMotion ? 0 : Math.min(index, 4) * 0.04 }}
              className="py-6"
            >
              <div className="mb-3 flex gap-1" aria-label={review.rating + " sur 5"}>{Array.from({ length: 5 }, (_, i) => <Star key={i} className={"size-3.5 " + (i < review.rating ? "fill-[#b59664] text-[#b59664]" : "text-[#dfe3dd]")} />)}</div>
              {review.comment && <p className="text-sm leading-6 text-muted-foreground">“{review.comment}”</p>}
              <p className="mt-3 text-sm font-semibold text-foreground">{review.name}</p>
              {(review.ceilingTypeName || review.realizationTitle) && <p className="mt-1 text-xs text-primary">{review.ceilingTypeName ? `Type de plafond : ${review.ceilingTypeName}` : `Réalisation : ${review.realizationTitle}`}</p>}
            </motion.article>)}
          </div>}
        </div> : <p className="mt-10 border-y border-border py-8 text-sm text-muted-foreground">Aucun avis publié pour le moment.</p>}
        {hasMoreReviews && <div className="mt-8 flex justify-center">
          <button type="button" onClick={loadMoreReviews} disabled={loadingMoreReviews} className="inline-flex min-h-11 items-center justify-center border border-[#294b35] px-6 text-sm font-semibold text-[#294b35] transition-colors hover:bg-[#f4f7f4] disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none">
            {loadingMoreReviews ? "Chargement…" : "Voir plus d’avis"}
          </button>
        </div>}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent busy={busy} className="max-h-[92dvh] w-[calc(100vw-1.5rem)] overflow-y-auto border-[#e5e9e4] bg-white sm:max-w-lg">
          <DialogHeader className="text-left">
            <DialogTitle className="font-heading text-2xl text-foreground">Donner son avis</DialogTitle>
            <DialogDescription className="text-sm">Votre avis sera vérifié par notre équipe avant sa publication.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="mt-2 space-y-4">
            <label className="block text-sm font-medium text-foreground">Nom affiché *
              <input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full border border-border bg-background px-3 py-3 text-sm" />
            </label>
            <fieldset className="border-0 p-0">
              <legend className="text-sm font-medium text-foreground">Votre note</legend>
              <div className="mt-2 flex gap-2">{Array.from({ length: 5 }, (_, i) => (
                <button type="button" key={i} aria-label={"Note " + (i + 1) + " sur 5"} aria-pressed={rating === i + 1} onClick={() => setRating(i + 1)} className="grid size-10 place-items-center">
                  <Star className={"size-6 " + (i < rating ? "fill-primary text-primary" : "text-muted")} />
                </button>
              ))}</div>
            </fieldset>
            <label className="block text-sm font-medium text-foreground">Commentaire (facultatif)
              <textarea maxLength={2000} rows={4} value={comment} onChange={(event) => setComment(event.target.value)} className="mt-1.5 w-full border border-border bg-background px-3 py-3 text-sm" />
            </label>
            <label className="block text-sm font-medium text-foreground">Type de plafond concerné (facultatif)
              <select value={ceilingTypeKey} onChange={(event) => setCeilingTypeKey(event.target.value)} className="mt-1.5 w-full border border-border bg-background px-3 py-3 text-sm">
                <option value="">Aucun type sélectionné</option>
                {ceilingTypes.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
              </select>
            </label>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={busy} className="min-h-11 w-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? "Envoi…" : "Envoyer mon avis"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default TestimonialsSection;
