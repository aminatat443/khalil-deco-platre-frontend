import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { api, apiUrl } from "@/lib/api";

export type MediaAsset = { id: number; filename: string; mimeType: string };

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/avif";
const VIDEO_ACCEPT = "video/mp4,video/webm";

type Props = {
  label: string;
  /** Visuels déjà connus du formulaire : bibliothèque chargée + fichiers téléversés dans cette session. */
  assets: MediaAsset[];
  value: number[];
  onChange: (ids: number[]) => void;
  onUploaded: (uploaded: MediaAsset[]) => void;
  multiple?: boolean;
  kind?: "image" | "video" | "any";
  hint?: string;
};

export default function MediaUploadField({
  label,
  assets,
  value,
  onChange,
  onUploaded,
  multiple = false,
  kind = "any",
  hint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const accept = kind === "image" ? IMAGE_ACCEPT : kind === "video" ? VIDEO_ACCEPT : `${IMAGE_ACCEPT},${VIDEO_ACCEPT}`;

  const upload = async (files: File[]) => {
    setUploading(true);
    try {
      const added: MediaAsset[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        added.push(await api<MediaAsset>("/admin/media", { method: "POST", body: form }));
      }
      onUploaded(added);
      const ids = added.map((asset) => asset.id);
      onChange(multiple ? [...value, ...ids] : ids.slice(-1));
      toast.success(multiple ? `${ids.length} fichier(s) ajouté(s).` : "Fichier ajouté à ce formulaire.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Le téléversement a échoué.");
    } finally {
      setUploading(false);
    }
  };

  const selected = value
    .map((id) => assets.find((asset) => asset.id === id))
    .filter((asset): asset is MediaAsset => Boolean(asset));

  return (
    <div>
      <p className="text-xs font-medium">{label}</p>
      {hint && <p className="mt-1 text-[11px] font-normal text-[#85877f] dark:text-[#96a094]">{hint}</p>}

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((asset) => (
            <div key={asset.id} className="relative">
              {asset.mimeType.startsWith("video/") ? (
                <video src={apiUrl(`/media/${encodeURIComponent(asset.filename)}`)} muted className="h-20 w-28 bg-[#202522] object-cover" />
              ) : (
                <img src={apiUrl(`/media/${encodeURIComponent(asset.filename)}`)} alt="" className="h-20 w-28 bg-[#f2f1ed] dark:bg-[#20281f] object-cover" />
              )}
              <button
                type="button"
                aria-label={`Retirer ${asset.filename}`}
                onClick={() => onChange(value.filter((id) => id !== asset.id))}
                className="absolute right-1 top-1 grid size-6 place-items-center bg-[#202522]/85 text-white"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="mt-2 inline-flex min-h-10 cursor-pointer items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 text-xs hover:bg-[#f7f6f2] hover:dark:bg-[#1e261f]">
        <Upload size={14} />
        {uploading ? "Envoi en cours…" : selected.length ? (multiple ? "Ajouter d’autres fichiers" : "Remplacer le fichier") : "Choisir un fichier"}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length) void upload(files);
          }}
        />
      </label>

      {selected.length > 0 && !multiple && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="ml-2 text-xs text-[#8a4d43] dark:text-[#e08b7d]"
        >
          Retirer le fichier
        </button>
      )}
    </div>
  );
}
