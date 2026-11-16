import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { GripVertical, X } from "lucide-react";
import { formatFileSize } from "@/lib/share";
import { closeShareTray, currentShareTrayRequest, subscribeToShareTray } from "@/lib/shareTray";

export function ShareTray() {
  const request = useSyncExternalStore(subscribeToShareTray, currentShareTrayRequest, () => null);
  if (!request) return null;

  const { file, caption } = request;

  // Portalled next to the modals: mounted in the page tree the panel paints over the dialog but never receives the click.
  return createPortal(
    <div
      data-share-tray=""
      onClick={closeShareTray}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => event.preventDefault()}
      className="fixed inset-0 z-[100] grid place-items-center bg-[#171d18]/45 p-4 xl:contents pointer-events-auto"
    >
      <aside
        aria-live="polite"
        onClick={(event) => event.stopPropagation()}
        className="z-[100] w-[min(92vw,20rem)] border border-[#d9e4d7] dark:border-[#31503a] bg-white dark:bg-[#1b221c] p-3.5 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.28)] xl:fixed xl:bottom-4 xl:right-4"
      >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">PDF PRÊT À PARTAGER</p>
        <button
          type="button"
          onClick={closeShareTray}
          aria-label="Fermer le panneau de partage"
          className="-mr-1 -mt-1 grid size-7 place-items-center text-[#85877f] transition hover:bg-[#f3f3ef] hover:dark:bg-[#222b23] hover:text-[#304737] hover:dark:text-[#cfe0d2]"
        >
          <X size={15} />
        </button>
      </div>
      <div
        draggable
        aria-label={`Document ${file.name} à glisser dans la conversation WhatsApp`}
        title="Glissez-moi dans la conversation WhatsApp"
        onDragStart={(event) => {
          event.dataTransfer.clearData();
          event.dataTransfer.items.add(file);
        }}
        className="mt-2.5 flex cursor-grab items-center gap-2.5 border border-dashed border-[#c9d6c6] dark:border-[#3d463d] bg-[#f6f8f4] dark:bg-[#1f281f] px-3 py-2.5 active:cursor-grabbing"
      >
        <GripVertical size={15} className="shrink-0 text-[#5c6f52] dark:text-[#93a488]" />
        <p className="min-w-0 truncate text-sm font-semibold">{file.name}</p>
        <p className="ml-auto shrink-0 text-xs text-[#85877f] dark:text-[#96a094]">PDF · {formatFileSize(file.size)}</p>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#5d645e] dark:text-[#b3bcb2]">
        Ce navigateur ne peut pas ouvrir la feuille de partage. Glissez ce document dans la conversation WhatsApp, puis envoyez le message ci-dessous.
      </p>
      {caption && <p className="mt-2 select-text whitespace-pre-line border border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-2.5 text-xs leading-5 text-[#5d645e] dark:text-[#b3bcb2]">{caption}</p>}
      </aside>
    </div>,
    document.body,
  );
}
