import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

function PdfPage({
  document,
  pageNumber,
  onError,
}: {
  document: PDFDocumentProxy;
  pageNumber: number;
  onError: (reason: unknown) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderQueue = useRef(Promise.resolve());
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => setWidth(Math.floor(container.getBoundingClientRect().width));
    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!width) return;

    let cancelled = false;
    let renderTask: RenderTask | undefined;

    const renderPage = async () => {
      try {
        const page = await document.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width / baseViewport.width });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d", { alpha: false });
        if (!canvas || !context) throw new Error("Canvas indisponible");

        canvas.width = Math.ceil(viewport.width * pixelRatio);
        canvas.height = Math.ceil(viewport.height * pixelRatio);
        renderTask = page.render({
          canvasContext: context,
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });
        await renderTask.promise;
      } catch (reason) {
        if (cancelled || (reason instanceof Error && reason.name === "RenderingCancelledException")) return;
        onError(reason);
      }
    };

    renderQueue.current = renderQueue.current.then(renderPage, renderPage);
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [document, onError, pageNumber, width]);

  return (
    <section ref={containerRef} className="min-w-0">
      <p className="mb-2 text-center text-[10px] font-semibold tracking-[0.12em] text-white/75">
        PAGE {pageNumber} / {document.numPages}
      </p>
      <div className="overflow-hidden border border-[#dedbd3] bg-white">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Page ${pageNumber} sur ${document.numPages}`}
          className="block h-auto w-full"
        />
      </div>
    </section>
  );
}

export default function PdfDocumentViewer({ url }: { url: string }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const handleRenderError = useCallback((reason: unknown) => {
    console.error("PDF page rendering failed", reason);
    setError(true);
  }, []);

  useEffect(() => {
    let active = true;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    setDocument(null);
    setError(false);

    const loadDocument = async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (!active) return;
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        loadingTask = pdfjs.getDocument(url);
        const loadedDocument = await loadingTask.promise;
        if (!active) {
          await loadedDocument.destroy();
          return;
        }
        setDocument(loadedDocument);
      } catch (reason) {
        if (!active) return;
        console.error("PDF document loading failed", reason);
        setError(true);
      }
    };

    void loadDocument();
    return () => {
      active = false;
      void loadingTask?.destroy();
    };
  }, [url]);

  return (
    <div data-modal-scroll="" className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-[#525659] px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-[840px] space-y-5">
        {error ? (
          <p role="alert" className="border border-white/20 bg-white px-4 py-3 text-sm text-[#293b32]">
            Impossible d’afficher toutes les pages. Téléchargez le PDF pour le consulter.
          </p>
        ) : null}
        {!document && !error ? (
          <p role="status" className="py-8 text-center text-sm text-white">
            Chargement du PDF…
          </p>
        ) : null}
        {document
          ? Array.from({ length: document.numPages }, (_, index) => (
              <PdfPage
                key={`${url}-${index + 1}`}
                document={document}
                pageNumber={index + 1}
                onError={handleRenderError}
              />
            ))
          : null}
      </div>
    </div>
  );
}
