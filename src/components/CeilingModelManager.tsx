import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, apiUrl } from "@/lib/api";
import NumericInput from "@/components/NumericInput";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirm } from "@/components/confirm-dialog";
import MediaUploadField, { type MediaAsset } from "@/components/MediaUploadField";

type LightingPoint = { key: string; name: string; productType: string; quantity: number; position: string; required: boolean };
type Price = { key: string; name: string; unit: string; rate: number; calculation: "area" | "linear" | "fixed" };
type CeilingModel = {
  id: number;
  title: string;
  description: string;
  ceilingTypeKey: string;
  ceilingTypeName: string;
  minArea: number | null;
  maxArea: number | null;
  pricePerSqm: number;
  laborPerSqm: number;
  materialPerSqm: number;
  assetId: number;
  filename: string;
  gallery: number[];
  lightingLayout: LightingPoint[];
  sortOrder: number;
  active: boolean;
};

type ModelDraft = Omit<CeilingModel, "id" | "filename" | "ceilingTypeName" | "laborPerSqm" | "materialPerSqm">;

const emptyModel: ModelDraft = {
  title: "",
  description: "",
  ceilingTypeKey: "",
  minArea: null,
  maxArea: null,
  pricePerSqm: 0,
  assetId: 0,
  gallery: [],
  lightingLayout: [],
  sortOrder: 0,
  active: true,
};
const inputClass = "mt-1.5 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 py-2.5 text-sm outline-none focus:border-[#a97850]";

