import {
  useCallback,
  useEffect,
  useState,
  useRef,
  useMemo,
  type FormEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  Activity,
  ArrowUpRight,
  ArrowUp,
  ArrowDown,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  DatabaseBackup,
  Download,
  Eye,
  FileImage,
  FilePlus2,
  FileText,
  Images,
  LayoutDashboard,
  Loader2,
  LogOut,
  Trash2,
  KeyRound,
  Mail,
  Menu,
  Package,
  Pencil,
  Phone,
  Plus,
  Printer,
  ReceiptText,
  Ruler,
  Search,
  Send,
  Share2,
  Settings2,
  ShieldCheck,
  Star,
  Sun,
  Moon,
  Upload,
  UserRoundPlus,
  Wallet,
  Users,
  X,
} from "lucide-react";
import { api, apiUrl, ApiError, formatCurrency } from "@/lib/api";
import { buildDocumentFile, documentShareCaption, shareFileWithSheet } from "@/lib/share";
import { whatsappConversationUrl, whatsappRecipient } from "@/lib/phone";
import NumericInput from "@/components/NumericInput";
import { ShareTray } from "@/components/ShareTray";
import { openShareTray } from "@/lib/shareTray";
import { adaptChip, setThemeScope, toggleTheme, useTheme } from "@/lib/theme";
import { useConfirm } from "@/components/confirm-dialog";
import MediaContentManager from "@/components/MediaContentManager";
import CeilingModelManager from "@/components/CeilingModelManager";
import BackupManager from "@/components/BackupManager";
import QuoteBuilderDialog from "@/components/QuoteBuilderDialog";
import PdfDocumentViewer from "@/components/PdfDocumentViewer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type User = {
  id: number;
  email: string;
  name: string;
  role: string;
  permissions?: string[];
  mustChangePassword?: boolean;
};
type QuoteSpace = { id: string; name: string; type: string; area: number; ceilingTypeKey: string };
type QuoteRoom = QuoteSpace & { bathroom?: QuoteSpace };
type QuoteApartment = { id: string; name: string; rooms: QuoteRoom[] };
type QuoteFloor = { id: string; name: string; apartments: QuoteApartment[] };
type QuoteBuilding = { floors: QuoteFloor[] };
const quoteRoomTypes = ["Chambre", "Salon", "Cuisine", "Couloir", "Balcon", "Entrée", "Bureau", "Autre"];
const normalizeQuoteBuildingNames = (building: QuoteBuilding): QuoteBuilding => ({
  floors: building.floors.map((floor, floorIndex) => ({
    ...floor,
    name: `${floorIndex === 0 ? "1er" : `${floorIndex + 1}e`} étage`,
    apartments: floor.apartments.map((apartment, apartmentIndex) => {
      const roomCounts = new Map<string, number>();
      return {
        ...apartment,
        name: `Appartement ${apartmentIndex + 1}`,
        rooms: apartment.rooms.map((room) => {
          const roomNumber = (roomCounts.get(room.type) || 0) + 1;
          roomCounts.set(room.type, roomNumber);
          return room.type === "Autre" ? room : { ...room, name: `${room.type} ${roomNumber}` };
        }),
      };
    }),
  })),
});
type Quote = {
  id: number;
  number: string;
  status: string;
  version?: number;
  accepted_at?: string | null;
  accepted_version?: number | null;
  created_at: string;
  customer: { name: string; phone: string; whatsapp?: string; email: string; address: string };
  project: {
    totalArea: number;
    location: string;
    description: string;
    ceilingType: string;
    rooms: Array<{ name: string; length?: number; width?: number; area?: number; floorName?: string; apartmentName?: string; parentRoomName?: string; sectionName?: string; ceilingTypeKey?: string; ceilingTypeName?: string; pricePerSqm?: number; amount?: number }>;
    building?: QuoteBuilding;
    ceilingModelId?: number;
    ceilingModel?: { id: number; title: string };
    transportZone?: "dakar" | "hors_dakar";
    transportZoneId?: number;
    transportCustomPrice?: number;
    options?: Array<{ key: string; quantity?: number }>;
    additionalServices?: Array<{ id: number; quantity: number }>;
    lightingSelections?: Array<{ layoutKey: string; productId: string }>;
    discount?: number;
  };
  totals: { subtotal: number; discount: number; total: number };
  company?: { name?: string; whatsapp?: string };
  items: Array<{
    key?: string;
    kind?: string;
    floorName?: string;
    apartmentName?: string;
    sectionName?: string;
    roomName?: string;
    parentRoomName?: string;
    ceilingTypeName?: string;
    label: string;
    amount: number;
    quantity: number;
    unit: string;
    unitPrice: number;
  }>;
  history?: Array<{ action: string; details_json: string; created_at: string }>;
  versions?: Array<{
    version: number;
    change_type: string;
    reason: string;
    created_by: number | null;
    created_at: string;
    snapshot: { totals: { total: number }; project?: { commercialTerms?: { reason?: string } } };
  }>;
};
type Invoice = {
  id: number;
  number: string;
  quoteNumber: string;
  status: string;
  issued_at: string;
  correctsInvoiceNumber?: string | null;
  correctedByNumber?: string | null;
  correction_reason?: string;
  customer: { name: string; phone: string; whatsapp?: string; email?: string; address?: string };
  project?: { totalArea: number; location: string; description: string; rooms: Array<{ name: string; area: number }> };
  items?: Array<{ key?: string; label: string; unit: string; quantity: number; unitPrice: number; amount: number }>;
  totals: { subtotal?: number; discount?: number; total: number };
  company?: { name: string; address: string; phone: string; email: string; whatsapp?: string; rccm?: string; ninea?: string; signature?: string; stamp?: string; manager?: string; managerRole?: string };
  payments?: Array<{ amount: number; method: string; reference?: string | null; paid_at: string; invoice_number?: string }>;
  history?: Array<{ action: string; created_at: string }>;
  paid: number;
  remaining: number;
};
type Tab =
  | "overview"
  | "quotes"
  | "invoices"
  | "clients"
  | "company"
  | "documents"
  | "pricing"
  | "services"
  | "reviews"
  | "media"
  | "users"
  | "sessions"
  | "ceilingModels"
  | "backups";

const navigation: Array<{
  id: Tab;
  label: string;
  icon: typeof LayoutDashboard;
  group: string;
  permission: string;
}> = [
  {
    id: "overview",
    label: "Vue d'ensemble",
    icon: LayoutDashboard,
    group: "ACTIVITÉ",
    permission: "dashboard.view",
  },
  {
    id: "quotes",
    label: "Demandes de devis",
    icon: FileText,
    group: "ACTIVITÉ",
    permission: "requests.view",
  },
  { id: "invoices", label: "Factures", icon: ReceiptText, group: "ACTIVITÉ", permission: "finances.view" },
  { id: "clients", label: "Clients", icon: Users, group: "ACTIVITÉ", permission: "finances.view" },
  { id: "users", label: "Utilisateurs & Permissions", icon: ShieldCheck, group: "ACTIVITÉ", permission: "users.manage" },
  { id: "sessions", label: "Sessions actives", icon: Activity, group: "ACTIVITÉ", permission: "users.manage" },
  { id: "reviews", label: "Avis clients", icon: Star, group: "ACTIVITÉ", permission: "reviews.manage" },
  {
    id: "company",
    label: "Entreprise",
    icon: Building2,
    group: "CONFIGURATION",
    permission: "settings.manage",
  },
  {
    id: "documents",
    label: "Documents",
    icon: Settings2,
    group: "CONFIGURATION",
    permission: "settings.manage",
  },
  {
    id: "pricing",
    label: "Tarifs du calculateur",
    icon: Package,
    group: "CONFIGURATION",
    permission: "pricing.manage",
  },
  { id: "services", label: "Prestations supplémentaires", icon: Package, group: "CONFIGURATION", permission: "supplemental_services.manage" },
  { id: "backups", label: "Sauvegardes et restauration", icon: DatabaseBackup, group: "CONFIGURATION", permission: "settings.manage" },
  { id: "media", label: "Médias du site", icon: Images, group: "CONTENU", permission: "media.manage" },
  { id: "ceilingModels", label: "Modèles de plafonds", icon: Ruler, group: "CONTENU", permission: "ceiling_models.manage" },
];

function Field({
  label,
  value,
  onChange,
  type = "text",
  multiline = false,
  required = false,
  placeholder,
  autocomplete,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  multiline?: boolean;
  required?: boolean;
  placeholder?: string;
  autocomplete?: "on" | "off";
}) {
  const common =
    "mt-1.5 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 py-2.5 text-sm text-[#29352f] dark:text-[#e9ece6] outline-none transition focus:border-[#a97850] focus:ring-2 focus:ring-[#a97850]/15 placeholder:text-[#9ba49c] dark:placeholder:text-[#7d877e]";
  return (
    <label className="block text-sm font-medium text-[#49524c] dark:text-[#ccd3cb]">
      {label}
      {multiline ? (
        <textarea
          className={`${common} min-h-24 resize-y`}
          value={value}
          autoComplete={autocomplete}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        type === "number" ? (
          <NumericInput
            className={common}
            value={value}
            placeholder={placeholder}
            autoComplete={autocomplete}
            onChange={(event) => onChange(event.target.value)}
            required={required}
          />
        ) : (
          <input
            className={common}
            type={type}
            value={value}
            placeholder={placeholder}
            autoComplete={autocomplete}
            onChange={(event) => onChange(event.target.value)}
            required={required}
          />
        )
      )}
    </label>
  );
}

