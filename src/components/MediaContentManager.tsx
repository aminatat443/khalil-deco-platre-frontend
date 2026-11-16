import { useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api, apiUrl } from "@/lib/api";
import NumericInput from "@/components/NumericInput";
import { useConfirm } from "@/components/confirm-dialog";
import MediaUploadField, { type MediaAsset } from "@/components/MediaUploadField";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
type Slide = {
  id: number;
  title: string;
  description: string;
  button_text: string;
  button_url: string;
  asset_id: number;
  sort_order: number;
  active: number;
  filename: string;
  mime_type: string;
};
type Realization = {
  id: number;
  title: string;
  description: string;
  category: string;
  location: string;
  project_date: string | null;
  asset_id: number;
  gallery_json: string;
  sort_order: number;
  active: number;
  filename: string;
};
type Props = {
  run: (action: () => Promise<unknown>, success?: string) => Promise<void>;
};
const inputClass =
  "mt-1.5 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 py-2.5 text-sm outline-none focus:border-[#a97850]";
const emptySlide = {
  title: "",
  description: "",
  buttonText: "",
  buttonUrl: "#calculateur",
  assetId: 0,
  sortOrder: 0,
  active: true,
};
const emptyProject = {
  title: "",
  description: "",
  category: "",
  location: "",
  projectDate: "",
  assetId: 0,
  gallery: [] as number[],
  sortOrder: 1,
  active: true,
};
const realizationCategories = [
  "Demi plafond simple",
  "Demi plafond decoratif",
  "Plafond complet simple",
  "Plafond complet decoratif",
];

