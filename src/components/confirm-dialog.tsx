import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmRequest = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type Confirm = (request: ConfirmRequest) => Promise<boolean>;

const ConfirmContext = createContext<Confirm>(async () => window.confirm("Confirmer ?"));

export function useConfirm(): Confirm {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const confirm = useCallback<Confirm>((next) => {
    setRequest(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <Dialog open onOpenChange={(open) => !open && settle(false)}>
          <DialogContent
            aria-describedby="confirm-description"
            className="max-w-md"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              cancelRef.current?.focus();
            }}
          >
            <DialogHeader>
              <DialogTitle>{request.title}</DialogTitle>
              {request.message ? (
                <DialogDescription id="confirm-description" className="text-left leading-6">
                  {request.message}
                </DialogDescription>
              ) : null}
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => settle(false)}
                className="min-h-11 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-4 text-sm font-medium text-[#49524c] dark:text-[#ccd3cb] transition hover:bg-[#f7f6f2] hover:dark:bg-[#1e261f]"
              >
                {request.cancelLabel || "Annuler"}
              </button>
              <button
                type="button"
                onClick={() => settle(true)}
                className={`min-h-11 px-4 text-sm font-semibold text-white transition ${
                  request.destructive
                    ? "bg-[#8a3527] hover:bg-[#9a3b2e] dark:bg-[#7a2f24] dark:hover:bg-[#8a3527]"
                    : "bg-[#293b32] hover:bg-[#354b3f] dark:bg-[#2f4438] dark:hover:bg-[#3d5648]"
                }`}
              >
                {request.confirmLabel || "Confirmer"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </ConfirmContext.Provider>
  );
}