function PasswordChangeForm({
  onChanged,
  onCancel,
  submitLabel,
}: {
  onChanged: (user: User) => void;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 12) return setError("Le nouveau mot de passe doit contenir au moins 12 caractères.");
    if (newPassword !== confirmPassword) return setError("La confirmation ne correspond pas au nouveau mot de passe.");
    if (newPassword === currentPassword) return setError("Le nouveau mot de passe doit être différent de l’actuel.");
    setError("");
    setSaving(true);
    try {
      const result = await api<{ user: User; permissions: string[] }>("/auth/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      toast.success("Mot de passe modifié.");
      onChanged({ ...result.user, permissions: result.permissions });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium">Mot de passe actuel<input required type="password" autoComplete="current-password" maxLength={200} className={userInputClass} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
      <label className="block text-sm font-medium">Nouveau mot de passe<input required type="password" autoComplete="new-password" minLength={12} maxLength={200} className={userInputClass} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><span className="mt-1 block text-xs font-normal text-[#85877f] dark:text-[#96a094]">12 caractères minimum.</span></label>
      <label className="block text-sm font-medium">Confirmer le nouveau mot de passe<input required type="password" autoComplete="new-password" minLength={12} maxLength={200} className={userInputClass} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
      {error && <p role="alert" className="border border-[#ead6d1] dark:border-[#4a332f] bg-[#fbf3f1] dark:bg-[#2a1d1b] px-3 py-2 text-sm text-[#8a4d43] dark:text-[#e08b7d]">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && <button type="button" onClick={onCancel} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-4 text-sm">Annuler</button>}
        <button disabled={saving} className="inline-flex min-h-10 items-center gap-2 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white disabled:opacity-50"><KeyRound size={15} />{saving ? "Enregistrement…" : submitLabel}</button>
      </div>
    </form>
  );
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super administrateur",
  admin: "Administrateur",
  content_manager: "Gestionnaire de contenu",
  quote_manager: "Gestionnaire devis",
  billing: "Facturation",
  accounting: "Comptabilité",
  viewer: "Observateur",
};

const adminLoadingMessages = [
  "On met tout en place pour vous…",
  "Vos outils seront prêts dans un instant…",
  "Presque prêt, encore un petit moment…",
];

function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [tab, setTab] = useState<Tab>("overview");
  const [quoteStatusFilter, setQuoteStatusFilter] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("");
  const [initialQuoteId, setInitialQuoteId] = useState<number | null>(null);
  const [initialInvoiceId, setInitialInvoiceId] = useState<number | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [newQuoteBannerDismissed, setNewQuoteBannerDismissed] = useState(false);
  const mobileNavListRef = useRef<HTMLElement | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  const theme = useTheme();

  useEffect(() => {
    setThemeScope(true);
    return () => setThemeScope(false);
  }, []);

  useEffect(() => {
    if (!mobileNav) return;

    const scrollY = window.scrollY;
    const body = document.body;
    const previousBodyStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    const previousHtmlOverflow = document.documentElement.style.overflow;

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    let touchStartY = 0;
    const handleTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0;
    };
    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      const nav = mobileNavListRef.current;
      if (!touch || event.touches.length !== 1 || !nav || !nav.contains(event.target as Node)) {
        event.preventDefault();
        return;
      }

      const deltaY = touch.clientY - touchStartY;
      const canScrollUp = nav.scrollTop > 0;
      const canScrollDown = nav.scrollTop + nav.clientHeight < nav.scrollHeight - 1;
      if ((deltaY > 0 && !canScrollUp) || (deltaY < 0 && !canScrollDown)) {
        event.preventDefault();
        return;
      }
      touchStartY = touch.clientY;
    };
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      body.style.position = previousBodyStyles.position;
      body.style.top = previousBodyStyles.top;
      body.style.left = previousBodyStyles.left;
      body.style.right = previousBodyStyles.right;
      body.style.width = previousBodyStyles.width;
      body.style.overflow = previousBodyStyles.overflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [mobileNav]);

  useEffect(() => {
    const handleSessionUpdate = (event: Event) => {
      const { expiresAt } = (event as CustomEvent<{ expiresAt: string }>).detail;
      setSessionExpiresAt(expiresAt);
      toast.dismiss("session-expiring");
    };
    const handleSessionExpiry = (event: Event) => {
      setUser(null);
      setSessionExpiresAt(null);
      toast.error("Session expirée", {
        description: (event as CustomEvent<string>).detail || "Reconnectez-vous pour continuer.",
        duration: 8000,
      });
    };
    window.addEventListener("kdp:session-updated", handleSessionUpdate);
    window.addEventListener("kdp:session-expired", handleSessionExpiry);
    return () => {
      window.removeEventListener("kdp:session-updated", handleSessionUpdate);
      window.removeEventListener("kdp:session-expired", handleSessionExpiry);
    };
  }, []);

  useEffect(() => {
    if (!user || !sessionExpiresAt) return;
    const warnAt = Date.parse(sessionExpiresAt) - 5 * 60 * 1000;
    const warnTimer = window.setTimeout(() => {
      toast.warning("Votre session expire bientôt", {
        id: "session-expiring",
        description: "L’inactivité ou la durée maximale entraînera votre déconnexion. Reprenez une action pour prolonger la session.",
        duration: 10000,
      });
    }, Math.max(0, warnAt - Date.now()));
    const expireTimer = window.setTimeout(() => {
      setUser(null);
      setSessionExpiresAt(null);
      toast.error("Session expirée", { description: "Reconnectez-vous pour continuer.", duration: 8000 });
    }, Math.max(0, Date.parse(sessionExpiresAt) - Date.now()));
    return () => {
      window.clearTimeout(warnTimer);
      window.clearTimeout(expireTimer);
    };
  }, [user, sessionExpiresAt]);

  useEffect(() => {
    if (!user) return;
    let lastInteraction = Date.now();
    let lastHeartbeat = lastInteraction;
    const markActive = () => { lastInteraction = Date.now(); };
    const events = ["pointerdown", "keydown", "touchstart", "scroll"];
    events.forEach((event) => window.addEventListener(event, markActive, { passive: true }));
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState !== "visible" || lastInteraction <= lastHeartbeat) return;
      lastHeartbeat = lastInteraction;
      void api("/auth/activity", { method: "POST" }).catch(() => {});
    }, 60 * 1000);
    return () => {
      window.clearInterval(heartbeat);
      events.forEach((event) => window.removeEventListener(event, markActive));
    };
  }, [user]);

  const navigateAdmin = (nextTab: Tab, filter = "", quoteId: number | null = null, invoiceId: number | null = null) => {
    setTab(nextTab);
    setMobileNav(false);
    if (nextTab === "quotes") setQuoteStatusFilter(filter);
    if (nextTab === "invoices") setInvoiceStatusFilter(filter);
    setInitialQuoteId(nextTab === "quotes" ? quoteId : null);
    setInitialInvoiceId(nextTab === "invoices" ? invoiceId : null);
  };

  useEffect(() => {
    if (!checking) return;
    const timer = window.setInterval(() => {
      setLoadingMessageIndex((index) => (index + 1) % adminLoadingMessages.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [checking]);

  useEffect(() => {
    api<{ user: User }>("/auth/session")
      .then((result) => setUser(result.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    const granted = user.permissions ?? [];
    const item = navigation.find((entry) => entry.id === tab);
    if (item && !granted.includes(item.permission)) setTab("overview");
  }, [user, tab]);

  useEffect(() => {
    const receiveSecureLink = (event: Event) => {
      const secureLink = (event as CustomEvent<string>).detail;
      if (!secureLink) return;
      void navigator.clipboard?.writeText(secureLink).catch(() => {});
      window.setTimeout(() => toast.success("Lien sécurisé copié.", { description: secureLink, duration: 8000 }), 0);
    };
    window.addEventListener("kdp:secure-quote-link", receiveSecureLink);
    return () =>
      window.removeEventListener("kdp:secure-quote-link", receiveSecureLink);
  }, []);

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await action();
      if (success) toast.success(success);
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === "SESSION_EXPIRED") return;
      toast.error(
        reason instanceof Error ? reason.message : "Une erreur est survenue.",
      );
    } finally {
      setBusy(false);
    }
  };

  async function login(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const result = await api<{ user: User; permissions: string[] }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      setUser({ ...result.user, permissions: result.permissions });
      setLoginPassword("");
      if (!result.user.mustChangePassword) setTab("overview");
    });
  }

  const logout = () =>
    run(async () => {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      setNewQuoteBannerDismissed(false);
      setPasswordDialog(false);
    }, "Session terminée.");

  if (checking)
    return (
      <div role="status" aria-live="polite" className="grid min-h-screen place-items-center bg-[#f5f4f0] px-6 text-center dark:bg-[#121713]">
        <div className="flex flex-col items-center">
          <div className="relative mb-6 h-16 w-16" aria-hidden="true">
            <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-[#e5e1d8] border-t-[#a97850] dark:border-[#303a32] dark:border-t-[#dcb487]" />
            <div className="absolute inset-[9px] grid place-items-center rounded-full bg-white text-[#a97850] shadow-sm dark:bg-[#1b221c] dark:text-[#dcb487]">
              <LayoutDashboard size={20} />
            </div>
          </div>
          <p className="font-medium text-[#29352f] dark:text-[#e9ece6]">Votre espace de travail arrive…</p>
          <p key={loadingMessageIndex} className="mt-2 min-h-6 text-sm text-[#73766f] dark:text-[#aab3a8]">
            {adminLoadingMessages[loadingMessageIndex]}
          </p>
        </div>
      </div>
    );
  if (!user)
    return (
      <div className="grid min-h-screen bg-[#f4f3ef] dark:bg-[#121713] lg:grid-cols-[1fr_440px]">
        <section className="relative hidden overflow-hidden bg-[#263b32] dark:bg-[#2f4438] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(#d9c7ad 0.7px, transparent 0.7px)",
              backgroundSize: "18px 18px",
            }}
          />
          <a href="/" className="relative font-heading text-2xl">
            Khalil <span className="text-[#c49a6d] dark:text-[#dcb487]">Déco</span> Plâtre
          </a>
          <div className="relative max-w-xl pb-12">
            <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-[#c49a6d] dark:text-[#dcb487]">
              ESPACE DE GESTION
            </p>
            <h1 className="font-heading text-5xl leading-tight">
              L'atelier, côté coulisses.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/65">
              Devis, facturation et identité de votre entreprise, réunis dans un
              espace de travail sécurisé.
            </p>
          </div>
          <p className="relative text-xs text-white/45">
            Khalil Déco Plâtre · Sénégal
          </p>
        </section>
        <main className="flex items-center justify-center p-6 sm:p-12">
          <form onSubmit={login} className="w-full max-w-sm">
            <a
              href="/"
              className="font-heading text-xl font-semibold text-[#29352f] dark:text-[#e9ece6] lg:hidden"
            >
              Khalil Déco Plâtre
            </a>
            <div className="mb-8 mt-12">
              <p className="text-xs font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">
                ADMINISTRATION
              </p>
              <h2 className="mt-2 font-heading text-4xl text-[#29352f] dark:text-[#e9ece6]">
                Connexion
              </h2>
              <p className="mt-2 text-sm text-[#767971] dark:text-[#aab3a8]">
                Accédez à votre espace de gestion.
              </p>
            </div>
            <div className="space-y-5">
              <Field
                label="Adresse e-mail"
                value={loginEmail}
                onChange={setLoginEmail}
                type="email"
                required
              />
              <Field
                label="Mot de passe"
                value={loginPassword}
                onChange={setLoginPassword}
                type="password"
                required
              />
            </div>
            <button
              disabled={busy}
              className="mt-7 flex w-full items-center justify-center gap-2 bg-[#293b32] dark:bg-[#2f4438] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#354b3f] hover:dark:bg-[#3d5648] disabled:opacity-50"
            >
              <ShieldCheck size={17} />
              {busy ? "Connexion…" : "Se connecter"}
            </button>
            <p className="mt-6 text-center text-xs leading-5 text-[#85877f] dark:text-[#96a094]">
              Les comptes sont créés par le super administrateur dans
              l’espace Administration.
            </p>
          </form>
        </main>
      </div>
    );

  if (user.mustChangePassword)
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f3ef] dark:bg-[#121713] px-6 py-10 text-[#29352f] dark:text-[#e9ece6]">
        <div className="w-full max-w-md border border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] px-6 py-8">
          <p className="text-xs font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">PREMIÈRE CONNEXION</p>
          <h2 className="mt-2 font-heading text-3xl">Choisissez votre mot de passe</h2>
          <p className="mt-2 mb-6 text-sm text-[#767971] dark:text-[#aab3a8]">
            Bonjour {user.name}, votre compte utilise un mot de passe provisoire. Remplacez-le par un mot de passe personnel pour accéder à l’administration.
          </p>
          <PasswordChangeForm submitLabel="Enregistrer et continuer" onChanged={setUser} />
          <button type="button" onClick={logout} className="mt-6 inline-flex items-center gap-2 text-xs text-[#6e746c] dark:text-[#a8b1a6] hover:underline"><LogOut size={14} />Se déconnecter</button>
        </div>
      </div>
    );

  const permissions = user.permissions ?? [];
  const visibleNavigation = navigation.filter((item) => permissions.includes(item.permission));
  const active = navigation.find((item) => item.id === tab)!;
  const content = (
    <AdminContent
      tab={tab}
      user={user}
      run={run}
      busy={busy}
      onNavigate={navigateAdmin}
      quoteStatusFilter={quoteStatusFilter}
      invoiceStatusFilter={invoiceStatusFilter}
      initialQuoteId={initialQuoteId}
      clearInitialQuote={() => setInitialQuoteId(null)}
      initialInvoiceId={initialInvoiceId}
      clearInitialInvoice={() => setInitialInvoiceId(null)}
      newQuoteBannerDismissed={newQuoteBannerDismissed}
      dismissNewQuoteBanner={() => setNewQuoteBannerDismissed(true)}
    />
  );

  return (
    <div className="min-h-screen bg-[#f5f4f0] dark:bg-[#121713] text-[#29352f] dark:text-[#e9ece6]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col overflow-hidden border-r border-[#e7e4dc] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] transition-transform lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[76px] items-center justify-between border-b border-[#e7e4dc] dark:border-[#2b342c] px-6">
          <a href="/" className="font-heading text-xl font-semibold">
            Khalil <span className="text-[#b17d53] dark:text-[#dcb487]">Déco</span>
          </a>
          <button
            onClick={() => setMobileNav(false)}
            className="lg:hidden"
            aria-label="Fermer le menu"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-4 py-5">
          <div className="flex items-center gap-3 border border-[#e7e4dc] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-3">
            <div className="grid size-9 place-items-center bg-[#e9eee9] dark:bg-[#1f2c22] text-[#48624e] dark:text-[#9ecfa9]">
              <Activity size={17} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="text-xs text-[#85877f] dark:text-[#96a094]">{ROLE_LABELS[user.role] || "Membre"}</p>
            </div>
            <BadgeCheck size={16} className="ml-auto shrink-0 text-[#68856d] dark:text-[#9ecfa9]" />
          </div>
        </div>
        <nav ref={mobileNavListRef} className="min-h-0 flex-1 touch-pan-y overscroll-contain overflow-y-auto px-3 pb-5">
          {["ACTIVITÉ", "CONFIGURATION", "CONTENU"].map((group) => (
            <div key={group} className="mb-5">
              <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.16em] text-[#97988f] dark:text-[#8b948a]">
                {group}
              </p>
              {visibleNavigation
                .filter((item) => item.group === group)
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigateAdmin(item.id)}
                    className={`mb-1 flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] transition ${tab === item.id ? "bg-[#e9eee9] dark:bg-[#1f2c22] font-semibold text-[#344b3b] dark:text-[#cfe0d2]" : "text-[#656a64] dark:text-[#a8b1a6] hover:bg-[#f0efe9] hover:dark:bg-[#20281f]"}`}
                  >
                    <item.icon size={17} strokeWidth={1.8} />
                    {item.label}
                    {tab === item.id && (
                      <ChevronRight size={15} className="ml-auto" />
                    )}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-[#e7e4dc] dark:border-[#2b342c] p-3">
          <a
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-[#646a64] dark:text-[#a8b1a6] hover:bg-[#f0efe9] hover:dark:bg-[#20281f]"
          >
            <FileImage size={17} />
            Voir le site public
          </a>
          <button
            onClick={() => setPasswordDialog(true)}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-[#646a64] dark:text-[#a8b1a6] hover:bg-[#f0efe9] hover:dark:bg-[#20281f]"
          >
            <KeyRound size={17} />
            Changer mon mot de passe
          </button>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-[#646a64] dark:text-[#a8b1a6] hover:bg-[#f0efe9] hover:dark:bg-[#20281f]"
          >
            <LogOut size={17} />
            Se déconnecter
          </button>
        </div>
      </aside>
      {mobileNav && (
        <button
          aria-label="Fermer le menu"
          onClick={() => setMobileNav(false)}
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
        />
      )}
      <main className="min-h-screen lg:pl-[270px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-[#e7e4dc] dark:border-[#2b342c] bg-[#fbfaf7]/95 dark:bg-[#171d18]/95 px-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden"
              aria-label="Ouvrir le menu"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </button>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.15em] text-[#9a7a5b] dark:text-[#c9a97e]">
                KHALIL DÉCO PLÂTRE
              </p>
              <h1 className="text-sm font-semibold sm:text-base">
                {active.label}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Activer le thème clair"
                  : "Activer le thème sombre"
              }
              aria-pressed={theme === "dark"}
              title={theme === "dark" ? "Thème clair" : "Thème sombre"}
              className="grid size-9 place-items-center rounded-full border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] text-[#687068] dark:text-[#b3bcb2] transition hover:border-[#c9b69f] hover:dark:border-[#5a4a38] hover:text-[#a97850] hover:dark:text-[#dcb487] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a97850]/30"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <a
              href="/"
              className="hidden text-xs text-[#6e746c] dark:text-[#a8b1a6] hover:text-[#29352f] hover:dark:text-[#e9ece6] sm:block"
            >
              Retour au site ↗
            </a>
          </div>
        </header>
        <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-8 sm:py-9">
          {content}
        </div>
        <ShareTray />
      </main>
      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0">
          <DialogHeader className="border-b border-[#e8e5de] dark:border-[#2b342c] px-5 py-5 pr-14"><p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">SÉCURITÉ</p><DialogTitle className="font-heading text-2xl">Changer mon mot de passe</DialogTitle><DialogDescription className="text-sm text-[#72766e] dark:text-[#aab3a8]">Vos autres sessions ouvertes seront fermées.</DialogDescription></DialogHeader>
          <div className="px-5 py-5">{passwordDialog && <PasswordChangeForm submitLabel="Modifier le mot de passe" onCancel={() => setPasswordDialog(false)} onChanged={(next) => { setUser(next); setPasswordDialog(false); }} />}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminContent({
  tab,
  user,
  run,
  busy,
  onNavigate,
  quoteStatusFilter,
  invoiceStatusFilter,
  initialQuoteId,
  clearInitialQuote,
  initialInvoiceId,
  clearInitialInvoice,
  newQuoteBannerDismissed,
  dismissNewQuoteBanner,
}: {
  tab: Tab;
  user: User;
  run: (action: () => Promise<unknown>, success?: string) => Promise<void>;
  busy: boolean;
  onNavigate: (tab: Tab, filter?: string, quoteId?: number | null, invoiceId?: number | null) => void;
  quoteStatusFilter: string;
  invoiceStatusFilter: string;
  initialQuoteId: number | null;
  clearInitialQuote: () => void;
  initialInvoiceId: number | null;
  clearInitialInvoice: () => void;
  newQuoteBannerDismissed: boolean;
  dismissNewQuoteBanner: () => void;
}) {
  if (tab === "overview") return <Overview onNavigate={onNavigate} permissions={user.permissions ?? []} userName={user.name} newQuoteBannerDismissed={newQuoteBannerDismissed} dismissNewQuoteBanner={dismissNewQuoteBanner} />;
  if (tab === "quotes") return <Quotes run={run} onNavigate={onNavigate} initialStatus={quoteStatusFilter} initialQuoteId={initialQuoteId} clearInitialQuote={clearInitialQuote} canCreate={(user.permissions ?? []).includes("quotes.edit")} />;
  if (tab === "invoices") return <Invoices run={run} initialStatus={invoiceStatusFilter} initialInvoiceId={initialInvoiceId} clearInitialInvoice={clearInitialInvoice} canDelete={(user.permissions ?? []).includes("invoices.edit")} />;
  if (tab === "clients") return <ClientsAdmin onNavigate={onNavigate} />;
  if (tab === "users") return <UsersAdmin run={run} currentUser={user} />;
  if (tab === "sessions") return <SessionsAdmin run={run} />;
  if (tab === "reviews") return <ReviewsAdmin run={run} />;
  if (tab === "ceilingModels") return <CeilingModelManager run={run} />;
  if (tab === "company" || tab === "documents")
    return <SettingsForm kind={tab} run={run} busy={busy} />;
  if (tab === "pricing") return <Pricing run={run} />;
  if (tab === "services") return <SupplementalServices run={run} />;
  if (tab === "backups") return <BackupManager run={run} busy={busy} />;
  return <MediaLibrary run={run} />;
}

type ActiveSession = {
  id: string;
  userId: number;
  userName: string;
  userEmail: string;
  role: string;
  createdAt: string;
  lastActivity: string;
  userAgent: string;
  expiresAt: string;
  isCurrent: boolean;
};

function describeSessionDevice(userAgent: string) {
  const browser = /Edg\//.test(userAgent) ? "Microsoft Edge"
    : /Firefox\//.test(userAgent) ? "Mozilla Firefox"
      : /Chrome\//.test(userAgent) ? "Google Chrome"
        : /Safari\//.test(userAgent) ? "Safari"
          : "Navigateur non identifié";
  const device = /iPad|Tablet/i.test(userAgent) ? "Tablette"
    : /Mobile|Android|iPhone/i.test(userAgent) ? "Mobile"
      : /Windows|Macintosh|Linux/i.test(userAgent) ? "Ordinateur"
        : "Appareil non identifié";
  return `${browser} · ${device}`;
}

function SessionsAdmin({ run }: {
  run: (action: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const confirm = useConfirm();

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSessions(await api<ActiveSession[]>("/admin/sessions"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger les sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const revokeSession = async (session: ActiveSession) => {
    if (!(await confirm({
      title: `Révoquer la session de ${session.userName} ?`,
      message: "Cet appareil devra se reconnecter pour accéder à l’administration.",
      confirmLabel: "Révoquer la session",
      destructive: true,
    }))) return;
    await run(async () => {
      await api("/admin/sessions", { method: "DELETE", body: JSON.stringify({ id: session.id }) });
      setSessions((current) => current.filter((entry) => entry.id !== session.id));
    }, "Session révoquée.");
  };

  return <>
    <PageTitle
      eyebrow="SÉCURITÉ"
      title="Sessions actives"
      note="Consultez les connexions en cours et révoquez à distance un appareil. La session actuelle ne peut être fermée qu’avec Déconnexion."
      action={<button type="button" onClick={() => void loadSessions()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 text-xs font-medium disabled:opacity-50"><Activity size={15} />Actualiser</button>}
    />
    {error && <p role="alert" className="mb-4 border border-red-200 dark:border-[#4a332f] bg-red-50 dark:bg-[#2b1f1d] p-3 text-sm text-red-800 dark:text-[#eaa79b]">{error}</p>}
    {loading ? (
      <div className="grid gap-3 md:grid-cols-2">{[0, 1].map((item) => <div key={item} className="h-36 animate-pulse border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c]" />)}</div>
    ) : !sessions.length ? (
      <div className="border border-dashed border-[#d8d5cc] dark:border-[#3a443b] bg-white dark:bg-[#1b221c] px-5 py-14 text-center"><Activity size={26} className="mx-auto text-[#9a7a5b] dark:text-[#c9a97e]" /><p className="mt-3 text-sm font-semibold">Aucune session active</p><p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">Les connexions expirées ou révoquées ne sont pas affichées.</p></div>
    ) : (
      <div className="grid gap-3 md:grid-cols-2">
        {sessions.map((session) => (
          <article key={session.id} className="border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{session.userName}</p>
                <p className="mt-0.5 truncate text-xs text-[#85877f] dark:text-[#96a094]">{session.userEmail} · {ROLE_LABELS[session.role] || session.role}</p>
              </div>
              {session.isCurrent && <span className="shrink-0 border border-[#d9e4d7] dark:border-[#31503a] bg-[#f1f6ef] dark:bg-[#1f2c22] px-2 py-1 text-[10px] font-semibold text-[#304737] dark:text-[#cfe0d2]">Cet appareil</span>}
            </div>
            <p className="mt-4 text-xs font-medium">{describeSessionDevice(session.userAgent)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-[#72766e] dark:text-[#aab3a8]">
              <dt>Connexion</dt><dd className="text-right">{new Date(session.createdAt).toLocaleString("fr-FR")}</dd>
              <dt>Dernière activité</dt><dd className="text-right">{new Date(session.lastActivity).toLocaleString("fr-FR")}</dd>
              <dt>Expiration prévue</dt><dd className="text-right">{new Date(session.expiresAt).toLocaleString("fr-FR")}</dd>
            </dl>
            <button type="button" disabled={session.isCurrent} onClick={() => void revokeSession(session)} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 border border-[#ead6d1] dark:border-[#4a332f] px-3 text-xs font-medium text-[#8a4d43] hover:bg-[#fdf5f2] hover:dark:bg-[#2b1f1d] disabled:cursor-not-allowed disabled:opacity-45">
              <LogOut size={14} />{session.isCurrent ? "Déconnexion depuis le menu" : "Révoquer cette session"}
            </button>
          </article>
        ))}
      </div>
    )}
  </>;
}

function PageTitle({
  eyebrow,
  title,
  note,
  action,
}: {
  eyebrow: string;
  title: string;
  note: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[10px] font-bold tracking-[0.17em] text-[#a97850] dark:text-[#dcb487]">
          {eyebrow}
        </p>
        <h2 className="mt-1 font-heading text-3xl font-semibold sm:text-4xl">
          {title}
        </h2>
        <p className="mt-1.5 text-sm text-[#72766e] dark:text-[#aab3a8]">{note}</p>
      </div>
      {action}
    </div>
  );
}

type AdminUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
  lastActivity: string | null;
  lastLoginAt: string | null;
};
type PermissionCatalog = {
  permissions: Record<string, string>;
  rolePresets: Record<string, string[]>;
  roleLabels: Record<string, string>;
};
type ActivityEntry = { id: number; action: string; details: Record<string, unknown>; createdAt: string };

const userInputClass = "mt-1.5 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 py-2.5 text-sm outline-none focus:border-[#a97850]";

function UsersAdmin({
  run,
  currentUser,
}: {
  run: (action: () => Promise<unknown>, success?: string) => Promise<void>;
  currentUser: User;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const confirm = useConfirm();
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [draft, setDraft] = useState({ name: "", email: "", role: "content_manager", password: "" });
  const [permUser, setPermUser] = useState<AdminUser | null>(null);
  const [permDraft, setPermDraft] = useState<Record<string, boolean>>({});
  const [pwdUser, setPwdUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [activityUser, setActivityUser] = useState<AdminUser | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [userRows, permissionCatalog] = await Promise.all([
        api<AdminUser[]>("/admin/users"),
        api<PermissionCatalog>("/admin/permissions"),
      ]);
      setUsers(userRows);
      setCatalog(permissionCatalog);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const beginCreate = () => {
    setEditing(null);
    setDraft({ name: "", email: "", role: "content_manager", password: "" });
    setEditorOpen(true);
  };

  const beginEdit = (user: AdminUser) => {
    setEditing(user);
    setDraft({ name: user.name, email: user.email, role: user.role, password: "" });
    setEditorOpen(true);
  };

  const saveUser = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      await api(editing ? `/admin/users/${editing.id}` : "/admin/users", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(
          editing
            ? { name: draft.name, email: draft.email, role: draft.role }
            : { name: draft.name, email: draft.email, role: draft.role, password: draft.password },
        ),
      });
      setEditorOpen(false);
      await load();
    }, editing ? "Utilisateur mis à jour." : "Utilisateur créé avec succès.");
  };

  const setUserActive = async (user: AdminUser, active: boolean) => {
    if (
      !active &&
      !(await confirm({
        title: `Désactiver l’accès de ${user.name} ?`,
        message: "Ses sessions en cours seront fermées. Il pourra être réactivé plus tard.",
        confirmLabel: "Désactiver",
        destructive: true,
      }))
    )
      return;
    await run(async () => {
      await api(`/admin/users/${user.id}/active`, { method: "PATCH", body: JSON.stringify({ active }) });
      await load();
    }, active ? "Utilisateur réactivé." : "Utilisateur désactivé.");
  };

  const deleteUser = async (user: AdminUser) => {
    if (
      !(await confirm({
        title: `Supprimer le compte de ${user.name} ?`,
        message: "Cette suppression est définitive. Un compte ayant laissé un paiement ou une trace documentaire ne peut être que désactivé.",
        confirmLabel: "Supprimer",
        destructive: true,
      }))
    )
      return;
    await run(async () => {
      await api(`/admin/users/${user.id}`, { method: "DELETE" });
      await load();
    }, "Compte supprimé.");
  };

  const resetPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!pwdUser) return;
    if (newPassword !== confirmNewPassword) {
      toast.error("La confirmation ne correspond pas au mot de passe.");
      return;
    }
    await run(async () => {
      await api(`/admin/users/${pwdUser.id}/password`, { method: "POST", body: JSON.stringify({ password: newPassword }) });
      setPwdUser(null);
      setNewPassword("");
      setConfirmNewPassword("");
    }, pwdUser.id === currentUser.id ? "Mot de passe modifié." : "Accès réinitialisé. L’utilisateur devra choisir un nouveau mot de passe à sa prochaine connexion.");
  };

  const openPermissions = async (user: AdminUser) => {
    if (!catalog) return;
    try {
      const current = await api<{ effective: string[] }>(`/admin/users/${user.id}/permissions`);
      setPermDraft(Object.fromEntries(Object.keys(catalog.permissions).map((key) => [key, current.effective.includes(key)])));
      setPermUser(user);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Impossible de charger les permissions.");
    }
  };

  const savePermissions = async (event: FormEvent) => {
    event.preventDefault();
    if (!permUser) return;
    await run(async () => {
      await api(`/admin/users/${permUser.id}/permissions`, { method: "PUT", body: JSON.stringify({ permissions: permDraft }) });
      setPermUser(null);
      await load();
    }, "Permissions mises à jour.");
  };

  const openActivity = async (user: AdminUser) => {
    setActivityUser(user);
    setActivity([]);
    try {
      setActivity(await api<ActivityEntry[]>(`/admin/users/${user.id}/activity`));
    } catch {
      setActivity([]);
    }
  };

  const term = search.trim().toLowerCase();
  const visible = users.filter((user) => !term || `${user.name} ${user.email}`.toLowerCase().includes(term));
  const roleLabel = (role: string) => catalog?.roleLabels[role] || ROLE_LABELS[role] || role;

  return <>
    <PageTitle
      eyebrow="SÉCURITÉ"
      title="Utilisateurs & Permissions"
      note="Le super administrateur crée les comptes, attribue les rôles et vérifie les permissions côté serveur."
      action={<button onClick={beginCreate} className="inline-flex min-h-11 items-center gap-2 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white hover:bg-[#354b3f] hover:dark:bg-[#3d5648]"><UserRoundPlus size={16} />Créer un utilisateur</button>}
    />
    <div className="mb-4 flex items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3">
      <Search size={16} className="shrink-0 text-[#85877f] dark:text-[#96a094]" />
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un utilisateur…" aria-label="Rechercher un utilisateur" className="min-h-11 w-full bg-transparent text-sm outline-none" />
    </div>
    {loading ? <div className="space-y-2">{[0, 1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c]" />)}</div> : !visible.length ? <div className="border border-dashed border-[#d8d5cc] dark:border-[#3a443b] bg-white dark:bg-[#1b221c] px-5 py-14 text-center"><ShieldCheck size={26} className="mx-auto text-[#9a7a5b] dark:text-[#c9a97e]" /><p className="mt-3 text-sm font-semibold">Aucun utilisateur trouvé</p><p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">Créez un compte pour donner accès à l’administration.</p></div> : <>
      <div className="hidden overflow-x-auto border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] lg:block">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-[#e8e5de] dark:border-[#2b342c] bg-[#f7f6f2] dark:bg-[#1e261f] text-xs text-[#72766e] dark:text-[#aab3a8]">
            <tr><th className="px-4 py-3 font-medium">Utilisateur</th><th className="px-4 py-3 font-medium">Rôle</th><th className="px-4 py-3 font-medium">Statut</th><th className="px-4 py-3 font-medium">Suivi du compte</th><th className="px-4 py-3 font-medium">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-[#efede7] dark:divide-[#262e27]">
            {visible.map((user) => <tr key={user.id} className="hover:bg-[#fbfaf7] hover:dark:bg-[#171d18]">
              <td className="px-4 py-3"><p className="font-semibold">{user.name}{user.id === currentUser.id && <span className="ml-2 text-[11px] font-normal text-[#a97850] dark:text-[#dcb487]">(vous)</span>}</p><p className="text-xs text-[#85877f] dark:text-[#96a094]">{user.email}</p></td>
              <td className="px-4 py-3">{roleLabel(user.role)}</td>
              <td className="px-4 py-3"><span className={`inline-flex border px-2 py-1 text-[11px] font-medium ${user.active ? "border-[#cdded0] dark:border-[#31503a] bg-[#eef5ef] dark:bg-[#1f2c22] text-[#3f6948] dark:text-[#8fc79d]" : "border-[#ead6d1] dark:border-[#4a332f] bg-[#f8efed] dark:bg-[#2b1f1d] text-[#8a4d43] dark:text-[#e08b7d]"}`}>{user.active ? "Actif" : "Désactivé"}</span></td>
              <td className="px-4 py-3 text-xs text-[#72766e] dark:text-[#aab3a8]">
                <p>Créé le {new Date(user.createdAt).toLocaleDateString("fr-FR")}</p>
                <p className="mt-0.5">Dernière connexion : {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("fr-FR") : "jamais"}</p>
                <p className="mt-0.5">Dernière action : {user.lastActivity ? new Date(user.lastActivity).toLocaleString("fr-FR") : "aucune"}</p>
              </td>
              <td className="px-4 py-3"><div className="flex flex-wrap gap-2">
                <button onClick={() => beginEdit(user)} className="min-h-9 border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs">Modifier</button>
                {user.role !== "super_admin" && <button onClick={() => void openPermissions(user)} className="min-h-9 border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs">Permissions</button>}
                <button onClick={() => setPwdUser(user)} className="min-h-9 border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs">Réinitialiser l’accès</button>
                {user.id !== currentUser.id && <button onClick={() => void setUserActive(user, !user.active)} className={`min-h-9 px-3 text-xs ${user.active ? "text-[#8a4d43] dark:text-[#e08b7d]" : "text-[#536451] dark:text-[#a9bfa4]"}`}>{user.active ? "Désactiver" : "Réactiver"}</button>}
                {user.id !== currentUser.id && <button onClick={() => void deleteUser(user)} className="min-h-9 border border-[#ead6d1] dark:border-[#4a332f] px-3 text-xs text-[#8a4d43] dark:text-[#e08b7d] hover:bg-[#f8efed] hover:dark:bg-[#2b1f1d]">Supprimer</button>}
                <button onClick={() => void openActivity(user)} className="min-h-9 border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs">Activité</button>
              </div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 lg:hidden">{visible.map((user) => <article key={user.id} className="border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{user.name}{user.id === currentUser.id && <span className="ml-2 text-[11px] font-normal text-[#a97850] dark:text-[#dcb487]">(vous)</span>}</p><p className="truncate text-xs text-[#85877f] dark:text-[#96a094]">{user.email}</p></div><span className={`shrink-0 border px-2 py-1 text-[11px] font-medium ${user.active ? "border-[#cdded0] dark:border-[#31503a] bg-[#eef5ef] dark:bg-[#1f2c22] text-[#3f6948] dark:text-[#8fc79d]" : "border-[#ead6d1] dark:border-[#4a332f] bg-[#f8efed] dark:bg-[#2b1f1d] text-[#8a4d43] dark:text-[#e08b7d]"}`}>{user.active ? "Actif" : "Désactivé"}</span></div>
        <p className="mt-2 text-xs text-[#72766e] dark:text-[#aab3a8]">{roleLabel(user.role)} · créé le {new Date(user.createdAt).toLocaleDateString("fr-FR")}</p>
        <p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">Dernière connexion : {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("fr-FR") : "jamais"}</p>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-[#efede7] dark:border-[#262e27] pt-3">
          <button onClick={() => beginEdit(user)} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs">Modifier</button>
          {user.role !== "super_admin" && <button onClick={() => void openPermissions(user)} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs">Permissions</button>}
          <button onClick={() => setPwdUser(user)} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs">Réinitialiser l’accès</button>
          {user.id !== currentUser.id && <button onClick={() => void setUserActive(user, !user.active)} className={`min-h-10 px-3 text-xs ${user.active ? "text-[#8a4d43] dark:text-[#e08b7d]" : "text-[#536451] dark:text-[#a9bfa4]"}`}>{user.active ? "Désactiver" : "Réactiver"}</button>}
          {user.id !== currentUser.id && <button onClick={() => void deleteUser(user)} className="min-h-10 border border-[#ead6d1] dark:border-[#4a332f] px-3 text-xs text-[#8a4d43] dark:text-[#e08b7d]">Supprimer</button>}
          <button onClick={() => void openActivity(user)} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs">Activité</button>
        </div>
      </article>)}</div>
    </>}

    <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0 sm:max-h-[88dvh]">
        <DialogHeader className="border-b border-[#e8e5de] dark:border-[#2b342c] px-5 py-5 pr-14 sm:px-7"><p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">COMPTES D’ADMINISTRATION</p><DialogTitle className="font-heading text-2xl">{editing ? "Modifier l’utilisateur" : "Créer un utilisateur"}</DialogTitle><DialogDescription className="text-sm text-[#72766e] dark:text-[#aab3a8]">Le rôle applique un jeu de permissions par défaut, ajustable ensuite.</DialogDescription></DialogHeader>
        <form onSubmit={saveUser} className="space-y-4 px-5 py-5 sm:px-7">
          <label className="block text-sm font-medium">Nom complet<input required minLength={2} maxLength={120} className={userInputClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label className="block text-sm font-medium">Adresse e-mail<input required type="email" maxLength={180} className={userInputClass} value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>
          <label className="block text-sm font-medium">Rôle<select required className={userInputClass} value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>{catalog ? Object.keys(catalog.rolePresets).map((role) => <option key={role} value={role}>{catalog.roleLabels[role]}</option>) : Object.entries(ROLE_LABELS).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select></label>
          {!editing && <label className="block text-sm font-medium">Mot de passe<input required type="password" minLength={12} maxLength={200} className={userInputClass} value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} /><span className="mt-1 block text-xs font-normal text-[#85877f] dark:text-[#96a094]">12 caractères minimum.</span></label>}
          <div className="flex justify-end gap-2 border-t border-[#e8e5de] dark:border-[#2b342c] pt-4"><button type="button" onClick={() => setEditorOpen(false)} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-4 text-sm">Annuler</button><button className="min-h-10 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white">{editing ? "Enregistrer" : "Créer le compte"}</button></div>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(permUser)} onOpenChange={(open) => { if (!open) setPermUser(null); }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0 sm:max-h-[88dvh]">
        <DialogHeader className="border-b border-[#e8e5de] dark:border-[#2b342c] px-5 py-5 pr-14 sm:px-7"><p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">PERMISSIONS</p><DialogTitle className="font-heading text-2xl">Permissions de {permUser?.name}</DialogTitle><DialogDescription className="text-sm text-[#72766e] dark:text-[#aab3a8]">Base : {permUser ? roleLabel(permUser.role) : ""}. Chaque accès est contrôlé côté serveur, pas seulement affiché.</DialogDescription></DialogHeader>
        {permUser && catalog && <form onSubmit={savePermissions} className="px-5 py-5 sm:px-7">
          <div className="grid gap-2 sm:grid-cols-2">{Object.entries(catalog.permissions).map(([key, label]) => <label key={key} className="flex min-h-11 cursor-pointer items-center gap-3 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] px-3 py-2 text-sm"><input type="checkbox" checked={Boolean(permDraft[key])} onChange={(event) => setPermDraft({ ...permDraft, [key]: event.target.checked })} /><span>{label}</span></label>)}</div>
          <div className="mt-5 flex justify-end gap-2 border-t border-[#e8e5de] dark:border-[#2b342c] pt-4"><button type="button" onClick={() => setPermUser(null)} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-4 text-sm">Annuler</button><button className="min-h-10 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white">Enregistrer les permissions</button></div>
        </form>}
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(pwdUser)} onOpenChange={(open) => { if (!open) { setPwdUser(null); setNewPassword(""); setConfirmNewPassword(""); } }}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0">
        <DialogHeader className="border-b border-[#e8e5de] dark:border-[#2b342c] px-5 py-5 pr-14"><p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">SÉCURITÉ</p><DialogTitle className="font-heading text-2xl">Réinitialiser l’accès</DialogTitle><DialogDescription className="text-sm text-[#72766e] dark:text-[#aab3a8]">Mot de passe provisoire pour {pwdUser?.name}. Ses sessions actives seront fermées et il devra le remplacer à sa prochaine connexion.</DialogDescription></DialogHeader>
        {pwdUser && <form onSubmit={resetPassword} className="space-y-4 px-5 py-5">
          <label className="block text-sm font-medium">Nouveau mot de passe<input required type="password" minLength={12} maxLength={200} className={userInputClass} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
          <label className="block text-sm font-medium">Confirmer le mot de passe<input required type="password" minLength={12} maxLength={200} className={userInputClass} value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} /></label>
          <div className="flex justify-end gap-2 border-t border-[#e8e5de] dark:border-[#2b342c] pt-4"><button type="button" onClick={() => { setPwdUser(null); setNewPassword(""); setConfirmNewPassword(""); }} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-4 text-sm">Annuler</button><button className="min-h-10 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white">Définir le mot de passe</button></div>
        </form>}
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(activityUser)} onOpenChange={(open) => { if (!open) setActivityUser(null); }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-xl overflow-y-auto border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0">
        <DialogHeader className="border-b border-[#e8e5de] dark:border-[#2b342c] px-5 py-5 pr-14"><p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">JOURNAL</p><DialogTitle className="font-heading text-2xl">Activité de {activityUser?.name}</DialogTitle></DialogHeader>
        <div className="px-5 py-5">{!activity.length ? <p className="py-8 text-center text-sm text-[#85877f] dark:text-[#96a094]">Aucune activité enregistrée.</p> : <ul className="divide-y divide-[#efede7] dark:divide-[#262e27] border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c]">{activity.map((entry) => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><span className="min-w-0 break-words">{entry.action}</span><span className="text-xs text-[#85877f] dark:text-[#96a094]">{new Date(entry.createdAt).toLocaleString("fr-FR")}</span></li>)}</ul>}</div>
      </DialogContent>
    </Dialog>
  </>;
}


function Overview({
  onNavigate,
  permissions,
  userName,
  newQuoteBannerDismissed,
  dismissNewQuoteBanner,
}: {
  onNavigate: (tab: Tab, filter?: string, quoteId?: number | null) => void;
  permissions: string[];
  userName: string;
  newQuoteBannerDismissed: boolean;
  dismissNewQuoteBanner: () => void;
}) {
  const [stats, setStats] = useState<{
    quotes: Array<{ status: string; count: number }>;
    invoiceCount: number;
    invoicesPaid: number;
    invoicesOutstanding: number;
    publishedRealizations: number;
    billed: number;
    collected: number;
    outstanding: number;
  } | null>(null);
  const [error, setError] = useState("");
  const theme = useTheme();
  const [recentQuotes, setRecentQuotes] = useState<Quote[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  useEffect(() => {
    api<typeof stats>("/admin/dashboard")
      .then(setStats)
      .catch((reason) => setError(reason.message));
    api<Invoice[]>("/admin/invoices").then(setRecentInvoices).catch(() => setRecentInvoices([]));
  }, []);
  useEffect(() => {
    if (!permissions.includes("requests.view")) return;
    const loadQuotes = () => api<Quote[]>("/admin/quotes")
      .then(setRecentQuotes)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Impossible de charger les demandes."));
    void loadQuotes();
    const refresh = window.setInterval(loadQuotes, 30_000);
    return () => window.clearInterval(refresh);
  }, [permissions]);
  const quoteTotal =
    stats?.quotes.reduce((sum, item) => sum + item.count, 0) || 0;
  const newQuoteCount = recentQuotes.filter((quote) => quote.status === "Nouveau").length;
  const firstName = userName.trim().split(/\s+/)[0] || userName;
  const quoteCount = (status: string) => stats?.quotes.find((item) => item.status === status)?.count || 0;
  const cards = [
    {
      label: "Demandes de devis",
      value: quoteTotal,
      detail: "Toutes les demandes",
      icon: FileText,
      tint: "#e7eee8",
      color: "#47604e",
      onClick: () => onNavigate("quotes"),
    },
    {
      label: "Nouveaux devis",
      value: quoteCount("Nouveau"),
      detail: "À traiter",
      icon: FileText,
      tint: "#f4e9dd",
      color: "#a56d43",
      onClick: () => onNavigate("quotes", "Nouveau"),
    },
    {
      label: "Devis acceptés",
      value: quoteCount("Devis accepté"),
      detail: "Prêts à facturer",
      icon: CheckCircle2,
      tint: "#e7eee8",
      color: "#47604e",
      onClick: () => onNavigate("quotes", "Devis accepté"),
    },
    {
      label: "Factures émises",
      value: stats?.invoiceCount || 0,
      detail: "Toutes les factures",
      icon: ReceiptText,
      tint: "#f4e9dd",
      color: "#a56d43",
      onClick: () => onNavigate("invoices"),
    },
    {
      label: "Factures impayées",
      value: stats?.invoicesOutstanding || 0,
      detail: "Un solde reste dû",
      icon: CircleDollarSign,
      tint: "#f2e9e7",
      color: "#9a665c",
      onClick: () => onNavigate("invoices", "impayées"),
    },
    {
      label: "Factures payées",
      value: stats?.invoicesPaid || 0,
      detail: "Soldées",
      icon: CheckCircle2,
      tint: "#e7eee8",
      color: "#47604e",
      onClick: () => onNavigate("invoices", "Payée"),
    },
    {
      label: "Montant facturé",
      value: formatCurrency(stats?.billed || 0),
      detail: "Factures non annulées",
      icon: Wallet,
      tint: "#e7ecee",
      color: "#4e6870",
      onClick: () => onNavigate("invoices"),
    },
    {
      label: "Montant encaissé",
      value: formatCurrency(stats?.collected || 0),
      detail: "Paiements enregistrés",
      icon: Wallet,
      tint: "#e7eee8",
      color: "#47604e",
      onClick: () => onNavigate("invoices", "Payée"),
    },
    {
      label: "Reste à encaisser",
      value: formatCurrency(stats?.outstanding || 0),
      detail: `${formatCurrency(stats?.collected || 0)} encaissés`,
      icon: Activity,
      tint: "#f2e9e7",
      color: "#9a665c",
      onClick: () => onNavigate("invoices", "impayées"),
    },
    {
      label: "Réalisations publiées",
      value: stats?.publishedRealizations || 0,
      detail: "Visibles sur le site",
      icon: Images,
      tint: "#f4e9dd",
      color: "#a56d43",
      onClick: () => onNavigate("media"),
    },
  ];
  return (
    <>
      <div role="status" className="mb-5 flex items-center gap-4 border border-[#d9e4d7] dark:border-[#31503a] bg-[#f1f6ef] dark:bg-[#1f2c22] px-5 py-5 text-[#304737] dark:text-[#cfe0d2]">
        <span className="grid size-11 shrink-0 place-items-center bg-[#e1ecdf] dark:bg-[#293b2c]">
          <CheckCircle2 size={22} />
        </span>
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-[#66806a] dark:text-[#9ecfa9]">ESPACE ADMINISTRATEUR</p>
          <p className="mt-1 font-heading text-2xl font-semibold">Bonjour {firstName}, et bienvenue dans ton espace administrateur.</p>
        </div>
      </div>
      {permissions.includes("requests.view") && newQuoteCount > 0 && !newQuoteBannerDismissed && (
        <button
          type="button"
          onClick={() => {
            dismissNewQuoteBanner();
            onNavigate("quotes", "Nouveau");
          }}
          className="mb-5 flex w-full items-center justify-between gap-3 border border-[#ead6c2] dark:border-[#5a4a38] bg-[#fbf3e8] dark:bg-[#292116] px-4 py-3 text-left text-sm text-[#765333] dark:text-[#e0bd86] transition hover:bg-[#f7ead8] dark:hover:bg-[#302619]"
        >
          <span className="flex items-center gap-2">
            <FileText size={18} className="shrink-0" />
            <span>{newQuoteCount} nouvelle{newQuoteCount > 1 ? "s" : ""} demande{newQuoteCount > 1 ? "s" : ""} de devis à traiter</span>
          </span>
          <ArrowUpRight size={17} className="shrink-0" />
        </button>
      )}
      <PageTitle
        eyebrow="VUE D'ENSEMBLE"
        title="Votre activité"
        note="Les indicateurs sont calculés à partir des devis et paiements enregistrés."
      />
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-700 dark:text-[#e08b7d]">
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.label}
            onClick={card.onClick}
            className="group min-h-36 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-5 text-left transition hover:border-[#c9b69f] hover:dark:border-[#5a4a38] hover:bg-[#fffefa] hover:dark:bg-[#1b221c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a97850] active:translate-y-px"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#72766e] dark:text-[#aab3a8]">
                {card.label}
              </span>
              <span
                className="grid size-9 place-items-center"
                style={adaptChip(card.tint, card.color, theme)}
              >
                <card.icon size={18} />
              </span>
            </div>
            <p className="mt-5 text-2xl font-semibold tracking-tight">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">{card.detail}</p>
            <ArrowUpRight size={15} className="mt-3 text-[#a97850] dark:text-[#dcb487] opacity-60 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
          </button>
        ))}
      </div>
      <section className="mt-5 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-5">
        <h3 className="text-sm font-semibold">Actions rapides</h3>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {permissions.includes("finances.view") && <button onClick={() => onNavigate("invoices")} className="flex min-h-12 items-center justify-center gap-2 bg-[#293b32] dark:bg-[#2f4438] px-4 py-3 text-sm font-semibold text-white hover:bg-[#354b3f] hover:dark:bg-[#3d5648]"><Plus size={16} />Créer une facture</button>}
          {permissions.includes("requests.view") && <button onClick={() => onNavigate("quotes")} className="flex min-h-12 items-center justify-center gap-2 border border-[#dedbd3] dark:border-[#333d34] px-4 py-3 text-sm font-medium hover:bg-[#faf9f6] hover:dark:bg-[#1b221c]"><FileText size={16} />Créer un devis</button>}
          {permissions.includes("media.manage") && <button onClick={() => onNavigate("media")} className="flex min-h-12 items-center justify-center gap-2 border border-[#dedbd3] dark:border-[#333d34] px-4 py-3 text-sm font-medium hover:bg-[#faf9f6] hover:dark:bg-[#1b221c]"><Images size={16} />Ajouter un contenu</button>}
          {permissions.includes("users.manage") && <button onClick={() => onNavigate("users")} className="flex min-h-12 items-center justify-center gap-2 border border-[#dedbd3] dark:border-[#333d34] px-4 py-3 text-sm font-medium hover:bg-[#faf9f6] hover:dark:bg-[#1b221c]"><UserRoundPlus size={16} />Gérer les utilisateurs</button>}
          {permissions.includes("settings.manage") && <button onClick={() => onNavigate("company")} className="flex min-h-12 items-center justify-center gap-2 border border-[#dedbd3] dark:border-[#333d34] px-4 py-3 text-sm font-medium hover:bg-[#faf9f6] hover:dark:bg-[#1b221c]"><Building2 size={16} />Configurer l’entreprise</button>}
          {permissions.includes("hero.manage") && <button onClick={() => onNavigate("media")} className="flex min-h-12 items-center justify-center gap-2 border border-[#dedbd3] dark:border-[#333d34] px-4 py-3 text-sm font-medium hover:bg-[#faf9f6] hover:dark:bg-[#1b221c]"><Plus size={16} />Ajouter une slide Hero</button>}
        </div>
      </section>
      <section className="mt-5 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c]">
        <div className="border-b border-[#e8e5de] dark:border-[#2b342c] px-5 py-4">
          <h3 className="text-sm font-semibold">Suivi des demandes</h3>
        </div>
        <div className="divide-y divide-[#efede7] dark:divide-[#262e27]">
          {(stats?.quotes || []).map((item) => (
            <div
              key={item.status}
              className="flex items-center justify-between px-5 py-3 text-sm"
            >
              <button onClick={() => onNavigate("quotes", item.status)} className="text-left text-[#626960] dark:text-[#a8b1a6] hover:text-[#293b32] hover:dark:text-[#cfe0d2] hover:underline">{item.status}</button>
              <span className="font-semibold tabular-nums">{item.count}</span>
            </div>
          ))}
          {!stats?.quotes.length && (
            <p className="px-5 py-8 text-center text-sm text-[#85877f] dark:text-[#96a094]">
              Aucune demande enregistrée pour le moment.
            </p>
          )}
        </div>
      </section>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c]">
          <div className="flex items-center justify-between border-b border-[#e8e5de] dark:border-[#2b342c] px-5 py-4"><h3 className="text-sm font-semibold">Dernières demandes</h3><button onClick={() => onNavigate("quotes")} className="text-xs font-medium text-[#8b684a] dark:text-[#d9b684] hover:underline">Tout voir</button></div>
          <div className="divide-y divide-[#efede7] dark:divide-[#262e27]">{recentQuotes.slice(0, 4).map((quote) => <button key={quote.id} onClick={() => onNavigate("quotes", "", quote.id)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition hover:bg-[#fbfaf7] hover:dark:bg-[#171d18]"><span className="min-w-0"><span className="block truncate text-sm font-medium">{quote.customer.name}</span><span className="mt-1 block truncate text-xs text-[#85877f] dark:text-[#96a094]">{quote.number} · {quote.project.ceilingType}</span></span><span className="shrink-0 text-right"><span className="block text-sm font-semibold">{formatCurrency(quote.totals.total)}</span><span className="mt-1 block text-xs text-[#85877f] dark:text-[#96a094]">{quote.status}</span></span></button>)}{!recentQuotes.length && <p className="px-5 py-8 text-center text-sm text-[#85877f] dark:text-[#96a094]">Aucune demande récente.</p>}</div>
        </section>
        <section className="border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c]">
          <div className="flex items-center justify-between border-b border-[#e8e5de] dark:border-[#2b342c] px-5 py-4"><h3 className="text-sm font-semibold">Dernières factures</h3><button onClick={() => onNavigate("invoices")} className="text-xs font-medium text-[#8b684a] dark:text-[#d9b684] hover:underline">Tout voir</button></div>
          <div className="divide-y divide-[#efede7] dark:divide-[#262e27]">{recentInvoices.slice(0, 4).map((invoice) => <button key={invoice.id} onClick={() => onNavigate("invoices")} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition hover:bg-[#fbfaf7] hover:dark:bg-[#171d18]"><span className="min-w-0"><span className="block truncate text-sm font-medium">{invoice.number}</span><span className="mt-1 block truncate text-xs text-[#85877f] dark:text-[#96a094]">{invoice.customer.name} · {invoice.status}</span></span><span className="shrink-0 text-sm font-semibold">{formatCurrency(invoice.totals.total)}</span></button>)}{!recentInvoices.length && <p className="px-5 py-8 text-center text-sm text-[#85877f] dark:text-[#96a094]">Aucune facture récente.</p>}</div>
        </section>
      </div>
    </>
  );
}

type PdfPreviewData = { url: string; fileName: string };

type DocumentShareRequest = {
  kind: "devis" | "facture";
  documentId: number;
  reference: string;
  customerName: string;
};

async function shareDocument(request: DocumentShareRequest): Promise<void> {
  const { kind, documentId, reference, customerName } = request;
  const caption = documentShareCaption(kind, reference, customerName);
  const file = await buildDocumentFile(`/admin/${kind === "devis" ? "quotes" : "invoices"}/${documentId}/pdf`, `${reference}.pdf`);
  const result = await shareFileWithSheet(file, caption);

  if (result.status === "shared") {
    toast.success(kind === "devis" ? "Devis partagé" : "Facture partagée", { description: "Le PDF et son message ont été remis au partage." });
    return;
  }
  // Partage refermé par l'utilisateur : rien a signaler, l'absence de notification est le comportement attendu.
  if (result.status === "cancelled") return;
  if (result.status === "unsupported") {
    openShareTray({ file, caption });
    toast.info("Feuille de partage indisponible", {
      description: "Ce navigateur ne peut pas ouvrir le partage natif : le PDF est prêt à être glissé dans WhatsApp.",
      duration: 11000,
    });
    return;
  }
  toast.error("Le partage a échoué", { description: result.message });
}

type OutsideInteraction = { detail?: { originalEvent?: Event }; preventDefault: () => void };

// The share tray is portalled beside the dialog, so touching it counts as "outside": without this guard the dossier would close under the user's hand.
function keepDialogAroundShareTray(event: OutsideInteraction) {
  const target = event.detail?.originalEvent?.target;
  if (target instanceof Element && target.closest("[data-share-tray]")) event.preventDefault();
}

function PdfPreviewModal({ preview, onClose }: { preview: PdfPreviewData | null; onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  return <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent scrollClassName="flex-1 gap-0 overflow-hidden" className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0 sm:h-[92dvh] sm:w-[calc(100vw-2rem)] sm:max-w-5xl">
      <DialogHeader className="flex-col items-stretch gap-3 border-b border-[#e8e5de] dark:border-[#2b342c] px-4 py-3 pr-14 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0"><p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">APERÇU PDF</p><DialogTitle className="break-words font-heading text-lg">{preview?.fileName}</DialogTitle></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => frame.current?.contentWindow?.print()} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs">Imprimer</button>{preview && <a href={preview.url} download={preview.fileName} className="inline-flex min-h-10 items-center border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs">Télécharger</a>}</div>
      </DialogHeader>
      {preview ? <>
        <iframe ref={frame} src={preview.url} title={preview.fileName} aria-hidden="true" tabIndex={-1} className="pointer-events-none absolute left-[-10000px] top-0 h-px w-px opacity-0" />
        <PdfDocumentViewer key={preview.url} url={preview.url} />
      </> : null}
    </DialogContent>
  </Dialog>;
}
function Quotes({
  run,
  onNavigate,
  initialStatus,
  initialQuoteId,
  clearInitialQuote,
  canCreate,
}: {
  run: (action: () => Promise<unknown>, success?: string) => Promise<void>;
  onNavigate: (tab: Tab, filter?: string, quoteId?: number | null, invoiceId?: number | null) => void;
  initialStatus: string;
  initialQuoteId: number | null;
  clearInitialQuote: () => void;
  canCreate: boolean;
}) {
  const confirm = useConfirm();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(25);
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [quotePdfPreview, setQuotePdfPreview] = useState<PdfPreviewData | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [negotiationQuote, setNegotiationQuote] = useState<Quote | null>(null);
  const [negotiationMode, setNegotiationMode] = useState<"final" | "fixed" | "percent">("final");
  const [negotiationValue, setNegotiationValue] = useState("");
  const [negotiationReason, setNegotiationReason] = useState("");
  const [negotiationPrices, setNegotiationPrices] = useState<Record<string, string>>({});
  const [revisionReason, setRevisionReason] = useState("");
  const [revisionOpen, setRevisionOpen] = useState(false);

  type QuoteEditDraft = {
    customer: Quote["customer"];
    description: string;
    location: string;
    ceilingType: string;
    ceilingModelId: number | null;
    building?: Quote["project"]["building"];
    rooms: Array<{ name: string; floorName: string; sectionName: string; ceilingTypeKey: string; mode: "dimensions" | "area"; length?: number | ""; width?: number | ""; area?: number | "" }>;
    options: Array<{ key: string; quantity?: number }>;
    transportZone: "dakar" | "hors_dakar";
    transportMode: "zone" | "custom";
    transportZoneId: number | null;
    transportCustomPrice: string;
    additionalServices: Array<{ id: number; quantity: number }>;
    lightingSelections: Array<{ layoutKey: string; productId: string }>;
    discount: number;
  };
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<QuoteEditDraft | null>(null);
  const [editPrices, setEditPrices] = useState<Array<{ key: string; name: string; calculation: string; rate: number }>>([]);
  const [editTransportZones, setEditTransportZones] = useState<Array<{ id: number; name: string; rate: number; active: number }>>([]);
  const [editServices, setEditServices] = useState<Array<{ id: number; name: string; unit: string; pricingType: string; price: number }>>([]);
  const [editModels, setEditModels] = useState<Array<{ id: number; title: string }>>([]);
  const updateEditBuilding = (update: (building: QuoteBuilding) => QuoteBuilding) =>
    setEditDraft((current) => current?.building
      ? { ...current, building: normalizeQuoteBuildingNames(update(current.building)) }
      : current);
  const updateEditFloor = (floorId: string, update: (floor: QuoteFloor) => QuoteFloor) =>
    updateEditBuilding((building) => ({
      ...building,
      floors: building.floors.map((floor) => floor.id === floorId ? update(floor) : floor),
    }));
  const updateEditApartment = (floorId: string, apartmentId: string, update: (apartment: QuoteApartment) => QuoteApartment) =>
    updateEditFloor(floorId, (floor) => ({
      ...floor,
      apartments: floor.apartments.map((apartment) => apartment.id === apartmentId ? update(apartment) : apartment),
    }));
  const updateEditRoom = (floorId: string, apartmentId: string, roomId: string, update: (room: QuoteRoom) => QuoteRoom) =>
    updateEditApartment(floorId, apartmentId, (apartment) => ({
      ...apartment,
      rooms: apartment.rooms.map((room) => room.id === roomId ? update(room) : room),
    }));
  const moveEditFloor = (floorIndex: number, direction: -1 | 1) =>
    updateEditBuilding((building) => {
      const floors = [...building.floors];
      const nextIndex = floorIndex + direction;
      if (nextIndex < 0 || nextIndex >= floors.length) return building;
      [floors[floorIndex], floors[nextIndex]] = [floors[nextIndex], floors[floorIndex]];
      return { floors };
    });
  const beginEditQuote = async (quote: Quote) => {
    const results = await Promise.all([
      api<Array<{ key: string; name: string; calculation: string; active: number; rate: number }>>("/admin/pricing").catch(() => []),
      api<Array<{ id: number; name: string; unit: string; pricingType: string; price: number }>>("/admin/supplemental-services").catch(() => []),
      api<Array<{ id: number; title: string }>>("/admin/ceiling-models").catch(() => []),
      api<Array<{ id: number; name: string; rate: number; active: number }>>("/admin/transport-zones").catch(() => []),
    ]);
    setEditPrices(results[0].filter((price) => Boolean(price.active)));
    setEditServices(results[1].filter((service) => Boolean((service as { active?: boolean }).active)));
    setEditModels(results[2]);
    const activeTransportZones = results[3].filter((zone) => Boolean(zone.active));
    setEditTransportZones(activeTransportZones);
    const transportItem = quote.items.find((item) => item.key === "transport");
    const legacyTransportZone = activeTransportZones.find((zone) => transportItem?.label.includes(`— ${zone.name}`));
    const transportZone = quote.project.transportZone || "dakar";
    const transportZoneId = quote.project.transportZoneId ?? legacyTransportZone?.id ?? null;
    const transportCustomPrice = quote.project.transportCustomPrice;
    const transportMode = transportCustomPrice != null
      || (transportZone === "hors_dakar" && !transportZoneId && (transportItem?.unitPrice || 0) > 0)
      ? "custom"
      : "zone";
    setEditDraft({
      customer: { ...quote.customer },
      description: quote.project.description || "",
      location: quote.project.location || "",
      ceilingType: results[0].find((price) => price.key === quote.project.ceilingType)?.key || results[0].find((price) => price.calculation === "area" && !["main_oeuvre", "materiaux"].includes(price.key))?.key || "",
      ceilingModelId: quote.project.ceilingModelId || quote.project.ceilingModel?.id || results[2].find((model) => model.title === quote.project.ceilingType)?.id || null,
      building: quote.project.building ? normalizeQuoteBuildingNames(quote.project.building) : undefined,
      rooms: quote.project.rooms.map(({ name, length, width, area, floorName, sectionName, ceilingTypeKey }) => ({
        name,
        floorName: floorName || "",
        sectionName: sectionName || "",
        ceilingTypeKey: ceilingTypeKey || results[0].find((price) => price.key === quote.project.ceilingType)?.key || results[0].find((price) => price.calculation === "area" && !["main_oeuvre", "materiaux"].includes(price.key))?.key || "",
        mode: length !== undefined && width !== undefined ? "dimensions" : "area",
        length,
        width,
        area,
      })),
      options: quote.project.options?.map((option) => ({ ...option })) || [],
      transportZone,
      transportMode,
      transportZoneId,
      transportCustomPrice: transportCustomPrice != null
        ? String(transportCustomPrice)
        : transportMode === "custom" && transportItem
          ? String(transportItem.unitPrice)
          : "",
      additionalServices: quote.project.additionalServices?.map((service) => ({ ...service })) || [],
      lightingSelections: quote.project.lightingSelections?.map((selection) => ({ ...selection })) || [],
      discount: quote.project.discount ?? quote.totals.discount,
    });
    setEditOpen(true);
  };
  const saveQuoteEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedQuote || !editDraft) return;
    if (editDraft.building) {
      if (!editDraft.building.floors.length || editDraft.building.floors.some((floor) => !floor.name.trim() || !floor.apartments.length)) {
        toast.error("Chaque bâtiment doit contenir au moins un étage nommé avec un appartement.");
        return;
      }
      if (editDraft.building.floors.some((floor) => floor.apartments.some((apartment) => !apartment.name.trim() || !apartment.rooms.length))) {
        toast.error("Chaque étage doit contenir des appartements nommés avec au moins une pièce.");
        return;
      }
      if (editDraft.building.floors.some((floor) => floor.apartments.some((apartment) => apartment.rooms.some((room) =>
        !room.name.trim() || !room.type.trim() || !(room.area > 0) || !room.ceilingTypeKey
        || (room.bathroom && (!room.bathroom.name.trim() || !(room.bathroom.area > 0) || !room.bathroom.ceilingTypeKey))
      )))) {
        toast.error("Chaque pièce et salle de bain doit avoir un nom, une surface positive et un type de plafond.");
        return;
      }
    }
    if (editDraft.options.some((option) => option.key === "transport") && editDraft.transportZone === "hors_dakar") {
      if (editDraft.transportMode === "zone" && !editTransportZones.some((zone) => zone.id === editDraft.transportZoneId)) {
        toast.error("Choisissez une zone de déplacement hors Dakar ou passez en prix personnalisé.");
        return;
      }
      if (editDraft.transportMode === "custom" && (editDraft.transportCustomPrice === "" || !(Number(editDraft.transportCustomPrice) >= 0))) {
        toast.error("Saisissez le prix personnalisé du déplacement hors Dakar.");
        return;
      }
    }
    await run(async () => {
      const project = {
        ...(editDraft.building
          ? { building: editDraft.building }
          : {
            rooms: editDraft.rooms.map((room) => room.mode === "area"
              ? { name: room.name, area: Number(room.area), floorName: room.floorName, sectionName: room.sectionName, ceilingTypeKey: room.ceilingTypeKey }
              : { name: room.name, length: Number(room.length), width: Number(room.width), floorName: room.floorName, sectionName: room.sectionName, ceilingTypeKey: room.ceilingTypeKey }),
            ceilingType: editDraft.ceilingType,
            ...(editDraft.ceilingModelId ? { ceilingModelId: editDraft.ceilingModelId } : {}),
          }),
        options: editDraft.options,
        transportZone: editDraft.transportZone,
        ...(editDraft.transportZone === "hors_dakar" && editDraft.transportMode === "zone" && editDraft.transportZoneId
          ? { transportZoneId: editDraft.transportZoneId }
          : {}),
        ...(editDraft.transportZone === "hors_dakar" && editDraft.transportMode === "custom" && editDraft.transportCustomPrice !== ""
          ? { transportCustomPrice: Number(editDraft.transportCustomPrice) }
          : {}),
        additionalServices: editDraft.additionalServices,
        lightingSelections: editDraft.lightingSelections,
        discount: Number(editDraft.discount),
      };
      const updated = await api<Quote>("/admin/quotes/" + selectedQuote.id, {
        method: "PUT",
        body: JSON.stringify({ customer: { ...editDraft.customer, phone: editDraft.customer.whatsapp || editDraft.customer.phone }, description: editDraft.description, location: editDraft.location, project }),
      });
      setSelectedQuote(updated);
      setEditOpen(false);
      await refresh();
    }, "Devis modifié et recalculé.");
  };
  const beginNegotiation = (quote: Quote) => {
    setNegotiationQuote(quote);
    setNegotiationMode("final");
    setNegotiationValue(String(quote.totals.total));
    setNegotiationReason("");
    setNegotiationPrices(Object.fromEntries(quote.items.filter((item) => item.key).map((item) => [item.key!, String(item.unitPrice)])));
  };
  const negotiationSubtotal = negotiationQuote?.items.reduce((sum, item) =>
    sum + Math.round(item.quantity * Number(negotiationPrices[item.key || ""] ?? item.unitPrice)), 0) || 0;
  const negotiationDiscount = negotiationMode === "percent"
    ? Math.round(negotiationSubtotal * (Number(negotiationValue) || 0) / 100)
    : negotiationMode === "fixed"
      ? Number(negotiationValue) || 0
      : negotiationSubtotal - (Number(negotiationValue) || 0);
  const negotiationFinal = Math.max(0, negotiationSubtotal - negotiationDiscount);
  const saveNegotiation = async (event: FormEvent) => {
    event.preventDefault();
    if (!negotiationQuote) return;
    await run(async () => {
      const updated = await api<Quote>(`/admin/quotes/${negotiationQuote.id}/negotiate`, {
        method: "POST",
        body: JSON.stringify({
          mode: negotiationMode,
          value: Number(negotiationValue),
          reason: negotiationReason,
          itemPrices: Object.entries(negotiationPrices).map(([key, unitPrice]) => ({ key, unitPrice: Number(unitPrice) })),
        }),
      });
      setSelectedQuote(updated);
      setNegotiationQuote(null);
      await refresh();
    }, "Nouvelle version négociée enregistrée.");
  };
  const reviseAcceptedQuote = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedQuote) return;
    await run(async () => {
      const updated = await api<Quote>(`/admin/quotes/${selectedQuote.id}/revise`, {
        method: "POST",
        body: JSON.stringify({ reason: revisionReason }),
      });
      setSelectedQuote(updated);
      setRevisionOpen(false);
      setRevisionReason("");
      await refresh();
    }, "Révision tracée créée. L’ancienne version acceptée reste dans l’historique.");
  };

  const refresh = useCallback(() => {
    setLoading(true);
    api<Quote[]>(
      `/admin/quotes${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    )
      .then(setQuotes)
      .catch(() => setQuotes([]))
      .finally(() => setLoading(false));
  }, [status]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => setStatus(initialStatus), [initialStatus]);
  const deleteQuote = async (quote: Quote) => {
    if (!(await confirm({ title: `Supprimer le devis ${quote.number} ?`, message: "Le devis et son historique seront définitivement effacés. Un devis déjà facturé ne peut être supprimé qu’après sa facture.", confirmLabel: "Supprimer", destructive: true }))) return;
    await run(async () => {
      await api(`/admin/quotes/${quote.id}`, { method: "DELETE" });
      setSelectedQuote(null);
      clearInitialQuote();
      refresh();
    }, "Devis supprimé.");
  };
  const openQuote = useCallback(async (quoteId: number) => {
    setDetailError("");
    setSelectedQuote(quotes.find((quote) => quote.id === quoteId) || null);
    setDetailLoading(true);
    try {
      setSelectedQuote(await api<Quote>(`/admin/quotes/${quoteId}`));
    } catch (reason) {
      setDetailError(reason instanceof Error ? reason.message : "Détails indisponibles.");
    } finally {
      setDetailLoading(false);
    }
  }, [quotes]);
  useEffect(() => {
    if (initialQuoteId) void openQuote(initialQuoteId);
  }, [initialQuoteId, openQuote]);
  const updateQuoteStatus = (quote: Quote, nextStatus: string) => run(async () => {
    await api(`/admin/quotes/${quote.id}/status`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
    setSelectedQuote(await api<Quote>(`/admin/quotes/${quote.id}`));
    await refresh();
  }, `Devis ${nextStatus.toLowerCase()}.`);
  const downloadQuote = (quote: Quote) => run(async () => {
    const pdf = await api<Blob>(`/admin/quotes/${quote.id}/pdf`);
    const url = URL.createObjectURL(pdf);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${quote.number}.pdf`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  // L'aperçu et l'impression s'affichent d'eux-mêmes : seule la génération qui échoue doit parler.
  const previewQuotePdf = (quote: Quote) => run(async () => { const pdf = await api<Blob>(`/admin/quotes/${quote.id}/pdf`); const url = URL.createObjectURL(pdf); setQuotePdfPreview({ url, fileName: `${quote.number}.pdf` }); });
  const printQuote = (quote: Quote) => run(async () => {
    const pdf = await api<Blob>(`/admin/quotes/${quote.id}/pdf`);
    const url = URL.createObjectURL(pdf);
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;inset:0;width:0;height:0;border:0";
    frame.src = url;
    frame.onload = () => { frame.contentWindow?.print(); window.setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 2000); };
    document.body.appendChild(frame);
  });
  const shareQuote = async (quote: Quote) => {
    if (sharing) return;
    setSharing(quote.number);
    await run(() => shareDocument({ kind: "devis", documentId: quote.id, reference: quote.number, customerName: quote.customer.name }));
    setSharing(null);
  };
  const closeQuotePdf = () => { if (quotePdfPreview) URL.revokeObjectURL(quotePdfPreview.url); setQuotePdfPreview(null); };
  const quoteEditInputClass = "mt-1.5 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 py-2.5 text-sm outline-none focus:border-[#a97850]";
  const visible = quotes.filter((quote) =>
    `${quote.number} ${quote.customer.name} ${quote.customer.phone}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const shownQuotes = visible.slice(0, limit);
  const statuses = [
    "Nouveau",
    "En analyse",
    "Contacté",
    "Devis préparé",
    "Devis envoyé",
    "Devis accepté",
    "Devis refusé",
    "Converti en facture",
    "Terminé",
  ];
  return (
    <>
      <PageTitle
        eyebrow="RELATION CLIENT"
        title="Demandes de devis"
        note="Analysez les demandes, validez le devis puis convertissez-le en facture."
        action={canCreate ? (
          <button
            type="button"
            onClick={() => setBuilderOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white transition hover:bg-[#354b3f] hover:dark:bg-[#3d5648] active:translate-y-px"
          >
            <Plus size={16} />
            Créer un devis
          </button>
        ) : undefined}
      />
      <div className="mb-3 flex flex-wrap gap-3">
        <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search size={16} className="absolute left-3 top-3 text-[#8b8e86] dark:text-[#96a094]" />
          <input
            aria-label="Rechercher une demande"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setLimit(25); }}
            placeholder="Numéro, client, téléphone"
            className="w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#a97850]"
          />
        </label>
      </div>
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1" aria-label="Filtrer par statut">
        {["", ...statuses].map((value) => (
          <button
            key={value || "tous"}
            type="button"
            onClick={() => setStatus(value)}
            className={`shrink-0 whitespace-nowrap border px-3 py-1.5 text-xs font-medium transition ${status === value ? "border-[#293b32] dark:border-[#3d5648] bg-[#293b32] dark:bg-[#2f4438] text-white" : "border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] text-[#5d645e] dark:text-[#b3bcb2] hover:border-[#c9b69f] hover:dark:border-[#5a4a38] hover:bg-[#faf9f6] hover:dark:bg-[#1b221c]"}`}
          >
            {value || "Tous"}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="border border-dashed border-[#d8d5cc] dark:border-[#3a443b] bg-white dark:bg-[#1b221c] px-5 py-14 text-center text-sm text-[#85877f] dark:text-[#96a094]">Aucune demande trouvée.</div>
      ) : (
        <div className="space-y-3 md:hidden">
          {shownQuotes.map((quote) => (
            <button key={quote.id} type="button" onClick={() => openQuote(quote.id)} className="block w-full border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-4 text-left hover:bg-[#fbfaf7] hover:dark:bg-[#171d18]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{quote.number}</p>
                  <p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">{quote.customer.name}</p>
                </div>
                <Status status={quote.status} />
              </div>
              <div className="mt-3 flex items-end justify-between gap-3 text-sm">
                <span className="truncate text-xs text-[#676d65] dark:text-[#a8b1a6]">{quote.project?.rooms?.length || 1} pièce(s) · {quote.project?.totalArea || 0} m²</span>
                <span className="font-semibold tabular-nums">{formatCurrency(quote.totals.total)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="hidden overflow-hidden border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-[#f8f7f3] dark:bg-[#1e261f] text-[11px] uppercase tracking-wider text-[#747971] dark:text-[#aab3a8]">
              <tr>
                <th className="px-4 py-3">Demande</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Projet</th>
                <th className="px-4 py-3">Total estimé</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efede7] dark:divide-[#262e27]">
              {shownQuotes.map((quote) => (
                <tr
                  key={quote.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ouvrir le dossier ${quote.number}`}
                  onClick={() => openQuote(quote.id)}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openQuote(quote.id); } }}
                  className="cursor-pointer bg-white dark:bg-[#1b221c] hover:bg-[#fbfaf7] hover:dark:bg-[#171d18] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#a97850]"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold">{quote.number}</p>
                    <p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">
                      {new Date(quote.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{quote.customer.name}</p>
                    <p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">
                      {quote.customer.whatsapp || quote.customer.phone}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{quote.project.totalArea} m²</p>
                    <p className="mt-1 max-w-[170px] truncate text-xs text-[#85877f] dark:text-[#96a094]">
                      {quote.project.location || quote.project.description}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums">
                    {formatCurrency(quote.totals.total)}
                  </td>
                  <td className="px-4 py-3">
                    <Status status={quote.status} />
                  </td>
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => openQuote(quote.id)} className="inline-flex min-h-9 items-center gap-1.5 border border-[#dedbd3] dark:border-[#333d34] px-2.5 text-xs hover:bg-[#f7f6f2] hover:dark:bg-[#1e261f]">
                        <Eye size={14} />Détails
                      </button>
                      <select
                        aria-label={`Statut ${quote.number}`}
                        value={quote.status}
                        disabled={["Converti en facture", "Terminé"].includes(
                          quote.status,
                        )}
                        onChange={(event) =>
                          run(async () => {
                            await api(`/admin/quotes/${quote.id}/status`, {
                              method: "PATCH",
                              body: JSON.stringify({
                                status: event.target.value,
                              }),
                            });
                            refresh();
                          }, "Statut du devis mis à jour.")
                        }
                        className="max-w-[160px] border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] p-2 text-xs"
                      >
                        {statuses.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                      {quote.status === "Devis accepté" && (
                        <button
                          title="Créer la facture"
                          onClick={() =>
                            run(async () => {
                              const invoice = await api<{ id: number }>("/admin/quotes/" + quote.id + "/convert", { method: "POST" });
                              await refresh();
                              onNavigate("invoices", "", null, invoice.id);
                            }, "Facture créée depuis le devis accepté.")
                          }
                          className="whitespace-nowrap bg-[#293b32] dark:bg-[#2f4438] px-2.5 py-2 text-xs text-white"
                        >
                          Créer la facture
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && visible.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-14 text-center text-sm text-[#85877f] dark:text-[#96a094]"
                  >
                    Aucune demande ne correspond à ces filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {visible.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#85877f] dark:text-[#96a094]">
          <p>{shownQuotes.length} demande{shownQuotes.length > 1 ? "s" : ""} affichée{shownQuotes.length > 1 ? "s" : ""} sur {visible.length}.</p>
          {visible.length > shownQuotes.length && (
            <button
              type="button"
              onClick={() => setLimit((current) => current + 25)}
              className="min-h-11 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-4 font-medium transition-colors hover:bg-[#f7f6f2] hover:dark:bg-[#1e261f]"
            >
              Afficher {Math.min(25, visible.length - shownQuotes.length)} demandes de plus
            </button>
          )}
        </div>
      )}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[100dvh] w-screen max-w-3xl overflow-y-auto rounded-none border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0 sm:max-h-[92dvh] sm:w-[calc(100vw-2rem)]">
          <DialogHeader className="border-b border-[#e8e5de] dark:border-[#2b342c] px-5 py-5 pr-14 sm:px-7">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">MODIFICATION</p>
            <DialogTitle className="font-heading text-2xl">Modifier le devis {selectedQuote?.number}</DialogTitle>
            <DialogDescription>Les montants sont recalculés et validés par le serveur. Un devis déjà facturé est verrouillé.</DialogDescription>
          </DialogHeader>
          {editDraft && <form onSubmit={saveQuoteEdit} className="space-y-5 px-5 py-5 sm:px-7">
            <section className="grid gap-3 sm:grid-cols-2">
              <h3 className="text-xs font-semibold tracking-wide text-[#a97850] dark:text-[#dcb487] sm:col-span-2">CLIENT</h3>
              <label className="text-sm">Nom<input required minLength={2} className={quoteEditInputClass} value={editDraft.customer.name} onChange={(event) => setEditDraft({ ...editDraft, customer: { ...editDraft.customer, name: event.target.value } })} /></label>
              <label className="text-sm">WhatsApp<input required className={quoteEditInputClass} value={editDraft.customer.whatsapp || editDraft.customer.phone} onChange={(event) => setEditDraft({ ...editDraft, customer: { ...editDraft.customer, whatsapp: event.target.value } })} /></label>
              <label className="text-sm">E-mail<input type="email" className={quoteEditInputClass} value={editDraft.customer.email} onChange={(event) => setEditDraft({ ...editDraft, customer: { ...editDraft.customer, email: event.target.value } })} /></label>
            </section>
            <section className="space-y-3 border-t border-[#e8e5de] dark:border-[#2b342c] pt-4">
              <h3 className="text-xs font-semibold tracking-wide text-[#a97850] dark:text-[#dcb487]">PROJET ET PIÈCES</h3>
              {editDraft.building && (
                <div className="space-y-4">
                  {editDraft.building.floors.map((floor, floorIndex) => (
                    <section key={floor.id} className="space-y-3 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-3">
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
                        <div className="text-xs">Étage<p className="mt-1 flex min-h-10 items-center border border-[#dedbd3] dark:border-[#333d34] px-3">{floor.name}</p></div>
                        <button type="button" aria-label="Monter l’étage" disabled={floorIndex === 0} onClick={() => moveEditFloor(floorIndex, -1)} className="grid size-10 place-items-center border border-[#dedbd3] dark:border-[#333d34] disabled:opacity-40"><ArrowUp size={15} /></button>
                        <button type="button" aria-label="Descendre l’étage" disabled={floorIndex === (editDraft.building?.floors.length ?? 0) - 1} onClick={() => moveEditFloor(floorIndex, 1)} className="grid size-10 place-items-center border border-[#dedbd3] dark:border-[#333d34] disabled:opacity-40"><ArrowDown size={15} /></button>
                        <button type="button" onClick={() => updateEditBuilding((building) => ({ ...building, floors: building.floors.filter((entry) => entry.id !== floor.id) }))} className="grid size-10 place-items-center border border-[#ead6d1] dark:border-[#4a332f] text-[#8a4d43] dark:text-[#e08b7d]" aria-label="Supprimer l’étage"><Trash2 size={15} /></button>
                      </div>
                      {floor.apartments.map((apartment) => (
                        <section key={apartment.id} className="space-y-3 border-t border-[#efede7] dark:border-[#262e27] pt-3">
                          <div className="flex items-end gap-2">
                            <div className="flex-1 text-xs">Appartement<p className="mt-1 flex min-h-10 items-center border border-[#dedbd3] dark:border-[#333d34] px-3">{apartment.name}</p></div>
                            <button type="button" onClick={() => updateEditFloor(floor.id, (current) => ({ ...current, apartments: current.apartments.filter((entry) => entry.id !== apartment.id) }))} className="grid size-10 shrink-0 place-items-center border border-[#ead6d1] dark:border-[#4a332f] text-[#8a4d43] dark:text-[#e08b7d]" aria-label="Supprimer l’appartement"><Trash2 size={15} /></button>
                          </div>
                          {apartment.rooms.map((room) => (
                            <div key={room.id} className="space-y-3 border border-[#efede7] dark:border-[#262e27] p-3">
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                <label className="text-xs">Type de pièce
                                  <select className={quoteEditInputClass} value={room.type} onChange={(event) => updateEditRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, type: event.target.value, name: event.target.value === "Autre" ? "" : current.name, bathroom: event.target.value === "Chambre" ? current.bathroom : undefined }))}>
                                    {!quoteRoomTypes.includes(room.type) && <option value={room.type}>{room.type}</option>}
                                    {quoteRoomTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                                  </select>
                                </label>
                                <label className="text-xs">Nom de la pièce
                                  {room.type === "Autre"
                                    ? <input required className={quoteEditInputClass} value={room.name} onChange={(event) => updateEditRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, name: event.target.value }))} />
                                    : <p className="mt-1 flex min-h-10 items-center border border-[#dedbd3] dark:border-[#333d34] px-3">{room.name}</p>}
                                </label>
                                <label className="text-xs">Surface (m²)
                                  <NumericInput min="0.1" step="0.1" required className={quoteEditInputClass} value={room.area} onChange={(event) => updateEditRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, area: Number(event.target.value) || 0 }))} />
                                </label>
                                <label className="text-xs">Type de plafond
                                  <select required className={quoteEditInputClass} value={room.ceilingTypeKey} onChange={(event) => updateEditRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, ceilingTypeKey: event.target.value }))}>
                                    <option value="">Choisir un tarif</option>
                                    {editPrices.filter((price) => price.calculation === "area" && !["main_oeuvre", "materiaux"].includes(price.key)).map((price) => <option key={price.key} value={price.key}>{price.name} · {formatCurrency(price.rate)}/m²</option>)}
                                  </select>
                                </label>
                              </div>
                              {room.type === "Chambre" && (
                                <label className="flex min-h-9 items-center gap-2 text-xs">
                                  <input type="checkbox" checked={Boolean(room.bathroom)} onChange={(event) => updateEditRoom(floor.id, apartment.id, room.id, (current) => ({
                                    ...current,
                                    bathroom: event.target.checked
                                      ? { id: crypto.randomUUID(), name: "Salle de bain", type: "Salle de bain", area: 0, ceilingTypeKey: current.ceilingTypeKey }
                                      : undefined,
                                  }))} />
                                  Cette chambre possède une salle de bain
                                </label>
                              )}
                              {room.bathroom && (
                                <div className="grid gap-2 border-t border-[#efede7] dark:border-[#262e27] pt-3 sm:grid-cols-3">
                                  <label className="text-xs">Nom de la salle de bain
                                    <input required className={quoteEditInputClass} value={room.bathroom.name} onChange={(event) => updateEditRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, bathroom: current.bathroom ? { ...current.bathroom, name: event.target.value } : undefined }))} />
                                  </label>
                                  <label className="text-xs">Surface (m²)
                                    <NumericInput min="0.1" step="0.1" required className={quoteEditInputClass} value={room.bathroom.area} onChange={(event) => updateEditRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, bathroom: current.bathroom ? { ...current.bathroom, area: Number(event.target.value) || 0 } : undefined }))} />
                                  </label>
                                  <label className="text-xs">Type de plafond
                                    <select required className={quoteEditInputClass} value={room.bathroom.ceilingTypeKey} onChange={(event) => updateEditRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, bathroom: current.bathroom ? { ...current.bathroom, ceilingTypeKey: event.target.value } : undefined }))}>
                                      <option value="">Choisir un tarif</option>
                                      {editPrices.filter((price) => price.calculation === "area" && !["main_oeuvre", "materiaux"].includes(price.key)).map((price) => <option key={price.key} value={price.key}>{price.name} · {formatCurrency(price.rate)}/m²</option>)}
                                    </select>
                                  </label>
                                </div>
                              )}
                              <button type="button" onClick={() => updateEditApartment(floor.id, apartment.id, (current) => ({ ...current, rooms: current.rooms.filter((entry) => entry.id !== room.id) }))} className="inline-flex min-h-9 items-center gap-2 border border-[#ead6d1] dark:border-[#4a332f] px-3 text-xs text-[#8a4d43] dark:text-[#e08b7d]"><Trash2 size={14} /> Supprimer la pièce</button>
                            </div>
                          ))}
                          <button type="button" onClick={() => updateEditApartment(floor.id, apartment.id, (current) => ({ ...current, rooms: [...current.rooms, { id: crypto.randomUUID(), name: `Chambre ${current.rooms.filter((room) => room.type === "Chambre").length + 1}`, type: "Chambre", area: 0, ceilingTypeKey: editPrices.find((price) => price.calculation === "area" && !["main_oeuvre", "materiaux"].includes(price.key))?.key || "" }] }))} className="inline-flex min-h-9 items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs"><Plus size={14} />Ajouter une pièce</button>
                        </section>
                      ))}
                      <button type="button" onClick={() => updateEditFloor(floor.id, (current) => ({ ...current, apartments: [...current.apartments, { id: crypto.randomUUID(), name: `Appartement ${current.apartments.length + 1}`, rooms: [] }] }))} className="inline-flex min-h-9 items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs"><Plus size={14} />Ajouter un appartement</button>
                    </section>
                  ))}
                  <button type="button" onClick={() => updateEditBuilding((building) => ({ ...building, floors: [...building.floors, { id: crypto.randomUUID(), name: `${building.floors.length === 0 ? "1er" : `${building.floors.length + 1}e`} étage`, apartments: [] }] }))} className="inline-flex min-h-9 items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs"><Plus size={14} />Ajouter un étage</button>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {!editDraft.building && <label className="text-sm sm:col-span-2">Type de plafond
                  <select required className={quoteEditInputClass} value={editDraft.ceilingModelId ? "model:" + editDraft.ceilingModelId : "price:" + editDraft.ceilingType} onChange={(event) => {
                    const value = event.target.value;
                    if (value.startsWith("model:")) setEditDraft({ ...editDraft, ceilingModelId: Number(value.slice(6)) });
                    else setEditDraft({ ...editDraft, ceilingModelId: null, ceilingType: value.slice(6) });
                  }}>
                    {editPrices.filter((price) => price.calculation === "area" && !["main_oeuvre", "materiaux"].includes(price.key)).map((price) => <option key={price.key} value={"price:" + price.key}>{price.name}</option>)}
                    {editModels.map((model) => <option key={model.id} value={"model:" + model.id}>{model.title}</option>)}
                  </select>
                </label>}
                <label className="text-sm">Localisation du chantier<input required className={quoteEditInputClass} value={editDraft.location} onChange={(event) => setEditDraft({ ...editDraft, location: event.target.value })} /></label>
                <label className="text-sm">Remise (FCFA)<NumericInput min="0" className={quoteEditInputClass} value={editDraft.discount} onChange={(event) => setEditDraft({ ...editDraft, discount: Number(event.target.value) })} /></label>
              </div>
              <label className="block text-sm">Description et notes<textarea maxLength={3000} rows={3} className={quoteEditInputClass} value={editDraft.description} onChange={(event) => setEditDraft({ ...editDraft, description: event.target.value })} /></label>
              {!editDraft.building && <div className="space-y-2">
                {editDraft.rooms.map((room, index) => <div key={index} className="grid gap-2 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-xs">Pièce<input required className={quoteEditInputClass} value={room.name} onChange={(event) => setEditDraft({ ...editDraft, rooms: editDraft.rooms.map((item, i) => i === index ? { ...item, name: event.target.value } : item) })} /></label>
                  <label className="text-xs">Étage<input required className={quoteEditInputClass} placeholder="Ex. 1er étage" value={room.floorName} onChange={(event) => setEditDraft({ ...editDraft, rooms: editDraft.rooms.map((item, i) => i === index ? { ...item, floorName: event.target.value } : item) })} /></label>
                  <label className="text-xs">Section<input required className={quoteEditInputClass} placeholder="Ex. Appartement" value={room.sectionName} onChange={(event) => setEditDraft({ ...editDraft, rooms: editDraft.rooms.map((item, i) => i === index ? { ...item, sectionName: event.target.value } : item) })} /></label>
                  <label className="text-xs">Type de plafond
                    <select required className={quoteEditInputClass} value={room.ceilingTypeKey} onChange={(event) => setEditDraft({ ...editDraft, rooms: editDraft.rooms.map((item, i) => i === index ? { ...item, ceilingTypeKey: event.target.value } : item) })}>
                      {editPrices.filter((price) => price.calculation === "area" && !["main_oeuvre", "materiaux"].includes(price.key)).map((price) => <option key={price.key} value={price.key}>{price.name} · {formatCurrency(price.rate)}/m²</option>)}
                    </select>
                  </label>
                  <label className="text-xs">Mode de saisie<select className={quoteEditInputClass} value={room.mode} onChange={(event) => setEditDraft({ ...editDraft, rooms: editDraft.rooms.map((item, i) => i === index ? { ...item, mode: event.target.value as "dimensions" | "area" } : item) })}><option value="dimensions">Dimensions</option><option value="area">Surface directe</option></select></label>
                  {room.mode === "area" ? (
                    <label className="text-xs">Surface (m²)<NumericInput min="0.1" step="0.1" required className={quoteEditInputClass} value={room.area ?? ""} onChange={(event) => setEditDraft({ ...editDraft, rooms: editDraft.rooms.map((item, i) => i === index ? { ...item, area: event.target.value === "" ? "" : Number(event.target.value) } : item) })} /></label>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs">Longueur (m)<NumericInput min="0.1" step="0.1" required className={quoteEditInputClass} value={room.length ?? ""} onChange={(event) => setEditDraft({ ...editDraft, rooms: editDraft.rooms.map((item, i) => i === index ? { ...item, length: event.target.value === "" ? "" : Number(event.target.value) } : item) })} /></label>
                      <label className="text-xs">Largeur (m)<NumericInput min="0.1" step="0.1" required className={quoteEditInputClass} value={room.width ?? ""} onChange={(event) => setEditDraft({ ...editDraft, rooms: editDraft.rooms.map((item, i) => i === index ? { ...item, width: event.target.value === "" ? "" : Number(event.target.value) } : item) })} /></label>
                    </div>
                  )}
                  <p className="self-end pb-2 text-xs text-[#687068]">{formatCurrency((room.mode === "area" ? Number(room.area || 0) : Number(room.length || 0) * Number(room.width || 0)) * (editPrices.find((price) => price.key === room.ceilingTypeKey)?.rate || 0))}</p>
                  <button type="button" aria-label="Supprimer cette pièce" onClick={() => setEditDraft({ ...editDraft, rooms: editDraft.rooms.filter((_, i) => i !== index) })} className="mb-1 grid size-9 place-items-center border border-[#ead6d1] dark:border-[#4a332f] text-[#8a4d43] dark:text-[#e08b7d]">×</button>
                </div>)}
                <button type="button" onClick={() => setEditDraft({ ...editDraft, rooms: [...editDraft.rooms, { name: "", floorName: editDraft.rooms.at(-1)?.floorName || "", sectionName: editDraft.rooms.at(-1)?.sectionName || "", ceilingTypeKey: editPrices.find((price) => price.calculation === "area")?.key || "", mode: "dimensions", length: "", width: "" }] })} className="inline-flex min-h-9 items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs"><Plus size={14} />Ajouter une pièce</button>
              </div>}
            </section>
            {editPrices.filter((price) => !["main_oeuvre", "materiaux"].includes(price.key) && price.calculation !== "area").length > 0 && <fieldset className="space-y-2 border-t border-[#e8e5de] dark:border-[#2b342c] pt-4">
              <legend className="text-xs font-semibold tracking-wide text-[#a97850] dark:text-[#dcb487]">OPTIONS ET PRESTATIONS DU TARIF</legend>
              {editPrices.filter((price) => !["main_oeuvre", "materiaux"].includes(price.key) && price.calculation !== "area").map((price) => {
                const option = editDraft.options.find((entry) => entry.key === price.key);
                const selectedTransportZone = editTransportZones.find((zone) => zone.id === editDraft.transportZoneId);
                return <div key={price.key} className="space-y-2 border-b border-[#efede7] dark:border-[#262e27] pb-2">
                  <div className="grid grid-cols-[auto_1fr_120px] items-center gap-2 text-sm">
                    <input type="checkbox" checked={Boolean(option)} onChange={(event) => setEditDraft({ ...editDraft, options: event.target.checked ? [...editDraft.options, { key: price.key, quantity: 1 }] : editDraft.options.filter((entry) => entry.key !== price.key) })} />
                    <span>{price.name}{price.key === "transport" && <span className="ml-2 text-xs text-[#815d3e] dark:text-[#dcb487]">{editDraft.transportZone === "dakar" ? `${formatCurrency(price.rate)} · Dakar` : editDraft.transportMode === "zone" && selectedTransportZone ? `${formatCurrency(selectedTransportZone.rate)} · ${selectedTransportZone.name}` : editDraft.transportMode === "custom" && editDraft.transportCustomPrice !== "" ? `${formatCurrency(Number(editDraft.transportCustomPrice))} · prix personnalisé` : "Hors Dakar · prix à renseigner"}</span>}</span>
                    {option && price.key !== "transport" && <NumericInput aria-label={"Quantité " + price.name} min="0.1" step="0.1" value={option.quantity || 1} onChange={(event) => setEditDraft({ ...editDraft, options: editDraft.options.map((entry) => entry.key === price.key ? { ...entry, quantity: Number(event.target.value) } : entry) })} className="border border-[#dedbd3] dark:border-[#333d34] px-2 py-1.5 text-sm" />}
                  </div>
                  {price.key === "transport" && option && <div className="space-y-3 border border-[#efede7] dark:border-[#262e27] p-3">
                    <label className="block text-xs font-medium text-[#6c7169] dark:text-[#a8b1a6]">Zone de déplacement
                      <select className={quoteEditInputClass} value={editDraft.transportZone} onChange={(event) => setEditDraft({ ...editDraft, transportZone: event.target.value as "dakar" | "hors_dakar" })}>
                        <option value="dakar">Dakar · {formatCurrency(price.rate)}</option>
                        <option value="hors_dakar">Hors Dakar</option>
                      </select>
                    </label>
                    {editDraft.transportZone === "hors_dakar" && <>
                      <div className="flex flex-wrap gap-4 text-xs font-medium">
                        <label className="flex items-center gap-2"><input type="radio" name="edit-transport-mode" checked={editDraft.transportMode === "zone"} onChange={() => setEditDraft({ ...editDraft, transportMode: "zone" })} /> Choisir parmi les prix de déplacement</label>
                        <label className="flex items-center gap-2"><input type="radio" name="edit-transport-mode" checked={editDraft.transportMode === "custom"} onChange={() => setEditDraft({ ...editDraft, transportMode: "custom" })} /> Prix personnalisé</label>
                      </div>
                      {editDraft.transportMode === "zone" ? (
                        editTransportZones.length > 0 ? (
                          <label className="block text-xs font-medium text-[#6c7169] dark:text-[#a8b1a6]">Zone hors Dakar
                            <select className={quoteEditInputClass} value={editDraft.transportZoneId ?? ""} onChange={(event) => setEditDraft({ ...editDraft, transportZoneId: event.target.value ? Number(event.target.value) : null })}>
                              <option value="">Choisir une zone</option>
                              {editTransportZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} · {formatCurrency(zone.rate)}</option>)}
                            </select>
                          </label>
                        ) : (
                          <p className="text-xs text-[#85877f] dark:text-[#96a094]">Aucune zone configurée : ajoutez une zone dans « Tarifs du calculateur » ou choisissez un prix personnalisé.</p>
                        )
                      ) : (
                        <label className="block text-xs font-medium text-[#6c7169] dark:text-[#a8b1a6]">Prix personnalisé du déplacement (FCFA)
                          <NumericInput className={quoteEditInputClass} min="0" step="100" value={editDraft.transportCustomPrice} onChange={(event) => setEditDraft({ ...editDraft, transportCustomPrice: event.target.value })} />
                        </label>
                      )}
                    </>}
                  </div>}
                </div>;
              })}
            </fieldset>}
            {editServices.length > 0 && <fieldset className="space-y-2 border-t border-[#e8e5de] dark:border-[#2b342c] pt-4">
              <legend className="text-xs font-semibold tracking-wide text-[#a97850] dark:text-[#dcb487]">PRESTATIONS SUPPLÉMENTAIRES</legend>
              {editServices.map((service) => {
                const selection = editDraft.additionalServices.find((entry) => entry.id === service.id);
                return <div key={service.id} className="grid grid-cols-[auto_1fr_120px] items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(selection)} onChange={(event) => setEditDraft({ ...editDraft, additionalServices: event.target.checked ? [...editDraft.additionalServices, { id: service.id, quantity: 1 }] : editDraft.additionalServices.filter((entry) => entry.id !== service.id) })} />
                  <span>{service.name} · {formatCurrency(service.price)}/{service.unit}</span>
                  {selection && service.pricingType !== "fixed" && service.pricingType !== "area" && <NumericInput aria-label={"Quantité " + service.name} min="0.1" step="0.1" value={selection.quantity} onChange={(event) => setEditDraft({ ...editDraft, additionalServices: editDraft.additionalServices.map((entry) => entry.id === service.id ? { ...entry, quantity: Number(event.target.value) } : entry) })} className="border border-[#dedbd3] dark:border-[#333d34] px-2 py-1.5 text-sm" />}
                </div>;
              })}
            </fieldset>}
            <div className="flex flex-wrap justify-end gap-2 border-t border-[#e8e5de] dark:border-[#2b342c] pt-4"><button type="button" onClick={() => setEditOpen(false)} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-4 text-sm">Annuler</button><button className="min-h-10 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white">Enregistrer et recalculer</button></div>
          </form>}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedQuote)} onOpenChange={(open) => { if (!open) { setSelectedQuote(null); clearInitialQuote(); setDetailError(""); } }}>
        <DialogContent onInteractOutside={keepDialogAroundShareTray} className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0 sm:max-h-[88dvh]">
          {selectedQuote && <>
            <DialogHeader className="sticky top-0 z-10 border-b border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] px-5 py-5 pr-14 sm:px-7">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">DOSSIER CLIENT</p>
              <DialogTitle className="font-heading text-2xl text-[#29352f] dark:text-[#e9ece6]">{selectedQuote.number} · {selectedQuote.customer.name}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 text-xs"><Status status={selectedQuote.status} /><span>Créé le {new Date(selectedQuote.created_at).toLocaleDateString("fr-FR")}</span></DialogDescription>
            </DialogHeader>
            {detailLoading && <p className="px-5 py-2 text-xs text-[#85877f] dark:text-[#96a094]">Actualisation des détails…</p>}
            {detailError && <p role="alert" className="mx-5 mt-3 border border-red-200 dark:border-[#4a332f] bg-red-50 dark:bg-[#2b1f1d] p-3 text-sm text-red-800 dark:text-[#eaa79b]">{detailError}</p>}
            <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-7">
              <section className="border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-4">
                <h3 className="text-xs font-semibold tracking-wide text-[#a97850] dark:text-[#dcb487]">CLIENT</h3>
                <p className="mt-2 text-sm font-semibold">{selectedQuote.customer.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedQuote.customer.phone && <a className="inline-flex min-h-9 items-center gap-1.5 border border-[#dedbd3] dark:border-[#333d34] px-2.5 text-xs" href={`tel:${selectedQuote.customer.phone}`}><Phone size={13} />Appeler</a>}
                  {selectedQuote.customer.whatsapp && (() => {
                    const recipient = whatsappRecipient(selectedQuote.customer.whatsapp, selectedQuote.company?.whatsapp || "");
                    const conversation = whatsappConversationUrl(recipient.dial);
                    // An unresolvable number gets no link at all: WhatsApp would open its home page, which looks like a blank screen.
                    return conversation ? (
                      <a className="inline-flex min-h-9 items-center gap-1.5 border border-[#d9e4d7] dark:border-[#31503a] bg-[#f1f6ef] dark:bg-[#1f2c22] px-2.5 text-xs text-[#304737] dark:text-[#cfe0d2]" href={conversation} target="_blank" rel="noopener noreferrer"><Send size={13} />WhatsApp</a>
                    ) : (
                      <span className="inline-flex min-h-9 items-center gap-1.5 border border-[#f0dccd] dark:border-[#4a332f] bg-[#fdf3ec] dark:bg-[#2b1f1d] px-2.5 text-xs text-[#8d5a3c] dark:text-[#eaa79b]">{recipient.label}</span>
                    );
                  })()}
                  {selectedQuote.customer.email && <a className="inline-flex min-h-9 items-center gap-1.5 border border-[#dedbd3] dark:border-[#333d34] px-2.5 text-xs" href={`mailto:${selectedQuote.customer.email}`}><Mail size={13} />E-mail</a>}
                </div>
                <p className="mt-3 text-xs leading-5 text-[#687068] dark:text-[#b3bcb2]">{selectedQuote.customer.address || "Adresse non renseignée"}</p>
                {selectedQuote.project.location && <p className="mt-1 text-xs text-[#687068] dark:text-[#b3bcb2]">Chantier : {selectedQuote.project.location}</p>}
              </section>
              <section className="border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-4">
                <h3 className="text-xs font-semibold tracking-wide text-[#a97850] dark:text-[#dcb487]">PROJET</h3>
                <p className="mt-2 text-sm font-semibold">{selectedQuote.project.ceilingType}</p>
                <p className="mt-1 text-xs text-[#687068] dark:text-[#b3bcb2]">{selectedQuote.project.totalArea} m² · {selectedQuote.project.rooms.length} pièce(s)</p>
                <p className="mt-2 whitespace-pre-line text-xs leading-5 text-[#687068] dark:text-[#b3bcb2]">{selectedQuote.project.description || "Sans description"}</p>
                <div className="mt-3 space-y-2 border-t border-[#efede7] dark:border-[#262e27] pt-2">{selectedQuote.project.rooms.map((room, index) => <p key={`${room.name}-${index}`} className="text-xs text-[#687068] dark:text-[#b3bcb2]"><span className="font-medium text-[#a97850] dark:text-[#dcb487]">{room.floorName ? `${room.floorName} · ${room.apartmentName || room.sectionName || ""} · ` : ""}</span>{room.parentRoomName ? `↳ ${room.name} de ${room.parentRoomName}` : room.name} · {room.area ?? "—"} m²{room.ceilingTypeName && ` · ${room.ceilingTypeName} · ${formatCurrency(room.pricePerSqm || 0)}/m²`}{room.amount !== undefined && ` · ${formatCurrency(room.amount)}`}</p>)}</div>
              </section>
            </div>
            <section className="mx-5 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] sm:mx-7">
              <div className="border-b border-[#efede7] dark:border-[#262e27] px-4 py-3"><h3 className="text-xs font-semibold tracking-wide text-[#a97850] dark:text-[#dcb487]">DÉTAIL DU CALCUL</h3></div>
              <div className="divide-y divide-[#efede7] dark:divide-[#262e27]">{selectedQuote.items.map((item, index) => <div key={item.key || `${item.label}-${index}`} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-xs ${item.kind === "bathroom" ? "pl-8" : ""}`}><span className="min-w-0 flex-1">{["room", "bathroom"].includes(item.kind || "") && <span className="mb-1 block font-medium text-[#a97850] dark:text-[#dcb487]">{item.floorName} · {item.apartmentName}</span>}{item.kind === "bathroom" ? `↳ ${item.roomName} de ${item.parentRoomName}` : item.roomName || item.label}{item.ceilingTypeName && <span className="block text-[#687068] dark:text-[#b3bcb2]">{item.ceilingTypeName}</span>} <span className="text-[#85877f] dark:text-[#96a094]">· {item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}</span></span><span className="font-semibold tabular-nums">{formatCurrency(item.amount)}</span></div>)}</div>
              <div className="space-y-1 border-t border-[#efede7] dark:border-[#262e27] px-4 py-3 text-xs"><div className="flex justify-between"><span>Sous-total</span><span>{formatCurrency(selectedQuote.totals.subtotal)}</span></div>{selectedQuote.totals.discount > 0 && <div className="flex justify-between"><span>Remise</span><span>- {formatCurrency(selectedQuote.totals.discount)}</span></div>}<div className="flex justify-between border-t border-[#efede7] dark:border-[#262e27] pt-2 text-sm font-semibold"><span>Total estimatif</span><span>{formatCurrency(selectedQuote.totals.total)}</span></div></div>
            </section>
            {selectedQuote.versions?.length ? <section className="mx-5 sm:mx-7"><h3 className="text-xs font-semibold tracking-wide text-[#a97850] dark:text-[#dcb487]">VERSIONS COMMERCIALES</h3><div className="mt-2 divide-y divide-[#e8e5de] dark:divide-[#2b342c] border-y border-[#e8e5de] dark:border-[#2b342c]">{selectedQuote.versions.map((version) => <div key={version.version} className="flex flex-wrap justify-between gap-2 py-2 text-xs"><span><strong>Version {version.version}</strong> · {version.change_type}{version.reason ? ` · ${version.reason}` : ""}{version.version === selectedQuote.accepted_version ? " · ACCEPTÉE" : ""}</span><span>{formatCurrency(version.snapshot.totals.total)} · {new Date(version.created_at).toLocaleString("fr-FR")}</span></div>)}</div></section> : null}
            {selectedQuote.history?.length ? <section className="mx-5 sm:mx-7"><h3 className="text-xs font-semibold tracking-wide text-[#a97850] dark:text-[#dcb487]">HISTORIQUE</h3><div className="mt-2 space-y-2">{selectedQuote.history.slice(0, 5).map((entry, index) => <p key={`${entry.created_at}-${index}`} className="text-xs text-[#687068] dark:text-[#b3bcb2]">{new Date(entry.created_at).toLocaleString("fr-FR")} · {entry.action}</p>)}</div></section> : null}
            <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] px-5 py-4 sm:px-7">
              {!selectedQuote.accepted_at && !["Devis accepté", "Converti en facture", "Terminé"].includes(selectedQuote.status) && <button type="button" onClick={() => void beginEditQuote(selectedQuote)} className="inline-flex min-h-10 items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 text-xs font-medium"><Settings2 size={14} />Modifier</button>}
              {!selectedQuote.accepted_at && !["Devis accepté", "Converti en facture", "Terminé", "Devis refusé"].includes(selectedQuote.status) && <button type="button" onClick={() => beginNegotiation(selectedQuote)} className="inline-flex min-h-10 items-center gap-2 border border-[#d9e4d7] dark:border-[#31503a] bg-[#f1f6ef] dark:bg-[#1f2c22] px-3 text-xs font-medium text-[#304737] dark:text-[#cfe0d2]"><CircleDollarSign size={14} />Négocier / Ajuster le prix</button>}
              {selectedQuote.accepted_at && selectedQuote.status === "Devis accepté" && <button type="button" onClick={() => { setRevisionReason(""); setRevisionOpen(true); }} className="inline-flex min-h-10 items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 text-xs font-medium"><Settings2 size={14} />Réviser le devis</button>}
              <button type="button" onClick={() => previewQuotePdf(selectedQuote)} className="inline-flex min-h-10 items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 text-xs font-medium"><Eye size={14} />Aperçu PDF</button><button type="button" onClick={() => downloadQuote(selectedQuote)} className="inline-flex min-h-10 items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 text-xs font-medium"><Download size={14} />Télécharger</button><button type="button" onClick={() => printQuote(selectedQuote)} className="inline-flex min-h-10 items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 text-xs font-medium"><Printer size={14} />Imprimer</button><button type="button" onClick={() => void shareQuote(selectedQuote)} disabled={Boolean(sharing)} className="inline-flex min-h-10 items-center gap-2 border border-[#d9e4d7] dark:border-[#31503a] bg-[#f1f6ef] dark:bg-[#1f2c22] px-3 text-xs font-medium text-[#304737] dark:text-[#cfe0d2] disabled:cursor-not-allowed disabled:opacity-60">{sharing === selectedQuote.number ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}{sharing === selectedQuote.number ? "Génération du PDF…" : "Partager"}</button>
              {selectedQuote.status === "Nouveau" && <button type="button" onClick={() => updateQuoteStatus(selectedQuote, "Contacté")} className="inline-flex min-h-10 items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 text-xs font-medium">Marquer contacté</button>}
              {!selectedQuote.accepted_at && !["Converti en facture", "Terminé", "Devis refusé"].includes(selectedQuote.status) && <button type="button" onClick={() => updateQuoteStatus(selectedQuote, "Devis préparé")} className="inline-flex min-h-10 items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 text-xs font-medium"><FilePlus2 size={14} />Préparer le devis</button>}
              {!selectedQuote.accepted_at && !["Converti en facture", "Terminé", "Devis refusé"].includes(selectedQuote.status) && <button type="button" onClick={() => updateQuoteStatus(selectedQuote, "Devis refusé")} className="ml-auto inline-flex min-h-10 items-center border border-[#ead6d1] dark:border-[#4a332f] px-3 text-xs font-medium text-[#8a4d43] dark:text-[#e08b7d]">Refuser</button>}
              {!selectedQuote.accepted_at && selectedQuote.status !== "Devis accepté" && !["Converti en facture", "Terminé", "Devis refusé"].includes(selectedQuote.status) && <button type="button" onClick={() => updateQuoteStatus(selectedQuote, "Devis accepté")} className="inline-flex min-h-10 items-center gap-2 bg-[#293b32] dark:bg-[#2f4438] px-3 text-xs font-semibold text-white"><CheckCircle2 size={14} />Accepter</button>}
              {selectedQuote.status === "Devis accepté" && <button type="button" onClick={() => run(async () => { const invoice = await api<{ id: number }>("/admin/quotes/" + selectedQuote.id + "/convert", { method: "POST" }); await refresh(); onNavigate("invoices", "", null, invoice.id); }, "Facture créée depuis le devis accepté.")} className="inline-flex min-h-10 items-center gap-2 bg-[#293b32] dark:bg-[#2f4438] px-3 text-xs font-semibold text-white"><ReceiptText size={14} />Convertir en facture</button>}
              {canCreate && <button type="button" onClick={() => void deleteQuote(selectedQuote)} className="inline-flex min-h-10 items-center gap-2 border border-[#ead6d1] dark:border-[#4a332f] px-3 text-xs font-medium text-[#8a4d43] dark:text-[#e08b7d]"><Trash2 size={14} />Supprimer</button>}
            </div>
          </>}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(negotiationQuote)} onOpenChange={(open) => { if (!open) setNegotiationQuote(null); }}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Négocier le devis {negotiationQuote?.number}</DialogTitle><DialogDescription>Chaque ajustement crée une nouvelle version ; le montant initial reste conservé.</DialogDescription></DialogHeader>
          {negotiationQuote && <form onSubmit={saveNegotiation} className="space-y-4">
            <div className="flex items-center justify-between border border-[#e8e5de] dark:border-[#2b342c] bg-[#f7f5ef] dark:bg-[#202820] p-3 text-sm"><span>Montant actuel</span><strong>{formatCurrency(negotiationQuote.totals.total)}</strong></div>
            <div className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide text-[#a97850] dark:text-[#dcb487]">PRIX UNITAIRES AJUSTÉS (FACULTATIF)</h3>
              {negotiationQuote.items.filter((item) => item.key).map((item) => <label key={item.key} className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3 text-xs"><span>{item.roomName || item.label} · {item.quantity} {item.unit}</span><NumericInput min="0" step="1" value={negotiationPrices[item.key!] ?? item.unitPrice} onChange={(event) => setNegotiationPrices((current) => ({ ...current, [item.key!]: event.target.value }))} className="h-10 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 text-right" aria-label={`Prix unitaire ${item.roomName || item.label}`} /></label>)}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs"><span>Type de négociation</span><select value={negotiationMode} onChange={(event) => { const mode = event.target.value as typeof negotiationMode; setNegotiationMode(mode); setNegotiationValue(mode === "final" ? String(negotiationSubtotal) : "0"); }} className="h-10 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3"><option value="final">Montant final convenu</option><option value="fixed">Remise en FCFA</option><option value="percent">Remise en pourcentage</option></select></label>
              <label className="space-y-1 text-xs"><span>{negotiationMode === "final" ? "Nouveau montant final (FCFA)" : negotiationMode === "fixed" ? "Remise (FCFA)" : "Remise (%)"}</span><NumericInput required min="0" max={negotiationMode === "percent" ? 100 : 1000000000} step={negotiationMode === "percent" ? "0.01" : "1"} value={negotiationValue} onChange={(event) => setNegotiationValue(event.target.value)} className="h-10 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3" /></label>
            </div>
            <label className="block space-y-1 text-xs"><span>Motif de la remise (facultatif)</span><textarea maxLength={1000} value={negotiationReason} onChange={(event) => setNegotiationReason(event.target.value)} rows={3} className="w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] p-3" /></label>
            <div className="flex items-center justify-between border-t border-[#e8e5de] dark:border-[#2b342c] pt-3 text-sm"><span>Nouveau total estimé</span><strong className="text-base">{formatCurrency(negotiationFinal)}</strong></div>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setNegotiationQuote(null)} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-4 text-sm">Annuler</button><button type="submit" disabled={negotiationFinal < 0 || negotiationDiscount > negotiationSubtotal || (negotiationMode === "final" && Number(negotiationValue) > negotiationSubtotal)} className="min-h-10 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white disabled:opacity-50">Enregistrer la nouvelle version</button></div>
          </form>}
        </DialogContent>
      </Dialog>
      <Dialog open={revisionOpen} onOpenChange={setRevisionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Réviser le devis accepté</DialogTitle><DialogDescription>La version acceptée restera archivée. La révision réouvre le devis et nécessite une nouvelle acceptation.</DialogDescription></DialogHeader>
          <form onSubmit={reviseAcceptedQuote} className="space-y-4">
            <label className="block space-y-1 text-xs"><span>Motif de la révision</span><textarea required minLength={3} maxLength={1000} value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} rows={4} className="w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] p-3" /></label>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setRevisionOpen(false)} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-4 text-sm">Annuler</button><button type="submit" disabled={!revisionReason.trim()} className="min-h-10 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white disabled:opacity-50">Créer la révision</button></div>
          </form>
        </DialogContent>
      </Dialog>
      <PdfPreviewModal preview={quotePdfPreview} onClose={closeQuotePdf} />
      <QuoteBuilderDialog open={builderOpen} onOpenChange={setBuilderOpen} onCreated={(id) => { refresh(); void openQuote(id); }} />
    </>
  );
}

type AdminReview = { id: number; displayName: string; rating: number; comment: string; contact: string; realizationId: number | null; realizationTitle: string; ceilingTypeKey: string; ceilingTypeName: string; status: string; createdAt: string };
function ReviewsAdmin({ run }: { run: (action: () => Promise<unknown>, success?: string) => Promise<void> }) {
  const [items, setItems] = useState<AdminReview[]>([]);
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(25);
  const [selected, setSelected] = useState<AdminReview | null>(null);
  const [editing, setEditing] = useState(false);
  const [ceilingTypeOptions, setCeilingTypeOptions] = useState<Array<{ key: string; name: string }>>([]);
  const load = useCallback(() => {
    setLoading(true);
    return api<AdminReview[]>("/admin/reviews")
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    load();
    api<Array<{ key: string; name: string; calculation: string }>>("/public/pricing")
      .then((prices) => setCeilingTypeOptions(prices.filter((price) => price.calculation === "area" && !["main_oeuvre", "materiaux"].includes(price.key))))
      .catch(() => setCeilingTypeOptions([]));
  }, [load]);
  const setStatus = (item: AdminReview, status: string) => run(async () => { await api("/admin/reviews/" + item.id + "/status", { method: "PATCH", body: JSON.stringify({ status }) }); const next = { ...item, status }; setSelected(current => (current && current.id === item.id ? next : current)); await load(); }, "Statut de l’avis mis à jour.");
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    await run(async () => {
      await api("/admin/reviews/" + selected.id, { method: "PUT", body: JSON.stringify({ displayName: selected.displayName, rating: Number(selected.rating), comment: selected.comment, contact: selected.contact, ceilingTypeKey: selected.ceilingTypeKey || null }) });
      setSelected({
        ...selected,
        ceilingTypeName: ceilingTypeOptions.find((option) => option.key === selected.ceilingTypeKey)?.name || "",
      });
      setEditing(false);
      await load();
    }, "Avis modifié.");
  };
  const remove = async (item: AdminReview) => { if (!(await confirm({ title: "Supprimer cet avis ?", message: `L’avis de ${item.displayName} sera définitivement effacé.`, confirmLabel: "Supprimer", destructive: true }))) return; await run(async () => { await api("/admin/reviews/" + item.id, { method: "DELETE" }); setSelected(null); await load(); }, "Avis supprimé."); };
  const term = query.trim().toLowerCase();
  const filtered = term
    ? items.filter((item) =>
        `${item.displayName} ${item.comment} ${item.contact} ${item.ceilingTypeName || ""} ${item.realizationTitle || ""} ${item.status}`
          .toLowerCase()
          .includes(term),
      )
    : items;
  const visibleReviews = filtered.slice(0, limit);
  return <>
    <PageTitle eyebrow="RELATION CLIENT" title="Avis clients" note="Les avis restent masqués du site public jusqu’à leur approbation. Cliquez sur une ligne pour la détailler." />
    <div className="mb-3">
      <label className="relative block sm:max-w-sm">
        <Search size={16} className="absolute left-3 top-3 text-[#8b8e86] dark:text-[#96a094]" aria-hidden="true" />
        <input
          type="search"
          aria-label="Rechercher un avis"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setLimit(25); }}
          placeholder="Client, commentaire, type de plafond"
          className="w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[#a97850]"
        />
      </label>
    </div>
    {loading ? <div className="space-y-2">{[0, 1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c]" />)}</div> : !items.length ? <div className="border border-dashed border-[#d8d5cc] dark:border-[#3a443b] bg-white dark:bg-[#1b221c] px-5 py-14 text-center"><Star size={26} className="mx-auto text-[#9a7a5b] dark:text-[#c9a97e]" /><p className="mt-3 text-sm font-semibold">Aucun avis client pour le moment</p><p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">Les visiteurs pourront laisser un avis depuis le site public.</p></div> : !filtered.length ? <div className="border border-dashed border-[#d8d5cc] dark:border-[#3a443b] bg-white dark:bg-[#1b221c] px-5 py-14 text-center text-sm text-[#85877f] dark:text-[#96a094]">Aucun avis ne correspond à « {query} ».</div> : (
      <>
        <div className="space-y-3 md:hidden">
          {visibleReviews.map(item => (
            <button key={item.id} type="button" onClick={() => { setSelected(item); setEditing(false); }} className="block w-full border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-4 text-left hover:bg-[#fbfaf7] hover:dark:bg-[#171d18]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.displayName}</p>
                  <p className="mt-0.5 text-xs text-[#85877f] dark:text-[#96a094]">{new Date(item.createdAt).toLocaleDateString("fr-FR")}{item.ceilingTypeName ? " · " + item.ceilingTypeName : item.realizationTitle ? " · " + item.realizationTitle : ""}</p>
                </div>
                <Status status={item.status} />
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-[#5d645e] dark:text-[#b3bcb2]">{item.comment}</p>
              <p className="mt-2 text-sm text-[#a97850] dark:text-[#dcb487]">{"★".repeat(item.rating)}</p>
            </button>
          ))}
        </div>
        <div className="hidden overflow-hidden border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#f8f7f3] dark:bg-[#1e261f] text-[11px] uppercase tracking-wider text-[#747971] dark:text-[#aab3a8]">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Commentaire</th>
                <th className="px-4 py-3">Type de plafond</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efede7] dark:divide-[#262e27]">
              {visibleReviews.map(item => (
                <tr
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-label={"Ouvrir l’avis de " + item.displayName}
                  onClick={() => { setSelected(item); setEditing(false); }}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(item); setEditing(false); } }}
                  className="cursor-pointer hover:bg-[#fbfaf7] hover:dark:bg-[#171d18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a97850]"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold">{item.displayName}</p>
                    {item.contact && <p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">{item.contact}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#a97850] dark:text-[#dcb487]">{"★".repeat(item.rating)}<span className="text-[#d7d4cc] dark:text-[#3d463d]">{"★".repeat(5 - item.rating)}</span></td>
                  <td className="max-w-[280px] px-4 py-3"><p className="truncate text-[#5d645e] dark:text-[#b3bcb2]">{item.comment}</p></td>
                  <td className="px-4 py-3 text-xs text-[#676d65] dark:text-[#a8b1a6]">{item.ceilingTypeName || item.realizationTitle || "—"}</td>
                  <td className="px-4 py-3"><Status status={item.status} /></td>
                  <td className="px-4 py-3 text-xs text-[#85877f] dark:text-[#96a094]">{new Date(item.createdAt).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#85877f] dark:text-[#96a094]">
          <p>{visibleReviews.length} avis affiché{visibleReviews.length > 1 ? "s" : ""} sur {filtered.length}{term ? ` (${items.length} au total)` : ""}.</p>
          {filtered.length > visibleReviews.length && (
            <button
              type="button"
              onClick={() => setLimit((current) => current + 25)}
              className="min-h-11 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-4 font-medium transition-colors hover:bg-[#f7f6f2] hover:dark:bg-[#1e261f]"
            >
              Afficher {Math.min(25, filtered.length - visibleReviews.length)} avis de plus
            </button>
          )}
        </div>
      </>
    )}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) { setSelected(null); setEditing(false); } }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-xl overflow-y-auto border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0">
        <DialogHeader className="border-b border-[#e8e5de] dark:border-[#2b342c] px-5 py-5 pr-14"><DialogTitle className="font-heading text-2xl">Avis de {selected?.displayName}</DialogTitle><DialogDescription>Statut : {selected?.status} · publication soumise à approbation.</DialogDescription></DialogHeader>
        {selected && !editing && (
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-[#a97850] dark:text-[#dcb487]">{"★".repeat(selected.rating)}<span className="text-[#d7d4cc] dark:text-[#3d463d]">{"★".repeat(5 - selected.rating)}</span></span>
              <span className="text-xs text-[#85877f] dark:text-[#96a094]">{new Date(selected.createdAt).toLocaleDateString("fr-FR")}</span>
            </div>
            {selected.comment ? <p className="whitespace-pre-line text-sm leading-6 text-[#5d645e] dark:text-[#b3bcb2]">{selected.comment}</p> : <p className="text-sm italic text-[#85877f] dark:text-[#96a094]">Aucun commentaire.</p>}
            <div className="grid gap-1 text-xs text-[#676d65] dark:text-[#a8b1a6]">
              <p>Contact : <strong className="text-[#29352f] dark:text-[#e9ece6]">{selected.contact || "non renseigné"}</strong></p>
              <p>Type de plafond : <strong className="text-[#29352f] dark:text-[#e9ece6]">{selected.ceilingTypeName || selected.realizationTitle || "—"}</strong></p>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-[#efede7] dark:border-[#262e27] pt-4">
              {selected.status !== "Approuvé" && <button onClick={() => setStatus(selected, "Approuvé")} className="min-h-10 bg-[#293b32] dark:bg-[#2f4438] px-4 text-xs font-semibold text-white">Approuver</button>}
              {selected.status !== "Refusé" && <button onClick={() => setStatus(selected, "Refusé")} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-4 text-xs hover:bg-[#f7f6f2] hover:dark:bg-[#1e261f]">Refuser</button>}
              <button onClick={() => setEditing(true)} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-4 text-xs hover:bg-[#f7f6f2] hover:dark:bg-[#1e261f]">Modifier</button>
              <button onClick={() => remove(selected)} className="min-h-10 border border-[#ead6d1] dark:border-[#4a332f] bg-white dark:bg-[#1b221c] px-4 text-xs text-[#8a4d43] dark:text-[#e08b7d] hover:bg-[#faf1ee] hover:dark:bg-[#2b1f1d]">Supprimer</button>
            </div>
          </div>
        )}
        {selected && editing && (
          <form onSubmit={save} className="space-y-4 p-5">
            <label className="block text-sm">Nom<input required minLength={2} maxLength={100} value={selected.displayName} onChange={e => setSelected({ ...selected, displayName: e.target.value })} className="mt-1.5 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 py-3" /></label>
            <label className="block text-sm">WhatsApp ou e-mail<input maxLength={160} value={selected.contact} onChange={e => setSelected({ ...selected, contact: e.target.value })} className="mt-1.5 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 py-3" /></label>
            <label className="block text-sm">Note<select value={selected.rating} onChange={e => setSelected({ ...selected, rating: Number(e.target.value) })} className="mt-1.5 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 py-3">{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} / 5</option>)}</select></label>
            <label className="block text-sm">Commentaire (facultatif)<textarea maxLength={2000} rows={5} value={selected.comment} onChange={e => setSelected({ ...selected, comment: e.target.value })} className="mt-1.5 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 py-3" /></label>
            <label className="block text-sm">Type de plafond concerné (facultatif)
              <select value={selected.ceilingTypeKey} onChange={e => { const key = e.target.value; setSelected({ ...selected, ceilingTypeKey: key, ceilingTypeName: ceilingTypeOptions.find(option => option.key === key)?.name || "" }); }} className="mt-1.5 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 py-3">
                <option value="">Aucun type sélectionné</option>
                {ceilingTypeOptions.map(option => <option key={option.key} value={option.key}>{option.name}</option>)}
              </select>
            </label>
            <div className="flex gap-2">
              <button className="min-h-11 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm text-white">Enregistrer</button>
              <button type="button" onClick={() => setEditing(false)} className="min-h-11 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-4 text-sm">Annuler</button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  </>;
}

function Status({ status }: { status: string }) {
  const green = ["Payée", "Devis accepté", "Terminé"].includes(status);
  const amber = [
    "Nouveau",
    "Émise",
    "Devis envoyé",
    "Partiellement payée",
  ].includes(status);
  return (
    <span
      className={`inline-flex border px-2 py-1 text-[11px] font-medium ${green ? "border-[#cdded0] dark:border-[#31503a] bg-[#eef5ef] dark:bg-[#1f2c22] text-[#3f6948] dark:text-[#8fc79d]" : amber ? "border-[#ead7c4] dark:border-[#4a3d2c] bg-[#fbf2e8] dark:bg-[#2b241d] text-[#98643c] dark:text-[#d9b684]" : "border-[#dedfd9] dark:border-[#2b342c] bg-[#f3f3ef] dark:bg-[#20281f] text-[#656a63] dark:text-[#a8b1a6]"}`}
    >
      {status}
    </span>
  );
}

type ClientSummary = {
  key: string;
  customer: Invoice["customer"];
  invoiceCount: number;
  latestInvoice: Invoice;
  invoices: Invoice[];
};

function ClientsAdmin({
  onNavigate,
}: {
  onNavigate: (tab: Tab, filter?: string, quoteId?: number | null, invoiceId?: number | null) => void;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientSummary | null>(null);
  const loadClients = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setInvoices(await api<Invoice[]>("/admin/invoices"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger les clients.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const clients = useMemo(() => {
    const records = new Map<string, ClientSummary>();
    const latestFirst = [...invoices].sort((a, b) => {
      const dateOrder = Date.parse(b.issued_at) - Date.parse(a.issued_at);
      return Number.isNaN(dateOrder) || dateOrder === 0 ? b.id - a.id : dateOrder;
    });

    for (const invoice of latestFirst) {
      const customer = invoice.customer;
      const name = customer.name.trim();
      if (!name) continue;

      const phone = (customer.whatsapp || customer.phone || "").replace(/\D/g, "");
      const email = (customer.email || "").trim().toLowerCase();
      const address = (customer.address || "").trim().toLowerCase();
      const key = phone
        ? `phone:${phone}`
        : email
          ? `email:${email}`
          : `name:${name.toLowerCase()}|${address}`;
      const existing = records.get(key);
      if (existing) {
        existing.invoiceCount += 1;
        existing.invoices.push(invoice);
        existing.customer = {
          name: existing.customer.name || customer.name,
          phone: existing.customer.phone || customer.phone,
          whatsapp: existing.customer.whatsapp || customer.whatsapp,
          email: existing.customer.email || customer.email,
          address: existing.customer.address || customer.address,
        };
        continue;
      }

      records.set(key, { key, customer, invoiceCount: 1, latestInvoice: invoice, invoices: [invoice] });
    }

    return [...records.values()].sort((a, b) => a.customer.name.localeCompare(b.customer.name, "fr"));
  }, [invoices]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleClients = clients.filter(({ customer }) =>
    [customer.name, customer.phone, customer.whatsapp, customer.email, customer.address]
      .some((value) => value?.toLowerCase().includes(normalizedQuery)),
  );

  return (
    <>
      <PageTitle
        eyebrow="RELATION CLIENT"
        title="Clients"
        note="Liste générée à partir des coordonnées enregistrées sur les factures."
        action={<span className="text-sm text-[#72766e] dark:text-[#aab3a8]">{clients.length} client{clients.length === 1 ? "" : "s"}</span>}
      />
      <label className="relative mb-5 block w-full sm:max-w-sm">
        <Search size={16} className="absolute left-3 top-3 text-[#8b8e86] dark:text-[#96a094]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nom, téléphone, e-mail ou adresse"
          className="w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] py-2.5 pl-9 pr-3 text-sm"
        />
      </label>

      {loading ? (
        <p role="status" className="border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] px-5 py-10 text-center text-sm text-[#72766e] dark:text-[#aab3a8]">
          Chargement des clients…
        </p>
      ) : error ? (
        <div role="alert" className="border border-[#ead6d1] dark:border-[#4a332f] bg-white dark:bg-[#1b221c] px-5 py-6 text-sm">
          <p>{error}</p>
          <button type="button" onClick={() => void loadClients()} className="mt-4 min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-4 font-medium">
            Réessayer
          </button>
        </div>
      ) : visibleClients.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleClients.map((client) => {
            const { key, customer, invoiceCount, latestInvoice } = client;
            const phone = customer.whatsapp || customer.phone;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedClient(client)}
                aria-label={`Ouvrir la fiche de ${customer.name}`}
                className="min-w-0 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-4 text-left transition hover:border-[#bacbbb] hover:dark:border-[#48624e] hover:bg-[#fbfaf7] hover:dark:bg-[#20281f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#48624e] sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{customer.name}</h3>
                    <p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">
                      {invoiceCount} facture{invoiceCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-[#72766e] dark:text-[#aab3a8]">
                    <span className="text-right">
                      <span className="block font-medium text-[#29352f] dark:text-[#e9ece6]">{latestInvoice.number}</span>
                      <span className="mt-1 block">{new Date(latestInvoice.issued_at).toLocaleDateString("fr-FR")}</span>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-4 grid gap-2 border-t border-[#efede7] dark:border-[#262e27] pt-3 text-sm">
                  {phone ? <span className="truncate text-[#48624e] dark:text-[#9ecfa9]">{phone}</span> : <span className="text-[#85877f] dark:text-[#96a094]">Téléphone non renseigné</span>}
                  {customer.email ? <span className="truncate text-[#48624e] dark:text-[#9ecfa9]">{customer.email}</span> : null}
                  {customer.address ? <p className="break-words text-[#72766e] dark:text-[#aab3a8]">{customer.address}</p> : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="border border-dashed border-[#d8d5cc] dark:border-[#3a443b] bg-white dark:bg-[#1b221c] px-5 py-12 text-center text-sm text-[#72766e] dark:text-[#aab3a8]">
          {clients.length
            ? "Aucun client ne correspond à cette recherche."
            : "Aucun client enregistré. Les clients apparaîtront ici après l’émission d’une facture."}
        </div>
      )}

      <Dialog open={Boolean(selectedClient)} onOpenChange={(open) => { if (!open) setSelectedClient(null); }}>
        <DialogContent scrollClassName="gap-0" className="w-[calc(100vw-2rem)] max-w-2xl gap-0 border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0">
            <DialogHeader className="border-b border-[#e8e5de] dark:border-[#2b342c] px-5 py-5 pr-14 sm:px-7">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">FICHE CLIENT</p>
              <DialogTitle className="font-heading text-2xl text-[#29352f] dark:text-[#e9ece6]">{selectedClient?.customer.name}</DialogTitle>
              <DialogDescription className="text-sm text-[#72766e] dark:text-[#aab3a8]">
                Coordonnées et factures associées à ce client.
              </DialogDescription>
            </DialogHeader>
            {selectedClient ? (
              <div className="space-y-6 px-5 py-5 sm:px-7">
                <section className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-[#85877f] dark:text-[#96a094]">TÉLÉPHONE</p>
                    <p className="mt-1 break-words text-sm">{selectedClient.customer.whatsapp || selectedClient.customer.phone || "Non renseigné"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-[#85877f] dark:text-[#96a094]">E-MAIL</p>
                    <p className="mt-1 break-all text-sm">{selectedClient.customer.email || "Non renseigné"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-[#85877f] dark:text-[#96a094]">ADRESSE</p>
                    <p className="mt-1 break-words text-sm">{selectedClient.customer.address || "Non renseignée"}</p>
                  </div>
                </section>
                <section>
                  <div className="mb-3 flex items-center justify-between gap-3 border-b border-[#e8e5de] dark:border-[#2b342c] pb-2">
                    <h3 className="text-sm font-semibold">Factures associées</h3>
                    <span className="text-xs text-[#72766e] dark:text-[#aab3a8]">{selectedClient.invoices.length}</span>
                  </div>
                  <div className="space-y-2">
                    {selectedClient.invoices.map((invoice) => (
                      <button
                        key={invoice.id}
                        type="button"
                        onClick={() => onNavigate("invoices", "", null, invoice.id)}
                        className="flex w-full flex-wrap items-center justify-between gap-3 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] px-4 py-3 text-left transition hover:border-[#bacbbb] hover:dark:border-[#48624e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#48624e]"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{invoice.number}</span>
                          <span className="mt-1 block text-xs text-[#72766e] dark:text-[#aab3a8]">
                            {new Date(invoice.issued_at).toLocaleDateString("fr-FR")}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <Status status={invoice.status} />
                          <span className="text-sm font-semibold">{formatCurrency(invoice.totals.total)}</span>
                          <ChevronRight size={15} aria-hidden="true" />
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Invoices({
  run,
  initialStatus,
  initialInvoiceId,
  clearInitialInvoice,
  canDelete,
}: {
  run: (action: () => Promise<unknown>, success?: string) => Promise<void>;
  initialStatus: string;
  initialInvoiceId: number | null;
  clearInitialInvoice: () => void;
  canDelete: boolean;
}) {
  const confirm = useConfirm();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [limit, setLimit] = useState(25);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [paymentFor, setPaymentFor] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceDetailLoading, setInvoiceDetailLoading] = useState(false);
  const [invoiceDetailError, setInvoiceDetailError] = useState("");
  const [invoicePdfPreview, setInvoicePdfPreview] = useState<PdfPreviewData | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [acceptedQuotes, setAcceptedQuotes] = useState<Quote[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [loadingAcceptedQuotes, setLoadingAcceptedQuotes] = useState(false);
  const [confirmEmission, setConfirmEmission] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Wave");
  const [reference, setReference] = useState("");
  const [correctionFor, setCorrectionFor] = useState<Invoice | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionDiscount, setCorrectionDiscount] = useState("0");
  const [correctionPrices, setCorrectionPrices] = useState<Record<string, string>>({});
  const refresh = useCallback(
    () =>
      api<Invoice[]>(
        `/admin/invoices${status ? `?status=${encodeURIComponent(status)}` : ""}`,
      )
        .then(setInvoices)
        .catch(() => setInvoices([])),
    [status],
  );
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => setStatus(initialStatus), [initialStatus]);
  const deleteInvoice = async (invoice: Invoice) => {
    if (!(await confirm({ title: `Supprimer la facture ${invoice.number} ?`, message: "La facture et ses paiements enregistrés seront définitivement effacés. Le devis d’origine repassera au statut « Devis accepté ».", confirmLabel: "Supprimer", destructive: true }))) return;
    await run(async () => {
      await api(`/admin/invoices/${invoice.id}`, { method: "DELETE" });
      setSelectedInvoice(null);
      clearInitialInvoice();
      await refresh();
    }, "Facture supprimée.");
  };
  const visible = invoices.filter((invoice) =>
    `${invoice.number} ${invoice.quoteNumber} ${invoice.customer.name}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const shownInvoices = visible.slice(0, limit);
  const savePayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!paymentFor) return;
    await run(async () => {
      await api(`/admin/invoices/${paymentFor.id}/payments`, {
        method: "POST",
        body: JSON.stringify({ amount: Number(amount), method, reference }),
      });
      setPaymentFor(null);
      setAmount("");
      await refresh();
    }, "Paiement enregistré.");
  };
  const beginCorrection = (invoice: Invoice) => {
    setCorrectionFor(invoice);
    setCorrectionReason("");
    setCorrectionDiscount(String(invoice.totals.discount || 0));
    setCorrectionPrices(Object.fromEntries((invoice.items || []).filter((item) => item.key).map((item) => [item.key!, String(item.unitPrice)])));
  };
  const correctionSubtotal = correctionFor?.items.reduce((sum, item) =>
    sum + Math.round(item.quantity * Number(correctionPrices[item.key || ""] ?? item.unitPrice)), 0) || 0;
  const correctionTotal = Math.max(0, correctionSubtotal - (Number(correctionDiscount) || 0));
  const submitCorrection = async (event: FormEvent) => {
    event.preventDefault();
    if (!correctionFor) return;
    await run(async () => {
      const created = await api<{ id: number }>(`/admin/invoices/${correctionFor.id}/correct`, {
        method: "POST",
        body: JSON.stringify({
          reason: correctionReason,
          discount: Number(correctionDiscount),
          itemPrices: Object.entries(correctionPrices).map(([key, unitPrice]) => ({ key, unitPrice: Number(unitPrice) })),
        }),
      });
      setCorrectionFor(null);
      setSelectedInvoice(await api<Invoice>(`/admin/invoices/${created.id}`));
      await refresh();
    }, "Facture rectificative numérotée créée. L’originale et son historique sont conservés.");
  };
  const download = async (invoice: Invoice) =>
    run(async () => {
      const pdf = await api<Blob>(`/admin/invoices/${invoice.id}/pdf`);
      const url = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoice.number}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    });
  const previewInvoicePdf = (invoice: Invoice) => run(async () => { const pdf = await api<Blob>(`/admin/invoices/${invoice.id}/pdf`); const url = URL.createObjectURL(pdf); setInvoicePdfPreview({ url, fileName: `${invoice.number}.pdf` }); });
  const closeInvoicePdf = () => { if (invoicePdfPreview) URL.revokeObjectURL(invoicePdfPreview.url); setInvoicePdfPreview(null); };
  const viewInvoice = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setInvoiceDetailError("");
    setInvoiceDetailLoading(true);
    try {
      setSelectedInvoice(await api<Invoice>(`/admin/invoices/${invoice.id}`));
    } catch (reason) {
      setInvoiceDetailError(reason instanceof Error ? reason.message : "Détail indisponible.");
    } finally {
      setInvoiceDetailLoading(false);
    }
  };
  useEffect(() => {
    if (initialInvoiceId) {
      const invoice = invoices.find((item) => item.id === initialInvoiceId);
      if (invoice) void viewInvoice(invoice);
    }
  }, [initialInvoiceId, invoices]);
  const printInvoice = (invoice: Invoice) => {
    const printWindow = window.open("about:blank", "_blank");
    void run(async () => {
      const pdf = await api<Blob>(`/admin/invoices/${invoice.id}/pdf`);
      const url = URL.createObjectURL(pdf);
      if (printWindow) {
        printWindow.location.href = url;
        printWindow.addEventListener("load", () => printWindow.print(), { once: true });
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = `${invoice.number}.pdf`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    });
  };
  const shareInvoice = async (invoice: Invoice) => {
    if (sharing) return;
    setSharing(invoice.number);
    await run(() => shareDocument({ kind: "facture", documentId: invoice.id, reference: invoice.number, customerName: invoice.customer.name }));
    setSharing(null);
  };
  const selectedQuote = acceptedQuotes.find((quote) => String(quote.id) === selectedQuoteId);
  const openInvoiceComposer = async () => {
    setCreateInvoiceOpen(true);
    setConfirmEmission(false);
    setSelectedQuoteId("");
    setLoadingAcceptedQuotes(true);
    try {
      setAcceptedQuotes(await api<Quote[]>("/admin/quotes?status=Devis accepté"));
    } catch {
      setAcceptedQuotes([]);
    } finally {
      setLoadingAcceptedQuotes(false);
    }
  };
  const emitFromQuote = async () => {
    if (!selectedQuote) return;
    await run(async () => {
      const created = await api<{ id: number }>(
        `/admin/quotes/${selectedQuote.id}/convert`,
        { method: "POST" },
      );
      setCreateInvoiceOpen(false);
      setConfirmEmission(false);
      await refresh();
      // La facture qui vient d'être émise s'ouvre tout de suite dans sa modal.
      setSelectedInvoice(await api<Invoice>(`/admin/invoices/${created.id}`));
    }, "Facture émise depuis le devis accepté.");
  };
  return (
    <>
      <PageTitle
        eyebrow="GESTION COMMERCIALE"
        title="Factures"
        note="Factures définitives, paiements enregistrés et montants restant à encaisser."
        action={<button onClick={openInvoiceComposer} className="inline-flex min-h-11 items-center gap-2 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white hover:bg-[#354b3f] hover:dark:bg-[#3d5648]"><Plus size={16} />Créer une facture</button>}
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search size={16} className="absolute left-3 top-3 text-[#8b8e86] dark:text-[#96a094]" />
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setLimit(25); }}
            placeholder="Facture, devis, client"
            className="w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] py-2.5 pl-9 pr-3 text-sm"
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 py-2.5 text-sm"
        >
          <option value="">Tous les statuts</option>
          <option value="impayées">Impayées</option>
          {["Émise", "Envoyée", "Partiellement payée", "Payée", "Annulée", "Rectifiée"].map(
            (value) => (
              <option key={value}>{value}</option>
            ),
          )}
        </select>
      </div>


      <Dialog open={createInvoiceOpen} onOpenChange={(open) => { setCreateInvoiceOpen(open); if (!open) setConfirmEmission(false); }}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0 sm:max-h-[88dvh]">
          <DialogHeader className="border-b border-[#e8e5de] dark:border-[#2b342c] px-5 py-5 pr-14 sm:px-7">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">FACTURATION</p>
            <DialogTitle className="font-heading text-2xl text-[#29352f] dark:text-[#e9ece6]">Créer une facture</DialogTitle>
            <DialogDescription className="text-sm text-[#72766e] dark:text-[#aab3a8]">Choisissez un devis accepté. Le serveur reprend ses lignes et recalcule le total avant émission.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-5 sm:px-7">
            <label className="block text-sm font-medium text-[#49524c] dark:text-[#ccd3cb]">Devis accepté<select value={selectedQuoteId} onChange={(event) => { setSelectedQuoteId(event.target.value); setConfirmEmission(false); }} className="mt-1.5 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 py-3 text-sm"><option value="">Sélectionner un devis</option>{acceptedQuotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.number} · {quote.customer.name} · {formatCurrency(quote.totals.total)}</option>)}</select></label>
            {loadingAcceptedQuotes && <p className="text-xs text-[#85877f] dark:text-[#96a094]">Chargement des devis acceptés…</p>}
            {!loadingAcceptedQuotes && !acceptedQuotes.length && <p className="border border-dashed border-[#d8d5cc] dark:border-[#3a443b] p-5 text-center text-sm text-[#72766e] dark:text-[#aab3a8]">Aucun devis accepté disponible pour la facturation.</p>}
            {selectedQuote && <section className="border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold">{selectedQuote.customer.name}</p><p className="mt-1 text-xs text-[#72766e] dark:text-[#aab3a8]">{selectedQuote.number} · {selectedQuote.project.location}</p></div><Status status={selectedQuote.status} /></div><div className="mt-4 space-y-2 border-t border-[#efede7] dark:border-[#262e27] pt-3">{selectedQuote.items.map((item, index) => <div key={item.key || `${item.label}-${index}`} className="flex justify-between gap-4 text-xs"><span>{item.label} · {item.quantity} {item.unit}</span><span className="font-medium">{formatCurrency(item.amount)}</span></div>)}</div><div className="mt-3 flex justify-between border-t border-[#efede7] dark:border-[#262e27] pt-3 text-sm font-semibold"><span>Total recalculé à l’émission</span><span>{formatCurrency(selectedQuote.totals.total)}</span></div></section>}
          </div>
          <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] px-5 py-4 sm:px-7"><button onClick={() => setCreateInvoiceOpen(false)} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-4 text-sm">Annuler</button>{selectedQuote && <button onClick={() => setConfirmEmission(true)} className="min-h-10 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white">Émettre la facture</button>}</div>
          <Dialog open={confirmEmission && Boolean(selectedQuote)} onOpenChange={(open) => { if (!open) setConfirmEmission(false); }}>
            <DialogContent scrollClassName="gap-0" className="w-[calc(100vw-2rem)] max-w-md gap-0 border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0">
              <DialogHeader className="border-b border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] px-6 pb-4 pr-14 pt-6">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">CONFIRMATION</p>
                <DialogTitle className="font-heading text-xl text-[#29352f] dark:text-[#e9ece6]">Émettre la facture</DialogTitle>
                <DialogDescription className="pt-1 text-sm text-[#4c534d] dark:text-[#c6cec5]">Confirmez-vous l’émission définitive de la facture pour {selectedQuote?.customer.name} ? Le document créé sera conservé dans l’historique commercial.</DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2 px-6 pb-6 pt-5">
                <button onClick={() => setConfirmEmission(false)} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-4 text-sm">Annuler</button>
                <button onClick={() => void emitFromQuote()} className="min-h-10 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white">Confirmer l’émission</button>
              </div>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>
      <div className="space-y-3 md:hidden">
        {shownInvoices.map((invoice) => (
          <button key={invoice.id} type="button" onClick={() => void viewInvoice(invoice)} className="block w-full border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-4 text-left hover:bg-[#fbfaf7] hover:dark:bg-[#171d18]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{invoice.number}</p>
                <p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">{invoice.customer.name} · Devis {invoice.quoteNumber}</p>
              </div>
              <Status status={invoice.status} />
            </div>
            <div className="mt-3 flex items-end justify-between gap-3 text-sm">
              <span className="text-xs text-[#676d65] dark:text-[#a8b1a6]">Payé : {formatCurrency(invoice.paid)}</span>
              <span className="font-semibold tabular-nums">{formatCurrency(invoice.totals.total)}{invoice.remaining > 0 && <span className="ml-2 text-xs font-normal text-[#8a4d43] dark:text-[#e08b7d]">reste {formatCurrency(invoice.remaining)}</span>}</span>
            </div>
          </button>
        ))}
        {!visible.length && <p className="border border-dashed border-[#d8d5cc] dark:border-[#3a443b] bg-white dark:bg-[#1b221c] px-5 py-10 text-center text-sm text-[#85877f] dark:text-[#96a094]">Aucune facture trouvée.</p>}
      </div>
      <div className="hidden overflow-hidden border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-[#f8f7f3] dark:bg-[#1e261f] text-[11px] uppercase tracking-wider text-[#747971] dark:text-[#aab3a8]">
              <tr>
                <th className="px-4 py-3">Facture</th>
                <th className="px-4 py-3">Client / devis</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Payé</th>
                <th className="px-4 py-3">Reste</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efede7] dark:divide-[#262e27]">
              {shownInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Ouvrir la facture ${invoice.number}`}
                  onClick={() => void viewInvoice(invoice)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void viewInvoice(invoice);
                    }
                  }}
                  className="cursor-pointer hover:bg-[#fbfaf7] hover:dark:bg-[#171d18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a97850]"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold">{invoice.number}</p>
                    <p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">
                      {new Date(invoice.issued_at).toLocaleDateString("fr-FR")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {invoice.customer.name}
                    <p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">
                      Devis {invoice.quoteNumber}
                    </p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatCurrency(invoice.totals.total)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatCurrency(invoice.paid)}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums">
                    {formatCurrency(invoice.remaining)}
                  </td>
                  <td className="px-4 py-3">
                    <Status status={invoice.status} />
                  </td>
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => void viewInvoice(invoice)} aria-label={`Voir ${invoice.number}`} className="inline-flex min-h-9 items-center gap-1 border border-[#dedbd3] dark:border-[#333d34] px-2 text-xs hover:bg-[#f7f6f2] hover:dark:bg-[#1e261f]"><Eye size={13} />Voir</button>
                      <button
                        type="button"
                        onClick={() => download(invoice)}
                        className="border border-[#dedbd3] dark:border-[#333d34] px-2.5 py-2 text-xs hover:bg-[#f7f6f2] hover:dark:bg-[#1e261f]"
                      >
                        PDF
                      </button>
                      <button type="button" onClick={() => printInvoice(invoice)} aria-label={`Imprimer ${invoice.number}`} className="inline-flex min-h-9 items-center gap-1 border border-[#dedbd3] dark:border-[#333d34] px-2 text-xs hover:bg-[#f7f6f2] hover:dark:bg-[#1e261f]"><Printer size={13} />Imprimer</button>
                      {invoice.status !== "Annulée" && <button type="button" onClick={() => void shareInvoice(invoice)} disabled={Boolean(sharing)} className="inline-flex min-h-9 items-center gap-1 border border-[#d9e4d7] dark:border-[#31503a] bg-[#f1f6ef] dark:bg-[#1f2c22] px-2 text-xs text-[#304737] dark:text-[#cfe0d2] disabled:cursor-not-allowed disabled:opacity-60">{sharing === invoice.number ? <Loader2 size={13} className="animate-spin" /> : <Share2 size={13} />}{sharing === invoice.number ? "Génération…" : "Partager"}</button>}
                      {invoice.remaining > 0 &&
                        !["Annulée", "Rectifiée"].includes(invoice.status) && (
                          <button type="button"
                            onClick={() => {
                              setPaymentFor(invoice);
                              setAmount(String(invoice.remaining));
                            }}
                            className="bg-[#293b32] dark:bg-[#2f4438] px-2.5 py-2 text-xs text-white"
                          >
                            Paiement
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-14 text-center text-sm text-[#85877f] dark:text-[#96a094]"
                  >
                    Aucune facture trouvée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {visible.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#85877f] dark:text-[#96a094]">
          <p>{shownInvoices.length} facture{shownInvoices.length > 1 ? "s" : ""} affichée{shownInvoices.length > 1 ? "s" : ""} sur {visible.length}.</p>
          {visible.length > shownInvoices.length && (
            <button
              type="button"
              onClick={() => setLimit((current) => current + 25)}
              className="min-h-11 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-4 font-medium transition-colors hover:bg-[#f7f6f2] hover:dark:bg-[#1e261f]"
            >
              Afficher {Math.min(25, visible.length - shownInvoices.length)} factures de plus
            </button>
          )}
        </div>
      )}
      <Dialog open={Boolean(paymentFor)} onOpenChange={(open) => { if (!open) setPaymentFor(null); }}>
        <DialogContent scrollClassName="gap-0" className="w-[calc(100vw-2rem)] max-w-md gap-0 border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0">
          {paymentFor && (
            <form onSubmit={savePayment} className="flex flex-col">
              <DialogHeader className="border-b border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] px-6 pb-4 pr-14 pt-6">
                <p className="text-xs font-semibold tracking-wider text-[#a97850] dark:text-[#dcb487]">
                  ENCAISSEMENT
                </p>
                <DialogTitle className="font-heading text-2xl text-[#29352f] dark:text-[#e9ece6]">
                  {paymentFor.number}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#72766e] dark:text-[#aab3a8]">
                  Reste à payer : {formatCurrency(paymentFor.remaining)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 px-6 pb-6 pt-5">
                <Field
                  label="Montant (FCFA)"
                  type="number"
                  value={amount}
                  onChange={setAmount}
                  required
                />
                <label className="block text-sm font-medium text-[#49524c] dark:text-[#ccd3cb]">
                  Mode de paiement
                  <select
                    value={method}
                    onChange={(event) => setMethod(event.target.value)}
                    className="mt-1.5 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 py-2.5 text-sm"
                  >
                    {[
                      "Wave",
                      "Orange Money",
                      "Espèces",
                      "Virement",
                      "Paiement à la livraison",
                      "Autre",
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Référence (facultatif)"
                  value={reference}
                  onChange={setReference}
                  autocomplete="off"
                />
                <button className="mt-2 w-full bg-[#293b32] dark:bg-[#2f4438] px-4 py-3 text-sm font-semibold text-white">
                  Enregistrer le paiement
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(selectedInvoice)} onOpenChange={(open) => { if (!open) { setSelectedInvoice(null); setInvoiceDetailError(""); } }}>
        <DialogContent onInteractOutside={keepDialogAroundShareTray} className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0 sm:max-h-[88dvh]">
          {selectedInvoice && <>
            <DialogHeader className="sticky top-0 z-10 border-b border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] px-5 py-5 pr-14 sm:px-7"><p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">APERÇU FACTURE</p><DialogTitle className="font-heading text-2xl text-[#29352f] dark:text-[#e9ece6]">{selectedInvoice.number}</DialogTitle><DialogDescription className="flex flex-wrap items-center gap-2 text-xs"><Status status={selectedInvoice.status} /><span>Devis {selectedInvoice.quoteNumber}</span><span>· {new Date(selectedInvoice.issued_at).toLocaleDateString("fr-FR")}</span></DialogDescription></DialogHeader>
            {(selectedInvoice.correctsInvoiceNumber || selectedInvoice.correctedByNumber || selectedInvoice.correction_reason) && <section className="mx-5 mt-4 border border-[#ead7c4] dark:border-[#4a3d2c] bg-[#fbf2e8] dark:bg-[#2b241d] p-3 text-xs sm:mx-7"><strong>Traçabilité rectificative</strong>{selectedInvoice.correctsInvoiceNumber && <p className="mt-1">Remplace la facture {selectedInvoice.correctsInvoiceNumber}.</p>}{selectedInvoice.correctedByNumber && <p className="mt-1">Remplacée par la facture {selectedInvoice.correctedByNumber} ; document conservé, non payable.</p>}{selectedInvoice.correction_reason && <p className="mt-1">Motif : {selectedInvoice.correction_reason}</p>}</section>}
            {invoiceDetailLoading && <p className="px-5 py-2 text-xs text-[#85877f] dark:text-[#96a094]">Chargement du document…</p>}
            {invoiceDetailError && <p role="alert" className="mx-5 mt-3 border border-red-200 dark:border-[#4a332f] bg-red-50 dark:bg-[#2b1f1d] p-3 text-sm text-red-800 dark:text-[#eaa79b]">{invoiceDetailError}</p>}
            <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-7">
              <section className="border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-4"><h3 className="text-xs font-semibold tracking-wide text-[#a97850] dark:text-[#dcb487]">CLIENT</h3><p className="mt-2 text-sm font-semibold">{selectedInvoice.customer.name}</p><p className="mt-1 text-xs text-[#687068] dark:text-[#b3bcb2]">{selectedInvoice.customer.phone}</p>{selectedInvoice.customer.email && <p className="mt-1 text-xs text-[#687068] dark:text-[#b3bcb2]">{selectedInvoice.customer.email}</p>}<p className="mt-1 text-xs text-[#687068] dark:text-[#b3bcb2]">{selectedInvoice.customer.address}</p></section>
              <section className="border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-4"><h3 className="text-xs font-semibold tracking-wide text-[#a97850] dark:text-[#dcb487]">ENTREPRISE</h3><p className="mt-2 text-sm font-semibold">{selectedInvoice.company?.name || "Khalil Déco Plâtre"}</p><p className="mt-1 whitespace-pre-line text-xs leading-5 text-[#687068] dark:text-[#b3bcb2]">{[selectedInvoice.company?.address, selectedInvoice.company?.phone, selectedInvoice.company?.email, selectedInvoice.company?.rccm && `RCCM : ${selectedInvoice.company.rccm}`, selectedInvoice.company?.ninea && `NINEA : ${selectedInvoice.company.ninea}`].filter(Boolean).join("\n")}</p></section>
            </div>
            <section className="mx-5 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] sm:mx-7"><div className="border-b border-[#efede7] dark:border-[#262e27] px-4 py-3"><h3 className="text-xs font-semibold tracking-wide text-[#a97850] dark:text-[#dcb487]">PRESTATIONS</h3></div><div className="divide-y divide-[#efede7] dark:divide-[#262e27]">{(selectedInvoice.items || []).map((item, index) => <div key={item.key || `${item.label}-${index}`} className="flex flex-wrap justify-between gap-3 px-4 py-3 text-xs"><span>{item.label} · {item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}</span><span className="font-semibold">{formatCurrency(item.amount)}</span></div>)}</div><div className="space-y-1 border-t border-[#efede7] dark:border-[#262e27] px-4 py-3 text-xs"><div className="flex justify-between"><span>Sous-total</span><span>{formatCurrency(selectedInvoice.totals.subtotal || selectedInvoice.totals.total)}</span></div>{Boolean(selectedInvoice.totals.discount) && <div className="flex justify-between"><span>Remise</span><span>- {formatCurrency(selectedInvoice.totals.discount || 0)}</span></div>}<div className="flex justify-between text-sm font-semibold"><span>Total</span><span>{formatCurrency(selectedInvoice.totals.total)}</span></div><div className="flex justify-between"><span>Payé</span><span>{formatCurrency(selectedInvoice.paid)}</span></div><div className="flex justify-between font-semibold"><span>Reste à payer</span><span>{formatCurrency(selectedInvoice.remaining)}</span></div></div></section>
            {selectedInvoice.payments?.length ? <section className="mx-5 mt-5 sm:mx-7"><h3 className="text-xs font-semibold tracking-wide text-[#a97850] dark:text-[#dcb487]">PAIEMENTS</h3><div className="mt-2 divide-y divide-[#e8e5de] dark:divide-[#2b342c]">{selectedInvoice.payments.map((payment, index) => <p key={`${payment.paid_at}-${index}`} className="py-2 text-xs">{new Date(payment.paid_at).toLocaleDateString("fr-FR")} · {payment.method}{payment.invoice_number ? ` · Facture ${payment.invoice_number}` : ""}{payment.reference ? ` · ${payment.reference}` : ""} · {formatCurrency(payment.amount)}</p>)}</div></section> : null}
            <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] px-5 py-4 sm:px-7"><button onClick={() => previewInvoicePdf(selectedInvoice)} className="inline-flex min-h-10 items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 text-xs"><Eye size={14} />Aperçu PDF</button><button onClick={() => printInvoice(selectedInvoice)} className="inline-flex min-h-10 items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 text-xs"><Printer size={14} />Imprimer</button><button onClick={() => download(selectedInvoice)} className="inline-flex min-h-10 items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 text-xs"><Download size={14} />PDF</button>{selectedInvoice.status !== "Annulée" && selectedInvoice.status !== "Rectifiée" && <button type="button" onClick={() => void shareInvoice(selectedInvoice)} disabled={Boolean(sharing)} className="inline-flex min-h-10 items-center gap-2 border border-[#d9e4d7] dark:border-[#31503a] bg-[#f1f6ef] dark:bg-[#1f2c22] px-3 text-xs text-[#304737] dark:text-[#cfe0d2] disabled:cursor-not-allowed disabled:opacity-60">{sharing === selectedInvoice.number ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}{sharing === selectedInvoice.number ? "Génération du PDF…" : "Partager"}</button>}{selectedInvoice.remaining > 0 && !["Annulée", "Rectifiée"].includes(selectedInvoice.status) && <button onClick={() => { setPaymentFor(selectedInvoice); setAmount(String(selectedInvoice.remaining)); }} className="ml-auto min-h-10 bg-[#293b32] dark:bg-[#2f4438] px-3 text-xs font-semibold text-white">Enregistrer un paiement</button>}{!selectedInvoice.correctedByNumber && !["Annulée", "Rectifiée"].includes(selectedInvoice.status) && <button type="button" onClick={() => beginCorrection(selectedInvoice)} className="inline-flex min-h-10 items-center gap-2 border border-[#d9e4d7] dark:border-[#31503a] bg-[#f1f6ef] dark:bg-[#1f2c22] px-3 text-xs font-medium text-[#304737] dark:text-[#cfe0d2]">Rectifier la facture</button>}{canDelete && <button type="button" onClick={() => void deleteInvoice(selectedInvoice)} className="inline-flex min-h-10 items-center gap-2 border border-[#ead6d1] dark:border-[#4a332f] px-3 text-xs font-medium text-[#8a4d43] dark:text-[#e08b7d]"><Trash2 size={14} />Supprimer</button>}</div>
          </>}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(correctionFor)} onOpenChange={(open) => { if (!open) setCorrectionFor(null); }}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Rectifier la facture {correctionFor?.number}</DialogTitle><DialogDescription>Une nouvelle facture numérotée sera créée. L’originale et les paiements déjà enregistrés resteront conservés.</DialogDescription></DialogHeader>
          {correctionFor && <form onSubmit={submitCorrection} className="space-y-4">
            <div className="border border-[#ead7c4] dark:border-[#4a3d2c] bg-[#fbf2e8] dark:bg-[#2b241d] p-3 text-xs">Montant déjà payé dans la chaîne : <strong>{formatCurrency(correctionFor.paid)}</strong>. La nouvelle facture doit au minimum couvrir les paiements conservés.</div>
            <div className="space-y-2"><h3 className="text-xs font-semibold tracking-wide text-[#a97850] dark:text-[#dcb487]">PRESTATIONS ET PRIX CONVENUS</h3>
              {(correctionFor.items || []).filter((item) => item.key).map((item) => <label key={item.key} className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3 text-xs"><span>{item.label} · {item.quantity} {item.unit}</span><NumericInput min="0" step="1" value={correctionPrices[item.key!] ?? item.unitPrice} onChange={(event) => setCorrectionPrices((current) => ({ ...current, [item.key!]: event.target.value }))} className="h-10 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 text-right" aria-label={`Prix unitaire ${item.label}`} /></label>)}
            </div>
            <label className="block space-y-1 text-xs"><span>Remise globale conservée / corrigée (FCFA)</span><NumericInput required min="0" max={correctionSubtotal} step="1" value={correctionDiscount} onChange={(event) => setCorrectionDiscount(event.target.value)} className="h-10 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3" /></label>
            <label className="block space-y-1 text-xs"><span>Motif de rectification</span><textarea required minLength={3} maxLength={1000} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} rows={3} className="w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] p-3" /></label>
            <div className="flex items-center justify-between border-t border-[#e8e5de] dark:border-[#2b342c] pt-3 text-sm"><span>Nouveau total</span><strong>{formatCurrency(correctionTotal)}</strong></div>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setCorrectionFor(null)} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-4 text-sm">Annuler</button><button type="submit" disabled={!correctionReason.trim() || Number(correctionDiscount) > correctionSubtotal || correctionTotal < correctionFor.paid} className="min-h-10 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white disabled:opacity-50">Créer la facture rectificative</button></div>
          </form>}
        </DialogContent>
      </Dialog>
      <PdfPreviewModal preview={invoicePdfPreview} onClose={closeInvoicePdf} />
    </>
  );
}

const bankPlaceholders: Record<string, string> = {
  orangeMoney: "+221 77 00 00 00 00",
  wave: "+221 70 00 00 00 00",
  bankName: "CBAO, SGBS, CIS…",
  accountHolder: "Nom figurant sur le compte",
  rib: "Clé RIB à 20 ou 23 chiffres",
  iban: "SN…",
  bic: "8 ou 11 caractères",
};

const paymentMethodToggles = [
  { key: "orangeMoneyEnabled", label: "Orange Money" },
  { key: "waveEnabled", label: "Wave" },
  { key: "bankEnabled", label: "Virement bancaire" },
  { key: "cashEnabled", label: "Espèces" },
  { key: "checkEnabled", label: "Chèque" },
];

function SettingsForm({
  kind,
  run,
  busy,
}: {
  kind: "company" | "documents";
  run: (action: () => Promise<unknown>, success?: string) => Promise<void>;
  busy: boolean;
}) {
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<Record<string, string | number | boolean>>(`/admin/settings/${kind}`)
      .then(setValues)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [kind]);
  const update = (key: string, value: string) =>
    setValues((current) => ({
      ...current,
      [key]: key === "quoteValidityDays" ? Number(value) : value,
    }));
  const fieldText = (key: string) => {
    const value = values[key];
    return typeof value === "string" || typeof value === "number" ? value : "";
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      const result = await api<Record<string, string | number | boolean>>(
        `/admin/settings/${kind}`,
        { method: "PUT", body: JSON.stringify(values) },
      );
      setValues(result);
    }, "Configuration enregistrée.");
  };
  const companyFields = [
    "name",
    "legalName",
    "description",
    "sector",
    "slogan",
    "rccm",
    "ninea",
    "otherId",
    "phone",
    "secondaryPhone",
    "email",
    "address",
    "city",
    "country",
    "website",
    "whatsapp",
    "manager",
    "managerRole",
  ];
  const documentFields = [
    "quotePrefix",
    "invoicePrefix",
    "quoteValidityDays",
    "currency",
    "paymentTerms",
    "generalTerms",
    "legalText",
    "extraNotes",
    "footer",
    "bankDetails",
  ];
  const bankFields = [
    "orangeMoney",
    "wave",
    "bankName",
    "accountHolder",
    "rib",
    "iban",
    "bic",
    "cashNote",
    "checkNote",
  ];
  const labels: Record<string, string> = {
    name: "Nom commercial",
    legalName: "Raison sociale",
    description: "Description courte",
    sector: "Secteur d'activité",
    slogan: "Slogan",
    rccm: "RCCM (facultatif)",
    ninea: "NINEA (facultatif)",
    otherId: "Autre identifiant",
    phone: "Téléphone",
    secondaryPhone: "Téléphone secondaire",
    email: "E-mail",
    address: "Adresse",
    city: "Ville",
    country: "Pays",
    website: "Site web",
    whatsapp: "WhatsApp",
    manager: "Responsable",
    managerRole: "Fonction",
    quotePrefix: "Préfixe des devis",
    invoicePrefix: "Préfixe des factures",
    quoteValidityDays: "Validité des devis (jours)",
    currency: "Devise",
    paymentTerms: "Conditions de paiement",
    generalTerms: "Conditions générales",
    legalText: "Texte légal",
    extraNotes: "Mentions supplémentaires",
    footer: "Pied de page",
    bankDetails: "Mention libre de paiement",
    orangeMoney: "Numéro Orange Money",
    wave: "Numéro Wave",
    bankName: "Nom de la banque",
    accountHolder: "Nom du titulaire du compte",
    rib: "RIB",
    iban: "IBAN (facultatif)",
    bic: "Code BIC/SWIFT (facultatif)",
    cashNote: "Texte affiché pour les espèces (facultatif)",
    checkNote: "Texte affiché pour les chèques (facultatif)",
  };
  const fileUpload = async (field: string, file?: File) => {
    if (!file) return;
    await run(async () => {
      const form = new FormData();
      form.append("file", file);
      const result = await api<{ filename: string }>("/admin/media", {
        method: "POST",
        body: form,
      });
      const next = { ...values, [field]: result.filename, ...(field === "signatureStamp" ? { signature: "", stamp: "" } : {}) };
      await api("/admin/settings/company", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setValues(next);
    }, `${labels[field]} enregistré.`);
  };
  const removeVisual = async (field: "logo" | "signatureStamp") => {
    await run(async () => {
      const company = await api<Record<string, string | number | boolean>>("/admin/settings/company");
      const next = {
        ...company,
        [field]: "",
        ...(field === "signatureStamp" ? { signature: "", stamp: "" } : {}),
      };
      await api("/admin/settings/company", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setValues((current) => ({
        ...current,
        [field]: "",
        ...(field === "signatureStamp" ? { signature: "", stamp: "" } : {}),
      }));
    }, `${labels[field]} retiré.`);
  };
  if (loading)
    return (
      <p className="py-12 text-sm text-[#72766e] dark:text-[#aab3a8]">
        Chargement de la configuration…
      </p>
    );
  const fields = kind === "company" ? companyFields : documentFields;
  return (
    <>
      <PageTitle
        eyebrow="CONFIGURATION"
        title={kind === "company" ? "Entreprise" : "Documents commerciaux"}
        note={
          kind === "company"
            ? "Ces coordonnées officielles alimentent les nouveaux documents et leur identité visuelle."
            : "Numérotation, conditions et mentions imprimées sur les documents."
        }
      />
      <form onSubmit={save} autoComplete="off" className="space-y-5">
        <section className="border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-5 sm:p-7">
          <div className="mb-5 border-b border-[#efede7] dark:border-[#262e27] pb-4">
            <h3 className="text-sm font-semibold">
              {kind === "company"
                ? "Identité de l'entreprise"
                : "Numérotation et conditions"}
            </h3>
            <p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">
              Les données sont validées et conservées dans la base locale
              sécurisée.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div
                key={field}
                className={
                  field === "description" ||
                  [
                    "generalTerms",
                    "legalText",
                    "extraNotes",
                    "footer",
                    "bankDetails",
                    "paymentTerms",
                  ].includes(field)
                    ? "sm:col-span-2"
                    : ""
                }
              >
                <Field
                  label={field === "whatsapp" ? "WhatsApp (demandes de devis et messages du site)" : labels[field]}
                  value={fieldText(field)}
                  onChange={(value) => update(field, value)}
                  type={
                    field === "email"
                      ? "email"
                      : field === "whatsapp"
                        ? "tel"
                      : field === "quoteValidityDays"
                        ? "number"
                        : "text"
                  }
                  placeholder={field === "whatsapp" ? "+221 76 932 19 02" : undefined}
                  multiline={[
                    "description",
                    "generalTerms",
                    "legalText",
                    "extraNotes",
                    "footer",
                    "bankDetails",
                    "paymentTerms",
                  ].includes(field)}
                />
                {field === "whatsapp" && <p className="mt-1.5 text-xs text-[#85877f] dark:text-[#96a094]">Ce numéro reçoit les messages envoyés depuis le bouton WhatsApp du site et les demandes de devis.</p>}
              </div>
            ))}
          </div>
        </section>
        {kind === "documents" && (
          <section className="border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-5 sm:p-7">
            <div className="mb-5 border-b border-[#efede7] dark:border-[#262e27] pb-4">
              <h3 className="text-sm font-semibold">Signatures sur les documents</h3>
              <p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">
                Chaque espace de signature est facultatif.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={values.showClientSignature !== false}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      showClientSignature: event.target.checked,
                    }))
                  }
                />
                <span className="text-sm">
                  Afficher l’espace « Bon pour accord »
                  <span className="mt-0.5 block text-xs text-[#85877f] dark:text-[#96a094]">
                    Réservé au client, sur les devis uniquement.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={values.showSignature !== false}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      showSignature: event.target.checked,
                    }))
                  }
                />
                <span className="text-sm">
                  Afficher la photo de la signature
                  <span className="mt-0.5 block text-xs text-[#85877f] dark:text-[#96a094]">
                    Elle est centrée sous « Signature de l’entreprise ».
                  </span>
                </span>
              </label>
            </div>
          </section>
        )}
        {kind === "documents" && (
          <section className="border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-5 sm:p-7">
            <div className="mb-5 border-b border-[#efede7] dark:border-[#262e27] pb-4">
              <h3 className="text-sm font-semibold">Moyens de paiement acceptés</h3>
              <p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">
                Activés et renseignés, ils sont imprimés à l’identique sur les devis et les factures. Un moyen désactivé ou vide n’apparaît jamais.
              </p>
            </div>
            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              {paymentMethodToggles.map((method) => (
                <label
                  key={method.key}
                  className="flex cursor-pointer items-center gap-3 border border-[#efede7] dark:border-[#262e27] px-4 py-3 text-sm hover:bg-[#f7f6f2] hover:dark:bg-[#1e261f]"
                >
                  <input
                    type="checkbox"
                    checked={values[method.key] !== false}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [method.key]: event.target.checked }))
                    }
                  />
                  {method.label}
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {bankFields.map((field) => (
                <div key={field}>
                  <Field
                    label={labels[field]}
                    value={fieldText(field)}
                    placeholder={bankPlaceholders[field]}
                    autocomplete="off"
                    onChange={(value) => update(field, value)}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
        {kind === "company" && (
          <section className="border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-5 sm:p-7">
            <div className="mb-5">
              <h3 className="text-sm font-semibold">Identité visuelle</h3>
              <p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">
                La signature et le cachet sont fournis ensemble dans une seule image utilisée sur les PDF.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {(
                [
                  ["logo", "Logo principal"],
                  ["signatureStamp", "Signature et cachet"],
                ] as const
              ).map(([field, label]) => (
                <div key={field} className="border border-[#e8e5de] dark:border-[#2b342c] p-4">
                  <p className="mb-3 text-xs font-semibold">{label}</p>
                  {values[field] ? (
                    <img
                      src={apiUrl(`/media/${encodeURIComponent(values[field])}`)}
                      alt={label}
                      className="mb-3 h-24 w-full object-contain"
                    />
                  ) : (
                    <div className="mb-3 grid h-24 place-items-center bg-[#f6f5f1] dark:bg-[#1e261f] text-xs text-[#85877f] dark:text-[#96a094]">
                      Aucun visuel
                    </div>
                  )}
                  <label className="flex cursor-pointer items-center justify-center gap-2 border border-[#dedbd3] dark:border-[#333d34] px-3 py-2 text-xs hover:bg-[#f7f6f2] hover:dark:bg-[#1e261f]">
                    <Upload size={14} />
                    Remplacer
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) =>
                        fileUpload(field, event.target.files?.[0])
                      }
                    />
                  </label>
                  {values[field] && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeVisual(field)}
                      className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 border border-[#ead6d1] dark:border-[#4a332f] px-3 py-2 text-xs font-medium text-[#8a4d43] hover:bg-[#fdf5f2] hover:dark:bg-[#2b1f1d] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X size={14} />
                      Retirer le visuel
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
        <button
          disabled={busy}
          className="bg-[#293b32] dark:bg-[#2f4438] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Enregistrer la configuration
        </button>
      </form>
    </>
  );
}

function slugifyPricingKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function Pricing({
  run,
}: {
  run: (action: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const confirm = useConfirm();
  const mandatoryPricingKeys = ["plafond_platre"];
  const [items, setItems] = useState<
    Array<{
      key: string;
      name: string;
      unit: string;
      rate: number;
      calculation: string;
      active: number;
    }>
  >([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [zones, setZones] = useState<Array<{ id: number; name: string; rate: number; active: number }>>([]);
  const [zoneDraft, setZoneDraft] = useState({ name: "", rate: "" });
  const [expandedPricingKey, setExpandedPricingKey] = useState<string | null>(null);
  const [editingPricingKey, setEditingPricingKey] = useState<string | null>(null);
  const [pricingEditDraft, setPricingEditDraft] = useState<{
    name: string;
    unit: string;
    rate: string;
    calculation: string;
    active: boolean;
  } | null>(null);
  const [draft, setDraft] = useState<{
    name: string;
    key: string;
    keyTouched: boolean;
    unit: string;
    rate: string;
    calculation: string;
    active: boolean;
  }>({
    name: "",
    key: "",
    keyTouched: false,
    unit: "m²",
    rate: "",
    calculation: "area",
    active: true,
  });
  const load = useCallback(
    () =>
      Promise.all([
        api<typeof items>("/admin/pricing")
          .then(setItems)
          .catch(() => setItems([])),
        api<typeof zones>("/admin/transport-zones")
          .then(setZones)
          .catch(() => setZones([])),
      ]).then(() => undefined),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  const beginCreate = () => {
    setDraft({
      name: "",
      key: "",
      keyTouched: false,
      unit: "m²",
      rate: "",
      calculation: "area",
      active: true,
    });
    setCreateOpen(true);
  };
  const keyValid = /^[a-z0-9_-]{2,80}$/.test(draft.key);
  const keyTaken = keyValid && items.some((item) => item.key === draft.key);
  const createRate = async (event: FormEvent) => {
    event.preventDefault();
    if (!keyValid || keyTaken) return;
    await run(async () => {
      await api(`/admin/pricing/${draft.key}`, {
        method: "PUT",
        body: JSON.stringify({
          name: draft.name,
          unit: draft.unit,
          rate: Number(draft.rate || 0),
          calculation: draft.calculation,
          active: draft.active,
        }),
      });
      setCreateOpen(false);
      await load();
    }, "Tarif créé.");
  };
  const deleteRate = async (item: (typeof items)[number]) => {
    if (!(await confirm({
      title: `Supprimer le tarif « ${item.name} » ?`,
      message: "Il ne sera plus proposé dans le calculateur. Cette action est définitive.",
      confirmLabel: "Supprimer",
      destructive: true,
    }))) return;
    await run(async () => {
      await api(`/admin/pricing/${item.key}`, { method: "DELETE" });
      await load();
    }, "Tarif supprimé.");
  };
  const beginEditRate = (item: (typeof items)[number]) => {
    setEditingPricingKey(item.key);
    setPricingEditDraft({
      name: item.name,
      unit: item.unit,
      rate: String(item.rate),
      calculation: item.calculation,
      active: Boolean(item.active),
    });
  };
  const saveEditRate = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingPricingKey || !pricingEditDraft) return;
    await run(async () => {
      await api(`/admin/pricing/${editingPricingKey}`, {
        method: "PUT",
        body: JSON.stringify({
          ...pricingEditDraft,
          rate: Number(pricingEditDraft.rate),
          active: Boolean(pricingEditDraft.active),
        }),
      });
      setEditingPricingKey(null);
      setPricingEditDraft(null);
      await load();
    }, "Tarif mis à jour.");
  };
  const createZone = async (event: FormEvent) => {
    event.preventDefault();
    if (zoneDraft.name.trim().length < 2) {
      toast.error("Renseignez le nom de la zone de déplacement.");
      return;
    }
    if (zoneDraft.rate === "" || !(Number(zoneDraft.rate) >= 0)) {
      toast.error("Renseignez le prix du déplacement pour cette zone.");
      return;
    }
    await run(async () => {
      await api("/admin/transport-zones", {
        method: "POST",
        body: JSON.stringify({ name: zoneDraft.name, rate: Number(zoneDraft.rate), active: true }),
      });
      setZoneDraft({ name: "", rate: "" });
      await load();
    }, "Zone de déplacement ajoutée.");
  };
  const saveZone = (zone: (typeof zones)[number]) =>
    run(async () => {
      if (zone.name.trim().length < 2) throw new Error("Renseignez le nom de la zone de déplacement.");
      await api(`/admin/transport-zones/${zone.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: zone.name, rate: Number(zone.rate), active: Boolean(zone.active) }),
      });
      await load();
    }, "Zone de déplacement mise à jour.");
  const deleteZone = async (zone: (typeof zones)[number]) => {
    if (!(await confirm({
      title: `Supprimer la zone « ${zone.name} » ?`,
      message: "Son prix ne sera plus proposé dans le calculateur administrateur. Les devis déjà établis conservent leur montant.",
      confirmLabel: "Supprimer",
      destructive: true,
    }))) return;
    await run(async () => {
      await api(`/admin/transport-zones/${zone.id}`, { method: "DELETE" });
      await load();
    }, "Zone de déplacement supprimée.");
  };
  const inputClass =
    "mt-1.5 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 py-2.5 text-sm outline-none focus:border-[#a97850]";
  const renderPricingItem = (item: (typeof items)[number]) => (
    <div key={item.key}>
      <article className="overflow-hidden border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] sm:hidden">
        <button
          type="button"
          aria-expanded={expandedPricingKey === item.key}
          aria-controls={`pricing-details-${item.key}`}
          onClick={() => setExpandedPricingKey((current) => current === item.key ? null : item.key)}
          className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[#293b32] dark:text-[#e9ece6]">{item.name}</span>
            <span className="mt-1 block text-xs text-[#687068] dark:text-[#b3bcb2]">{formatCurrency(item.rate)} / {item.unit}</span>
          </span>
          <span className={`shrink-0 border px-2 py-1 text-[10px] ${item.active ? "border-[#cfe0d1] bg-[#edf5ed] text-[#42684a] dark:border-[#3a5840] dark:bg-[#203126] dark:text-[#a7d6ae]" : "border-[#dedbd3] bg-[#f3f1ec] text-[#777a72] dark:border-[#333d34] dark:bg-[#242a24] dark:text-[#aab3a8]"}`}>
            {item.active ? "Actif" : "Inactif"}
          </span>
          <ChevronDown size={16} className={`shrink-0 text-[#687068] transition-transform ${expandedPricingKey === item.key ? "rotate-180" : ""}`} />
        </button>
        {expandedPricingKey === item.key && (
          <div id={`pricing-details-${item.key}`} className="space-y-3 border-t border-[#e8e5de] dark:border-[#2b342c] px-4 py-3">
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div><dt className="text-[#85877f] dark:text-[#96a094]">Mode de calcul</dt><dd className="mt-1 font-medium">{item.calculation === "area" ? "Surface" : item.calculation === "linear" ? "Linéaire" : "Forfait"}</dd></div>
              <div><dt className="text-[#85877f] dark:text-[#96a094]">Identifiant</dt><dd className="mt-1 break-all font-medium">{item.key}</dd></div>
              <div><dt className="text-[#85877f] dark:text-[#96a094]">Prix unitaire</dt><dd className="mt-1 font-medium">{formatCurrency(item.rate)} / {item.unit}</dd></div>
            </dl>
            <div className="flex items-center justify-between border-t border-[#efede7] dark:border-[#262e27] pt-3">
              <button type="button" onClick={() => beginEditRate(item)} aria-label={`Modifier ${item.name}`} className="inline-flex min-h-10 items-center gap-2 px-2 text-sm font-semibold text-[#526b57] dark:text-[#9ecfa9]">
                <Pencil size={15} /> Modifier
              </button>
              {mandatoryPricingKeys.includes(item.key)
                ? <span className="text-xs text-[#85877f] dark:text-[#96a094]">Indispensable</span>
                : <button type="button" onClick={() => void deleteRate(item)} className="inline-flex min-h-10 items-center gap-2 px-2 text-xs text-[#8a4d43] dark:text-[#e08b7d]"><Trash2 size={14} /> Supprimer</button>}
            </div>
          </div>
        )}
      </article>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          run(async () => {
            await api(`/admin/pricing/${item.key}`, {
              method: "PUT",
              body: JSON.stringify({
                ...item,
                rate: Number(item.rate),
                active: Boolean(item.active),
              }),
            });
            await load();
          }, "Tarif mis à jour.");
        }}
        className="hidden gap-3 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-4 sm:grid sm:grid-cols-[minmax(180px,1fr)_110px_150px_120px_auto_auto] sm:items-end"
      >
        <Field
          label="Prestation"
          value={item.name}
          onChange={(name) =>
            setItems((rows) =>
              rows.map((row) =>
                row.key === item.key ? { ...row, name } : row,
              ),
            )
          }
        />
        <Field
          label={`Prix (${item.unit})`}
          type="number"
          value={item.rate}
          onChange={(value) =>
            setItems((rows) =>
              rows.map((row) =>
                row.key === item.key
                  ? { ...row, rate: Number(value) }
                  : row,
              ),
            )
          }
        />
        <label className="text-sm font-medium text-[#49524c] dark:text-[#ccd3cb]">
          Calcul
          <select
            value={item.calculation}
            onChange={(event) =>
              setItems((rows) =>
                rows.map((row) =>
                  row.key === item.key
                    ? { ...row, calculation: event.target.value }
                    : row,
                ),
              )
            }
            className="mt-1.5 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 py-2.5 text-sm"
          >
            <option value="area">Surface</option>
            <option value="linear">Linéaire</option>
            <option value="fixed">Forfait</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pb-3 text-sm">
          <input
            type="checkbox"
            checked={Boolean(item.active)}
            onChange={(event) =>
              setItems((rows) =>
                rows.map((row) =>
                  row.key === item.key
                    ? { ...row, active: Number(event.target.checked) }
                    : row,
                ),
              )
            }
          />
          Actif
        </label>
        <button className="h-10 bg-[#293b32] dark:bg-[#2f4438] px-4 text-xs font-semibold text-white">
          Enregistrer
        </button>
        {mandatoryPricingKeys.includes(item.key) ? (
          <button
            type="button"
            disabled
            title="Ce tarif est indispensable au calcul des devis."
            className="h-10 cursor-not-allowed border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs text-[#85877f] dark:text-[#96a094]"
          >
            Indispensable
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void deleteRate(item)}
            className="h-10 border border-[#ead6d1] dark:border-[#4a332f] px-3 text-xs text-[#8a4d43] dark:text-[#e08b7d]"
          >
            Supprimer
          </button>
        )}
      </form>
    </div>
  );
  const pricingItems = items.filter((item) => item.key !== "transport");
  const transportItem = items.find((item) => item.key === "transport");
  const pricingGroups = [
    {
      calculation: "area",
      title: "Tarifs au m²",
      description: "Les tarifs actifs au m², sauf la main-d’œuvre et les matériaux, apparaissent dans la liste des types de plafond.",
    },
    {
      calculation: "linear",
      title: "Prestations au mètre linéaire",
      description: "Ces prestations sont proposées comme options dans le calculateur.",
    },
    {
      calculation: "fixed",
      title: "Prestations au forfait",
      description: "Ces prestations sont proposées comme options dans le calculateur.",
    },
  ];
  return (
    <>
      <PageTitle
        eyebrow="CALCULATEUR"
        title="Tarifs professionnels"
        note="Les prix sont stockés dans la base et utilisés exclusivement côté serveur pour chaque estimation."
        action={
          <button
            type="button"
            onClick={beginCreate}
            className="inline-flex min-h-11 items-center gap-2 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white hover:bg-[#354b3f] hover:dark:bg-[#3d5648]"
          >
            <Plus size={16} />
            Créer un tarif
          </button>
        }
      />
      <div className="space-y-3">
        {pricingItems.length === 0 && !transportItem && (
          <p className="border border-dashed border-[#d8d5cc] dark:border-[#3a443b] px-5 py-12 text-center text-sm text-[#85877f] dark:text-[#96a094]">
            Aucun tarif. Utilisez « Créer un tarif » pour ajouter votre
            première prestation facturée.
          </p>
        )}
        {pricingGroups.map((group) => {
          const groupItems = pricingItems.filter((item) => item.calculation === group.calculation);
          if (!groupItems.length) return null;
          return (
            <section key={group.calculation} className="space-y-3">
              <div>
                <h3 className="font-heading text-lg font-semibold text-[#293b32] dark:text-[#e9ece6]">{group.title}</h3>
                <p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">{group.description}</p>
              </div>
              <div className="space-y-3">{groupItems.map(renderPricingItem)}</div>
            </section>
          );
        })}
      </div>
      <p className="mt-5 text-xs leading-5 text-[#85877f] dark:text-[#96a094]">
        Les tarifs installés sont des valeurs initiales indicatives.
        Confirmez-les avant ouverture du calculateur public.
      </p>

      <section className="mt-8 space-y-4 border-t border-[#e8e5de] dark:border-[#2b342c] pt-6">
        <div>
          <h3 className="font-heading text-xl font-semibold text-[#293b32] dark:text-[#e9ece6]">
            Déplacement et transport
          </h3>
          <p className="mt-1 text-xs leading-5 text-[#85877f] dark:text-[#96a094]">
            Fixez le forfait de déplacement pour chaque zone (ex. Thiès, Mbour,
            Saint-Louis). Ces prix sont proposés dans le calculateur de devis
            administrateur, qui peut aussi saisir un prix personnalisé. Le
            calculateur public conserve « à discuter ».
          </p>
        </div>
        {transportItem && renderPricingItem(transportItem)}
        <form
          onSubmit={createZone}
          className="grid gap-3 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-4 sm:grid-cols-[minmax(180px,1fr)_170px_auto] sm:items-end"
        >
          <Field
            label="Nom de la zone"
            value={zoneDraft.name}
            onChange={(name) => setZoneDraft((current) => ({ ...current, name }))}
            placeholder="Ex. Thiès"
          />
          <Field
            label="Prix du déplacement (FCFA)"
            type="number"
            value={zoneDraft.rate}
            onChange={(rate) => setZoneDraft((current) => ({ ...current, rate }))}
          />
          <button className="h-10 bg-[#293b32] dark:bg-[#2f4438] px-4 text-xs font-semibold text-white">
            Ajouter la zone
          </button>
        </form>
        <div className="space-y-3">
          {zones.map((zone) => (
            <form
              key={zone.id}
              onSubmit={(event) => {
                event.preventDefault();
                void saveZone(zone);
              }}
              className="grid gap-3 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-4 sm:grid-cols-[minmax(180px,1fr)_170px_auto_auto] sm:items-end"
            >
              <Field
                label="Zone"
                value={zone.name}
                onChange={(name) =>
                  setZones((rows) => rows.map((row) => (row.id === zone.id ? { ...row, name } : row)))
                }
              />
              <Field
                label="Prix (FCFA)"
                type="number"
                value={zone.rate}
                onChange={(rate) =>
                  setZones((rows) => rows.map((row) => (row.id === zone.id ? { ...row, rate: Number(rate) } : row)))
                }
              />
              <button className="h-10 bg-[#293b32] dark:bg-[#2f4438] px-4 text-xs font-semibold text-white">
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => void deleteZone(zone)}
                className="h-10 border border-[#ead6d1] dark:border-[#4a332f] px-3 text-xs text-[#8a4d43] dark:text-[#e08b7d]"
              >
                Supprimer
              </button>
            </form>
          ))}
          {zones.length === 0 && (
            <p className="border border-dashed border-[#d8d5cc] dark:border-[#3a443b] px-5 py-8 text-center text-sm text-[#85877f] dark:text-[#96a094]">
              Aucune zone hors Dakar. Ajoutez une zone ci-dessus : son prix sera
              proposé dans le calculateur de devis administrateur.
            </p>
          )}
        </div>
      </section>

      <Dialog
        open={editingPricingKey !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingPricingKey(null);
            setPricingEditDraft(null);
          }
        }}
      >
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-xl overflow-y-auto border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0">
          <DialogHeader className="border-b border-[#e8e5de] dark:border-[#2b342c] px-5 py-5 pr-14 sm:px-7">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">TARIFICATION</p>
            <DialogTitle className="font-heading text-2xl">Modifier la prestation</DialogTitle>
            <DialogDescription>Modifiez les détails, puis enregistrez pour mettre à jour les calculateurs.</DialogDescription>
          </DialogHeader>
          {pricingEditDraft && (
            <form onSubmit={saveEditRate} className="space-y-4 px-5 py-5 sm:px-7">
              <label className="block text-sm font-medium">
                Prestation
                <input required maxLength={120} className={inputClass} value={pricingEditDraft.name} onChange={(event) => setPricingEditDraft({ ...pricingEditDraft, name: event.target.value })} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  Unité
                  <select className={inputClass} value={pricingEditDraft.unit} onChange={(event) => setPricingEditDraft({ ...pricingEditDraft, unit: event.target.value })}>
                    <option value="m²">m²</option>
                    <option value="ml">Mètre linéaire</option>
                    <option value="forfait">Forfait</option>
                    <option value="unité">Unité</option>
                    <option value="heure">Heure</option>
                  </select>
                </label>
                <label className="text-sm font-medium">
                  Prix (FCFA)
                  <NumericInput required min="0" max="100000000" step="100" className={inputClass} value={pricingEditDraft.rate} onChange={(event) => setPricingEditDraft({ ...pricingEditDraft, rate: event.target.value })} />
                </label>
                <label className="text-sm font-medium">
                  Mode de calcul
                  <select className={inputClass} value={pricingEditDraft.calculation} onChange={(event) => setPricingEditDraft({ ...pricingEditDraft, calculation: event.target.value })}>
                    <option value="area">Surface (m²)</option>
                    <option value="linear">Linéaire (ml)</option>
                    <option value="fixed">Forfait</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 pt-6 text-sm">
                  <input type="checkbox" checked={pricingEditDraft.active} onChange={(event) => setPricingEditDraft({ ...pricingEditDraft, active: event.target.checked })} />
                  Disponible dans les calculateurs
                </label>
              </div>
              <p className="border-t border-[#e8e5de] dark:border-[#2b342c] pt-3 text-xs text-[#85877f] dark:text-[#96a094]">Identifiant : {editingPricingKey}</p>
              <div className="flex justify-end gap-2 border-t border-[#e8e5de] dark:border-[#2b342c] pt-4">
                <button type="button" onClick={() => { setEditingPricingKey(null); setPricingEditDraft(null); }} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-4 text-sm">Annuler</button>
                <button disabled={!pricingEditDraft.name.trim() || pricingEditDraft.rate === "" || Number(pricingEditDraft.rate) < 0} className="min-h-10 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white disabled:opacity-50">Enregistrer</button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-xl overflow-y-auto border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0">
          <DialogHeader className="border-b border-[#e8e5de] dark:border-[#2b342c] px-5 py-5 pr-14 sm:px-7">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">
              TARIFICATION
            </p>
            <DialogTitle className="font-heading text-2xl">
              Nouveau tarif professionnel
            </DialogTitle>
            <DialogDescription>
              Le tarif est utilisé immédiatement par les calculateurs
              administrateur et public, côté serveur.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createRate} className="space-y-4 px-5 py-5 sm:px-7">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Prestation
                <input
                  required
                  maxLength={120}
                  className={inputClass}
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                      key: current.keyTouched
                        ? current.key
                        : slugifyPricingKey(event.target.value),
                    }))
                  }
                  placeholder="Ex.Corniche décorative"
                />
              </label>
              <label className="text-sm font-medium">
                Identifiant technique
                <input
                  required
                  pattern="[a-z0-9_-]{2,80}"
                  className={inputClass}
                  value={draft.key}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      key: event.target.value,
                      keyTouched: true,
                    }))
                  }
                />
              </label>
              <label className="text-sm font-medium">
                Unité
                <select
                  className={inputClass}
                  value={draft.unit}
                  onChange={(event) =>
                    setDraft({ ...draft, unit: event.target.value })
                  }
                >
                  <option value="m²">m²</option>
                  <option value="ml">Mètre linéaire</option>
                  <option value="forfait">Forfait</option>
                  <option value="unité">Unité</option>
                  <option value="heure">Heure</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Prix (FCFA)
                <NumericInput
                  required
                  min="0"
                  max="100000000"
                  step="100"
                  className={inputClass}
                  value={draft.rate}
                  onFocus={(event) => {
                    if (event.currentTarget.value === "0") event.currentTarget.select();
                  }}
                  onChange={(event) => setDraft({ ...draft, rate: event.target.value })}
                />
              </label>
              <label className="text-sm font-medium">
                Mode de calcul
                <select
                  className={inputClass}
                  value={draft.calculation}
                  onChange={(event) =>
                    setDraft({ ...draft, calculation: event.target.value })
                  }
                >
                  <option value="area">Surface (m²)</option>
                  <option value="linear">Linéaire (ml)</option>
                  <option value="fixed">Forfait</option>
                </select>
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(event) =>
                    setDraft({ ...draft, active: event.target.checked })
                  }
                />
                Disponible dans les calculateurs
              </label>
            </div>
            {!keyValid && draft.key !== "" && (
              <p role="alert" className="text-xs text-[#8a4d43] dark:text-[#e08b7d]">
                Identifiant invalide : minuscules, chiffres, tirets ou
                underscores, 2 à 80 caractères.
              </p>
            )}
            {keyTaken && (
              <p role="alert" className="text-xs text-[#8a4d43] dark:text-[#e08b7d]">
                Cet identifiant existe déjà : la création écrasera le tarif «{" "}
                {items.find((item) => item.key === draft.key)?.name} ».
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-[#e8e5de] dark:border-[#2b342c] pt-4">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-4 text-sm"
              >
                Annuler
              </button>
              <button
                disabled={!draft.name.trim() || !keyValid || keyTaken}
                className="min-h-10 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                Créer le tarif
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

type SupplementalServiceAdmin = {
  id: number; name: string; description: string; photoAssetId: number | null; photoFilename: string;
  price: number; unit: string; pricingType: "fixed" | "area" | "unit" | "quantity_unit";
  active: boolean; sortOrder: number;
};
type SupplementalServiceDraft = Omit<SupplementalServiceAdmin, "id" | "photoFilename">;
const emptySupplementalService: SupplementalServiceDraft = {
  name: "", description: "", photoAssetId: null, price: 0, unit: "forfait",
  pricingType: "fixed", active: true, sortOrder: 0,
};

function SupplementalServices({ run }: {
  run: (action: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const [items, setItems] = useState<SupplementalServiceAdmin[]>([]);
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<SupplementalServiceDraft>(emptySupplementalService);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setItems(await api<SupplementalServiceAdmin[]>("/admin/supplemental-services")); }
    catch { setItems([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const beginCreate = () => { setEditingId(null); setDraft(emptySupplementalService); setEditorOpen(true); };
  const beginEdit = (item: SupplementalServiceAdmin) => {
    setEditingId(item.id);
    setDraft({
      name: item.name, description: item.description, photoAssetId: item.photoAssetId,
      price: item.price, unit: item.unit, pricingType: item.pricingType,
      active: item.active, sortOrder: item.sortOrder,
    });
    setEditorOpen(true);
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      await api(editingId ? "/admin/supplemental-services/" + editingId : "/admin/supplemental-services", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify({ ...draft, price: Number(draft.price), sortOrder: Number(draft.sortOrder) }),
      });
      setEditorOpen(false);
      await refresh();
    }, editingId ? "Prestation mise à jour." : "Prestation créée.");
  };
  const uploadPhoto = async (file?: File) => {
    if (!file) return;
    await run(async () => {
      const form = new FormData();
      form.append("file", file);
      const uploaded = await api<{ id: number }>("/admin/media", { method: "POST", body: form });
      setDraft((current) => ({ ...current, photoAssetId: uploaded.id }));
    }, "Photo téléversée.");
  };
  const setActive = (item: SupplementalServiceAdmin, active: boolean) => run(async () => {
    const { id: _id, photoFilename: _photo, ...values } = item;
    await api("/admin/supplemental-services/" + item.id, {
      method: "PUT", body: JSON.stringify({ ...values, active }),
    });
    await refresh();
  }, active ? "Prestation activée." : "Prestation désactivée.");
  const remove = async (item: SupplementalServiceAdmin) => {
    if (!(await confirm({ title: `Supprimer la prestation « ${item.name} » ?`, message: "Elle disparaîtra du calculateur public et ne sera plus proposée aux visiteurs.", confirmLabel: "Supprimer", destructive: true }))) return;
    await run(async () => {
      await api("/admin/supplemental-services/" + item.id, { method: "DELETE" });
      await refresh();
    }, "Prestation supprimée.");
  };
  const inputClass = "mt-1.5 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 py-2.5 text-sm outline-none focus:border-[#a97850]";

  return <>
    <PageTitle eyebrow="CALCULATEUR PUBLIC" title="Prestations supplémentaires" note="Choisissez les prestations et les tarifs qui apparaissent dans le calculateur public."
      action={<button type="button" onClick={beginCreate} className="inline-flex min-h-11 items-center gap-2 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white hover:bg-[#354b3f] hover:dark:bg-[#3d5648]"><Plus size={16} />Ajouter une prestation</button>} />
    {loading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((id) => <div key={id} className="h-40 animate-pulse border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c]" />)}</div>
      : items.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => <article key={item.id} className="border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c]">
          {item.photoFilename && <img src={apiUrl(`/media/${encodeURIComponent(item.photoFilename)}`)} alt="" className="h-36 w-full object-cover" />}
          <div className="p-4">
            <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{item.name}</h3><p className="mt-1 text-xs text-[#72766e] dark:text-[#aab3a8]">{item.description || "Sans description."}</p></div><span className={"shrink-0 border px-2 py-1 text-[10px] " + (item.active ? "border-[#cdded0] dark:border-[#31503a] bg-[#eef5ef] dark:bg-[#1f2c22] text-[#3f6948] dark:text-[#8fc79d]" : "border-[#dedbd3] dark:border-[#333d34] bg-[#f5f4f0] dark:bg-[#121713] text-[#72766e] dark:text-[#aab3a8]")}>{item.active ? "Active" : "Inactive"}</span></div>
            <p className="mt-4 text-sm font-semibold">{formatCurrency(item.price)} <span className="font-normal text-[#72766e] dark:text-[#aab3a8]">{item.pricingType === "fixed" ? "forfait" : item.pricingType === "area" ? "/ m²" : "/ " + item.unit}</span></p>
            <p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">Ordre d’affichage : {item.sortOrder}</p>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-[#efede7] dark:border-[#262e27] pt-3">
              <button type="button" onClick={() => beginEdit(item)} className="min-h-9 border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs">Modifier</button>
              <button type="button" onClick={() => void setActive(item, !item.active)} className="min-h-9 border border-[#dedbd3] dark:border-[#333d34] px-3 text-xs">{item.active ? "Désactiver" : "Activer"}</button>
              <button type="button" onClick={() => void remove(item)} className="ml-auto min-h-9 border border-[#ead6d1] dark:border-[#4a332f] px-3 text-xs text-[#8a4d43] dark:text-[#e08b7d]">Supprimer</button>
            </div>
          </div>
        </article>)}
      </div> : <div className="border border-dashed border-[#d8d5cc] dark:border-[#3a443b] bg-white dark:bg-[#1b221c] px-5 py-14 text-center"><Package size={26} className="mx-auto text-[#9a7a5b] dark:text-[#c9a97e]" /><p className="mt-3 text-sm font-semibold">Aucune prestation supplémentaire</p><p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">Ajoutez des prestations pour les proposer dans le calculateur public.</p></div>}

    <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0">
        <DialogHeader className="border-b border-[#e8e5de] dark:border-[#2b342c] px-5 py-5 pr-14 sm:px-7"><p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">TARIFICATION</p><DialogTitle className="font-heading text-2xl">{editingId ? "Modifier la prestation" : "Nouvelle prestation"}</DialogTitle><DialogDescription>Les prestations actives apparaissent au calculateur; le serveur recalcule leur prix.</DialogDescription></DialogHeader>
        <form onSubmit={save} className="space-y-4 px-5 py-5 sm:px-7">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">Nom<input required maxLength={160} className={inputClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label className="text-sm font-medium">Prix<NumericInput required min="0" max="1000000000" className={inputClass} value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} /></label>
            <label className="text-sm font-medium">Unité<select className={inputClass} value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })}><option value="forfait">Forfait</option><option value="m²">m²</option><option value="unité">Unité</option><option value="ml">Mètre linéaire</option><option value="heure">Heure</option></select></label>
            <label className="text-sm font-medium">Mode de calcul<select className={inputClass} value={draft.pricingType} onChange={(event) => setDraft({ ...draft, pricingType: event.target.value as SupplementalServiceAdmin["pricingType"] })}><option value="fixed">Forfait</option><option value="area">Surface (m²)</option><option value="unit">À l’unité</option><option value="quantity_unit">Quantité × prix unitaire</option></select></label>
            <label className="text-sm font-medium">Ordre d’affichage<NumericInput className={inputClass} value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /></label>
            <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />Afficher dans le calculateur public</label>
          </div>
          <label className="block text-sm font-medium">Description<textarea maxLength={1500} rows={3} className={inputClass} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <div className="flex flex-wrap items-center gap-3">{draft.photoAssetId && <p className="text-xs text-[#72766e] dark:text-[#aab3a8]">Photo sélectionnée #{draft.photoAssetId}</p>}<label className="inline-flex min-h-10 cursor-pointer items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 text-xs"><Upload size={14} />{draft.photoAssetId ? "Remplacer la photo" : "Ajouter une photo"}<input type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="sr-only" onChange={(event) => void uploadPhoto(event.target.files?.[0])} /></label>{draft.photoAssetId && <button type="button" onClick={() => setDraft({ ...draft, photoAssetId: null })} className="text-xs text-[#8a4d43] dark:text-[#e08b7d]">Retirer la photo</button>}</div>
          <div className="flex justify-end gap-2 border-t border-[#e8e5de] dark:border-[#2b342c] pt-4"><button type="button" onClick={() => setEditorOpen(false)} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-4 text-sm">Annuler</button><button className="min-h-10 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white">{editingId ? "Enregistrer" : "Créer la prestation"}</button></div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}

function MediaLibrary({ run }: { run: (action: () => Promise<unknown>, success?: string) => Promise<void> }) {
  return (
    <div>
      <PageTitle
        eyebrow="CONTENU DU SITE"
        title="Médias du site"
        note="Gérez les slides du Hero et les réalisations publiées sur le site."
      />
      <MediaContentManager run={run} />
    </div>
  );
}

export default Admin;