export default function MediaContentManager({ run }: Props) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const confirm = useConfirm();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [projects, setProjects] = useState<Realization[]>([]);
  const [slide, setSlide] = useState(emptySlide);
  const [project, setProject] = useState(emptyProject);
  const [slideId, setSlideId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [slideDialogOpen, setSlideDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const load = async () => {
    try {
      const [assetsData, slideData, projectData] = await Promise.all([
        api<MediaAsset[]>("/admin/media"),
        api<Slide[]>("/admin/hero-slides"),
        api<Realization[]>("/admin/realizations"),
      ]);
      setAssets(assetsData);
      setSlides(slideData);
      setProjects(projectData);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Chargement impossible.",
      );
    }
  };
  useEffect(() => {
    load();
  }, []);
  const updateSlide = (
    key: keyof typeof emptySlide,
    value: string | number | boolean,
  ) => setSlide((current) => ({ ...current, [key]: value }));
  const updateProject = (
    key: keyof typeof emptyProject,
    value: string | number | boolean | number[],
  ) => setProject((current) => ({ ...current, [key]: value }));
  const mergeUploadedAssets = (uploaded: MediaAsset[]) =>
    setAssets((current) => [...uploaded, ...current]);
  const saveSlide = async (event: FormEvent) => {
    event.preventDefault();
    if (!slide.assetId) {
      toast.error("Ajoutez une image ou une vidéo pour ce slide.");
      return;
    }
    await run(
      async () => {
        const endpoint = slideId
          ? `/admin/hero-slides/${slideId}`
          : "/admin/hero-slides";
        await api(endpoint, {
          method: slideId ? "PUT" : "POST",
          body: JSON.stringify(slide),
        });
        setSlide(emptySlide);
        setSlideId(null);
        setSlideDialogOpen(false);
        await load();
      },
      slideId ? "Slide mis à jour." : "Slide ajouté au Hero.",
    );
  };
  const saveProject = async (event: FormEvent) => {
    event.preventDefault();
    if (!project.assetId) {
      toast.error("Ajoutez une image ou une vidéo principale à cette réalisation.");
      return;
    }
    await run(
      async () => {
        const endpoint = projectId
          ? `/admin/realizations/${projectId}`
          : "/admin/realizations";
        await api(endpoint, {
          method: projectId ? "PUT" : "POST",
          body: JSON.stringify(project),
        });
        setProject(emptyProject);
        setProjectId(null);
        setProjectDialogOpen(false);
        await load();
      },
      projectId ? "Réalisation mise à jour." : "Réalisation ajoutée.",
    );
  };
  return (
    <div className="mt-8 space-y-8 border-t border-[#e4e1d9] dark:border-[#333d34] pt-8">
      <div>
        <p className="text-xs font-semibold tracking-[0.15em] text-[#a97850] dark:text-[#dcb487]">
          PUBLICATION SUR LE SITE
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-heading text-3xl font-semibold">Slides du Hero</h3>
            <p className="mt-1 text-sm text-[#72766e] dark:text-[#aab3a8]">
              Gérez les visuels, leur ordre et leurs appels à l’action.
            </p>
          </div>
          <button type="button" onClick={() => { setSlide(emptySlide); setSlideId(null); setSlideDialogOpen(true); }} className="inline-flex min-h-10 items-center gap-2 bg-[#293b32] dark:bg-[#2f4438] px-4 text-xs font-semibold text-white">
            <Plus size={14} /> Créer un slide
          </button>
        </div>
      </div>
      <div className="space-y-3">
        <Dialog open={slideDialogOpen} onOpenChange={(open) => {
          setSlideDialogOpen(open);
          if (!open) { setSlide(emptySlide); setSlideId(null); }
        }}>
          <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0">
            <DialogHeader className="border-b border-[#e8e5de] dark:border-[#2b342c] px-5 py-5 pr-14 sm:px-7">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">PUBLICATION SUR LE SITE</p>
              <DialogTitle className="font-heading text-2xl">{slideId ? "Modifier le slide" : "Créer un slide"}</DialogTitle>
              <DialogDescription>Ajoutez un visuel et configurez son affichage dans le Hero.</DialogDescription>
            </DialogHeader>
            <form
          onSubmit={saveSlide}
          className="space-y-4 px-5 py-5 sm:px-7"
        >
          <label className="block text-xs font-medium">
            Titre
            <input
              required
              maxLength={160}
              className={inputClass}
              value={slide.title}
              onChange={(event) => updateSlide("title", event.target.value)}
            />
          </label>
          <label className="block text-xs font-medium">
            Description
            <textarea
              maxLength={500}
              className={`${inputClass} min-h-20`}
              value={slide.description}
              onChange={(event) =>
                updateSlide("description", event.target.value)
              }
            />
          </label>
          <MediaUploadField
            label="Média (image ou vidéo)"
            assets={assets}
            value={slide.assetId ? [slide.assetId] : []}
            onChange={(ids) => updateSlide("assetId", ids[ids.length - 1] ?? 0)}
            onUploaded={mergeUploadedAssets}
            kind="any"
            hint="Le fichier est téléversé ici, sans passer par la bibliothèque Médias."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium">
              Texte du bouton
              <input
                maxLength={80}
                className={inputClass}
                value={slide.buttonText}
                onChange={(event) =>
                  updateSlide("buttonText", event.target.value)
                }
              />
            </label>
            <label className="block text-xs font-medium">
              Lien du bouton
              <input
                maxLength={300}
                className={inputClass}
                value={slide.buttonUrl}
                onChange={(event) =>
                  updateSlide("buttonUrl", event.target.value)
                }
              />
            </label>
            <label className="block text-xs font-medium">
              Ordre
              <NumericInput
                className={inputClass}
                value={slide.sortOrder}
                onChange={(event) =>
                  updateSlide("sortOrder", Number(event.target.value))
                }
              />
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-xs">
              <input
                type="checkbox"
                checked={slide.active}
                onChange={(event) =>
                  updateSlide("active", event.target.checked)
                }
              />
              Publié
            </label>
          </div>
          <div className="flex gap-2">
            <button className="bg-[#293b32] dark:bg-[#2f4438] px-4 py-2.5 text-xs font-semibold text-white">
              {slideId ? "Enregistrer les modifications" : "Ajouter au Hero"}
            </button>
            {slideId && (
              <button
                type="button"
                onClick={() => {
                  setSlide(emptySlide);
                  setSlideId(null);
                  setSlideDialogOpen(false);
                }}
                className="flex items-center gap-1 border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs"
              >
                <X size={14} />
                Annuler
              </button>
            )}
          </div>
        </form>
          </DialogContent>
        </Dialog>
          {slides.map((item) => (
            <article
              key={item.id}
              className="flex gap-3 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-3"
            >
              <MediaPreview
                filename={item.filename}
                mime={item.mime_type}
                title={item.title}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <span
                    className={`text-[10px] ${item.active ? "text-green-700 dark:text-[#8fc79d]" : "text-[#85877f] dark:text-[#96a094]"}`}
                  >
                    {item.active ? "Publié" : "Masqué"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[#72766e] dark:text-[#aab3a8]">
                  {item.description || "Sans description"}
                </p>
                <p className="mt-2 text-[10px] text-[#85877f] dark:text-[#96a094]">
                  Ordre {item.sort_order}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    title="Modifier"
                    onClick={() => {
                      setSlide({
                        title: item.title,
                        description: item.description,
                        buttonText: item.button_text,
                        buttonUrl: item.button_url,
                        assetId: item.asset_id,
                        sortOrder: item.sort_order,
                        active: Boolean(item.active),
                      });
                      setSlideId(item.id);
                      setSlideDialogOpen(true);
                    }}
                    className="border border-[#dedbd3] dark:border-[#333d34] p-1.5"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    title="Supprimer"
                    onClick={async () => {
                      if (!(await confirm({ title: "Supprimer cette slide ?", message: `« ${item.title} » disparaîtra de l’accueil du site public.`, confirmLabel: "Supprimer", destructive: true }))) return;
                      await run(async () => {
                        await api(`/admin/hero-slides/${item.id}`, {
                          method: "DELETE",
                        });
                        await load();
                      }, "Slide supprimé.");
                    }}
                    className="border border-[#ead6d1] dark:border-[#4a332f] p-1.5 text-red-700 dark:text-[#e08b7d]"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </article>
          ))}
          {slides.length === 0 && (
            <p className="border border-dashed border-[#d8d5cc] dark:border-[#3a443b] px-4 py-10 text-center text-xs text-[#85877f] dark:text-[#96a094]">
              Aucun slide publié ou préparé.
            </p>
          )}
      </div>

      <div className="border-t border-[#e4e1d9] dark:border-[#333d34] pt-8">
        <p className="text-xs font-semibold tracking-[0.15em] text-[#a97850] dark:text-[#dcb487]">
          PORTFOLIO
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-heading text-3xl font-semibold">Nos réalisations</h3>
            <p className="mt-1 text-sm text-[#72766e] dark:text-[#aab3a8]">
              Gérez les projets visibles dans la galerie publique et leurs images complémentaires.
            </p>
          </div>
          <button type="button" onClick={() => { setProject({ ...emptyProject, sortOrder: projects.length + 1 }); setProjectId(null); setProjectDialogOpen(true); }} className="inline-flex min-h-10 items-center gap-2 bg-[#293b32] dark:bg-[#2f4438] px-4 text-xs font-semibold text-white">
            <Plus size={14} /> Créer une réalisation
          </button>
        </div>
      </div>
      <div className="space-y-3">
        <Dialog open={projectDialogOpen} onOpenChange={(open) => {
          setProjectDialogOpen(open);
          if (!open) { setProject(emptyProject); setProjectId(null); }
        }}>
          <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0">
            <DialogHeader className="border-b border-[#e8e5de] dark:border-[#2b342c] px-5 py-5 pr-14 sm:px-7">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">PORTFOLIO</p>
              <DialogTitle className="font-heading text-2xl">{projectId ? "Modifier la réalisation" : "Créer une réalisation"}</DialogTitle>
              <DialogDescription>Ajoutez une réalisation au portfolio du site public.</DialogDescription>
            </DialogHeader>
            <form
          onSubmit={saveProject}
          className="space-y-4 px-5 py-5 sm:px-7"
        >
          <label className="block text-xs font-medium">
            Titre
            <input
              required
              maxLength={160}
              className={inputClass}
              value={project.title}
              onChange={(event) => updateProject("title", event.target.value)}
            />
          </label>
          <label className="block text-xs font-medium">
            Description
            <textarea
              className={`${inputClass} min-h-20`}
              value={project.description}
              onChange={(event) =>
                updateProject("description", event.target.value)
              }
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium">
              Catégorie
            <select required className={inputClass} value={project.category} onChange={(event) => updateProject("category", event.target.value)}>
              <option value="">Choisir un type de plafond</option>
              {realizationCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            </label>
            <label className="block text-xs font-medium">
              Localisation
              <input
                className={inputClass}
                value={project.location}
                onChange={(event) =>
                  updateProject("location", event.target.value)
                }
              />
            </label>
            <label className="block text-xs font-medium">
              Date
              <input
                type="date"
                className={inputClass}
                value={project.projectDate}
                onChange={(event) =>
                  updateProject("projectDate", event.target.value)
                }
              />
            </label>
            <label className="block text-xs font-medium">
              Ordre (1 = première réalisation)
              <NumericInput
                min={1}
                step={1}
                required
                className={inputClass}
                value={project.sortOrder}
                onChange={(event) =>
                  updateProject("sortOrder", Number(event.target.value))
                }
              />
            </label>
          </div>
          <MediaUploadField
            label="Image principale"
            assets={assets}
            value={project.assetId ? [project.assetId] : []}
            onChange={(ids) =>
              updateProject("assetId", ids[ids.length - 1] ?? 0)
            }
            onUploaded={mergeUploadedAssets}
            kind="any"
            hint="Téléversez le visuel directement pour cette réalisation."
          />
          <MediaUploadField
            label="Images complémentaires"
            assets={assets}
            value={project.gallery}
            onChange={(ids) => updateProject("gallery", ids)}
            onUploaded={mergeUploadedAssets}
            multiple
            kind="image"
            hint="Plusieurs fichiers peuvent être ajoutés les uns après les autres."
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={project.active}
              onChange={(event) =>
                updateProject("active", event.target.checked)
              }
            />
            Publié sur le site
          </label>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 bg-[#293b32] dark:bg-[#2f4438] px-4 py-2.5 text-xs font-semibold text-white">
              <Plus size={14} />
              {projectId ? "Enregistrer" : "Ajouter la réalisation"}
            </button>
            {projectId && (
              <button
                type="button"
                onClick={() => {
                  setProject(emptyProject);
                  setProjectId(null);
                  setProjectDialogOpen(false);
                }}
                className="flex items-center gap-1 border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs"
              >
                <X size={14} />
                Annuler
              </button>
            )}
          </div>
        </form>
          </DialogContent>
        </Dialog>
          {projects.map((item, index) => (
            <article
              key={item.id}
              className="flex gap-3 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-3"
            >
              <MediaPreview
                filename={item.filename}
                mime={
                  assets.find((asset) => asset.id === item.asset_id)?.mimeType ??
                  "image/webp"
                }
                title={item.title}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <span
                    className={`text-[10px] ${item.active ? "text-green-700 dark:text-[#8fc79d]" : "text-[#85877f] dark:text-[#96a094]"}`}
                  >
                    {item.active ? "Publié" : "Masqué"}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-[#72766e] dark:text-[#aab3a8]">
                  {[item.category, item.location].filter(Boolean).join(" · ") ||
                    "Sans catégorie"}
                </p>
                <p className="mt-2 text-[10px] text-[#85877f] dark:text-[#96a094]">
                  Ordre {index + 1}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    title="Modifier"
                    onClick={() => {
                      setProject({
                        title: item.title,
                        description: item.description,
                        category: item.category,
                        location: item.location,
                        projectDate: item.project_date || "",
                        assetId: item.asset_id,
                        gallery: JSON.parse(item.gallery_json),
                        sortOrder: index + 1,
                        active: Boolean(item.active),
                      });
                      setProjectId(item.id);
                      setProjectDialogOpen(true);
                    }}
                    className="border border-[#dedbd3] dark:border-[#333d34] p-1.5"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    title="Supprimer"
                    onClick={async () => {
                      if (!(await confirm({ title: "Supprimer cette réalisation ?", message: `« ${item.title} » sera retirée de la galerie publique et ne pourra plus être rattachée à un avis.`, confirmLabel: "Supprimer", destructive: true }))) return;
                      await run(async () => {
                        await api(`/admin/realizations/${item.id}`, {
                          method: "DELETE",
                        });
                        await load();
                      }, "Réalisation supprimée.");
                    }}
                    className="border border-[#ead6d1] dark:border-[#4a332f] p-1.5 text-red-700 dark:text-[#e08b7d]"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </article>
          ))}
          {projects.length === 0 && (
            <p className="border border-dashed border-[#d8d5cc] dark:border-[#3a443b] px-4 py-10 text-center text-xs text-[#85877f] dark:text-[#96a094]">
              Aucune réalisation publiée ou préparée.
            </p>
          )}
      </div>
    </div>
  );
}

function MediaPreview({
  filename,
  mime,
  title,
}: {
  filename: string;
  mime: string;
  title: string;
}) {
  const source = apiUrl(`/media/${encodeURIComponent(filename)}`);
  return mime.startsWith("video/") ? (
    <video
      src={source}
      className="h-20 w-28 shrink-0 bg-[#202522] object-cover"
      muted
    />
  ) : (
    <img
      src={source}
      alt={title}
      className="h-20 w-28 shrink-0 bg-[#f2f1ed] dark:bg-[#20281f] object-cover"
    />
  );
}