export default function CeilingModelManager({
  run,
}: {
  run: (action: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const [models, setModels] = useState<CeilingModel[]>([]);
  const confirm = useConfirm();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [areaPrices, setAreaPrices] = useState<Price[]>([]);
  const [draft, setDraft] = useState<ModelDraft>(emptyModel);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [modelList, mediaList, pricing] = await Promise.all([
        api<CeilingModel[]>("/admin/ceiling-models"),
        api<MediaAsset[]>("/admin/media"),
        api<Price[]>("/public/pricing").catch(() => [] as Price[]),
      ]);
      setModels(modelList);
      setAssets(mediaList.filter((asset) => asset.mimeType.startsWith("image/")));
      setAreaPrices(pricing.filter((price) => price.calculation === "area" && !["main_oeuvre", "materiaux"].includes(price.key)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load().catch(() => setModels([]));
  }, [load]);

  const create = () => {
    setEditingId(null);
    setDraft(emptyModel);
    setOpen(true);
  };

  const edit = (model: CeilingModel) => {
    const {
      id,
      filename: _filename,
      ceilingTypeName: _typeName,
      laborPerSqm: _labor,
      materialPerSqm: _materials,
      ...values
    } = model;
    setEditingId(id);
    setDraft(values);
    setOpen(true);
  };

  const mergeUploadedAssets = (uploaded: MediaAsset[]) =>
    setAssets((current) => [...uploaded, ...current]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.assetId) {
      toast.error("Ajoutez la photo principale de ce modèle.");
      return;
    }
    await run(async () => {
      await api(editingId ? `/admin/ceiling-models/${editingId}` : "/admin/ceiling-models", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(draft),
      });
      setOpen(false);
      await load();
    }, editingId ? "Modèle de plafond mis à jour." : "Modèle de plafond ajouté.");
  };

  const remove = async (model: CeilingModel) => {
    if (!(await confirm({ title: `Supprimer le modèle « ${model.title} » ?`, message: "Ce modèle ne sera plus proposé dans le calculateur public ni dans les devis.", confirmLabel: "Supprimer", destructive: true }))) return;
    await run(async () => {
      await api(`/admin/ceiling-models/${model.id}`, { method: "DELETE" });
      await load();
    }, "Modèle supprimé.");
  };

  const addLightingPoint = () => {
    const key = `zone-${Date.now().toString(36)}`;
    setDraft((current) => ({
      ...current,
      lightingLayout: [...current.lightingLayout, { key, name: "", productType: "spot", quantity: 1, position: "", required: true }],
    }));
  };

  const updateLightingPoint = (index: number, field: keyof LightingPoint, value: string | number | boolean) => {
    setDraft((current) => ({
      ...current,
      lightingLayout: current.lightingLayout.map((point, pointIndex) => pointIndex === index ? { ...point, [field]: value } : point),
    }));
  };

  const totalLightPoints = (model: Pick<ModelDraft, "lightingLayout">) => model.lightingLayout.reduce((sum, point) => sum + point.quantity, 0);

  return <>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold tracking-[0.17em] text-[#a97850] dark:text-[#dcb487]">FAUX PLAFONDS</p><h2 className="mt-1 font-heading text-3xl font-semibold sm:text-4xl">Modèles de plafonds</h2><p className="mt-1.5 text-sm text-[#72766e] dark:text-[#aab3a8]">Configurez les tarifs, contraintes et zones d’éclairage recommandées.</p></div><button onClick={create} className="inline-flex min-h-11 items-center gap-2 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white hover:bg-[#354b3f] hover:dark:bg-[#3d5648]"><Plus size={16} />Ajouter un modèle</button></div>
    {loading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((index) => <div key={index} className="h-72 animate-pulse border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c]" />)}</div> : models.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{models.map((model) => <article key={model.id} className="overflow-hidden border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c]">    <img src={apiUrl(`/media/${encodeURIComponent(model.filename)}`)} alt={model.title} className="aspect-[4/3] w-full bg-[#f1f1ed] dark:bg-[#20281f] object-cover" /><div className="p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{model.title}</h3><p className="mt-1 text-xs text-[#72766e] dark:text-[#aab3a8]">{model.pricePerSqm.toLocaleString("fr-FR")} FCFA / m²</p></div><span className={`border px-2 py-1 text-[10px] ${model.active ? "border-[#cdded0] dark:border-[#31503a] bg-[#eef5ef] dark:bg-[#1f2c22] text-[#3f6948] dark:text-[#8fc79d]" : "border-[#dedfd9] dark:border-[#2b342c] bg-[#f3f3ef] dark:bg-[#20281f] text-[#656a63] dark:text-[#a8b1a6]"}`}>{model.active ? "Publié" : "Masqué"}</span></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-[#72766e] dark:text-[#aab3a8]">{model.description || "Aucune description"}</p><div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[#687068] dark:text-[#b3bcb2]"><span className="border border-[#e8e5de] dark:border-[#2b342c] bg-[#f8f7f3] dark:bg-[#1e261f] px-2 py-1">Type : {model.ceilingTypeName}</span><span className="border border-[#e8e5de] dark:border-[#2b342c] px-2 py-1">{totalLightPoints(model)} point(s) lumineux</span>{model.minArea && <span className="border border-[#e8e5de] dark:border-[#2b342c] px-2 py-1">{model.minArea}–{model.maxArea || "∞"} m²</span>}</div><div className="mt-4 flex gap-2 border-t border-[#efede7] dark:border-[#262e27] pt-3"><button onClick={() => edit(model)} className="min-h-9 border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs">Modifier</button><button onClick={() => remove(model)} className="ml-auto min-h-9 border border-[#ead6d1] dark:border-[#4a332f] px-3 text-xs text-[#8a4d43] dark:text-[#e08b7d]"><Trash2 size={14} /></button></div></div></article>)}</div> : <div className="border border-dashed border-[#d8d5cc] dark:border-[#3a443b] bg-white dark:bg-[#1b221c] px-5 py-14 text-center"><p className="text-sm font-semibold">Aucun modèle de plafond</p><p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">Ajoutez un premier modèle avec sa photo et son plan lumineux.</p></div>}

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[94dvh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0 sm:max-h-[90dvh]"><DialogHeader className="border-b border-[#e8e5de] dark:border-[#2b342c] px-5 py-5 pr-14 sm:px-7"><p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">CATALOGUE DE PRESTATIONS</p><DialogTitle className="font-heading text-2xl">{editingId ? "Modifier le modèle" : "Nouveau modèle de plafond"}</DialogTitle><DialogDescription className="text-sm text-[#72766e] dark:text-[#aab3a8]">Les éclairages sont configurés par position ; les produits et prix viennent du catalogue Khalil Déco.</DialogDescription></DialogHeader>
      <form onSubmit={save} className="space-y-5 px-5 py-5 sm:px-7"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium sm:col-span-2">Nom<input required maxLength={160} className={inputClass} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label className="text-sm font-medium sm:col-span-2">Type de plafond *<select required value={draft.ceilingTypeKey} onChange={(event) => setDraft({ ...draft, ceilingTypeKey: event.target.value })} className={inputClass}><option value="">Choisir le type de plafond lié à ce modèle</option>{areaPrices.map((price) => <option key={price.key} value={price.key}>{price.name} — tarif {price.rate.toLocaleString("fr-FR")} FCFA/m²</option>)}</select><span className="mt-1 block text-[11px] font-normal text-[#85877f] dark:text-[#96a094]">Obligatoire : chaque modèle est rattaché à un type du calculateur ; le choix du modèle reste optionnel pour le client.</span></label><label className="text-sm font-medium sm:col-span-2">Description détaillée<textarea maxLength={3000} className={`${inputClass} min-h-20 resize-y`} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><label className="text-sm font-medium">Surface minimale (m²)<NumericInput min="0" step="0.1" className={inputClass} value={draft.minArea ?? ""} onChange={(event) => setDraft({ ...draft, minArea: event.target.value ? Number(event.target.value) : null })} /></label><label className="text-sm font-medium">Surface maximale (m²)<NumericInput min="0" step="0.1" className={inputClass} value={draft.maxArea ?? ""} onChange={(event) => setDraft({ ...draft, maxArea: event.target.value ? Number(event.target.value) : null })} /></label><label className="text-sm font-medium">Tarif du modèle / m²<NumericInput required min="0" className={inputClass} value={draft.pricePerSqm} onChange={(event) => setDraft({ ...draft, pricePerSqm: Number(event.target.value) })} /></label><label className="text-sm font-medium">Ordre d’affichage<NumericInput className={inputClass} value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /></label></div>
      <div className="grid gap-4 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-4 sm:grid-cols-2"><MediaUploadField label="Photo principale" assets={assets} value={draft.assetId ? [draft.assetId] : []} onChange={(ids) => setDraft({ ...draft, assetId: ids[ids.length - 1] ?? 0 })} onUploaded={mergeUploadedAssets} kind="image" hint="Téléversez la photo ici, sans passer par la bibliothèque Médias." /><MediaUploadField label="Galerie" assets={assets} value={draft.gallery} onChange={(ids) => setDraft({ ...draft, gallery: ids })} onUploaded={mergeUploadedAssets} multiple kind="image" hint="Ajoutez autant de visuels que nécessaire." /></div>
      <section className="border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c]"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#efede7] dark:border-[#262e27] px-4 py-3"><div><h3 className="text-sm font-semibold">Plan d’éclairage</h3><p className="mt-1 text-xs text-[#72766e] dark:text-[#aab3a8]">Le type correspond au champ `type` fourni par le catalogue e-commerce.</p></div><button type="button" onClick={addLightingPoint} className="inline-flex min-h-9 items-center gap-1.5 border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs"><Plus size={14} />Position</button></div><div className="divide-y divide-[#efede7] dark:divide-[#262e27]">{draft.lightingLayout.map((point, index) => <div key={point.key} className="grid gap-2 p-3 sm:grid-cols-[1fr_1fr_90px_1fr_auto]"><label className="text-[11px] text-[#72766e] dark:text-[#aab3a8]">Rôle<input className={inputClass} value={point.name} onChange={(event) => updateLightingPoint(index, "name", event.target.value)} placeholder="Ex. Centre" required /></label><label className="text-[11px] text-[#72766e] dark:text-[#aab3a8]">Type e-commerce<input className={inputClass} value={point.productType} onChange={(event) => updateLightingPoint(index, "productType", event.target.value)} placeholder="luminaire_central" required /></label><label className="text-[11px] text-[#72766e] dark:text-[#aab3a8]">Quantité<NumericInput min="1" max="100" className={inputClass} value={point.quantity} onChange={(event) => updateLightingPoint(index, "quantity", Number(event.target.value))} required /></label><label className="text-[11px] text-[#72766e] dark:text-[#aab3a8]">Position<input className={inputClass} value={point.position} onChange={(event) => updateLightingPoint(index, "position", event.target.value)} placeholder="Centre du plafond" required /></label><button type="button" onClick={() => setDraft((current) => ({ ...current, lightingLayout: current.lightingLayout.filter((_, pointIndex) => pointIndex !== index) }))} aria-label={`Supprimer ${point.name || "position"}`} className="mt-5 grid size-10 place-items-center text-[#8a4d43] dark:text-[#e08b7d]"><Trash2 size={15} /></button><label className="flex items-center gap-2 text-xs sm:col-span-5"><input type="checkbox" checked={point.required} onChange={(event) => updateLightingPoint(index, "required", event.target.checked)} />Choix client obligatoire</label></div>)}{!draft.lightingLayout.length && <p className="px-4 py-6 text-center text-xs text-[#85877f] dark:text-[#96a094]">Aucune position lumineuse configurée.</p>}</div></section>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />Publié dans le calculateur</label><div className="flex justify-end gap-2 border-t border-[#e8e5de] dark:border-[#2b342c] pt-4"><button type="button" onClick={() => setOpen(false)} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-4 text-sm">Annuler</button><button className="min-h-10 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white">{editingId ? "Enregistrer" : "Créer le modèle"}</button></div></form>
    </DialogContent></Dialog>
  </>;
}
 
