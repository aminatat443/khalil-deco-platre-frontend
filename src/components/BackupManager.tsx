import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Download,
  HardDrive,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";
import { api, apiUrl } from "@/lib/api";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";

type BackupStatus = {
  configured: boolean;
  storageConnected: boolean;
  storageError: string | null;
  restoreAvailable: boolean;
  timezone: string;
  backupTime: string;
  retentionDays: number;
  databaseCreatedAt: string | null;
  databaseExpiresAt: string | null;
  preExpirationDueAt: string | null;
  lastSuccessfulBackupAt: string | null;
  nextScheduledAt: string;
  count: number;
  preExpirationBackupAt: string | null;
  missedDays: number | null;
  lastMissedPeriod: string | null;
  lock: { acquiredAt: string; expiresAt: string } | null;
};

type BackupItem = {
  backupUuid: string;
  filename: string;
  backupType: "daily" | "pre_expiration" | "manual";
  createdAt: string;
  completedAt: string | null;
  fileSize: number;
  assetsFileCount: number;
  checksum: string | null;
  status: "running" | "succeeded" | "failed";
  errorMessage: string | null;
  retentionUntil: string;
};

const typeLabels: Record<BackupItem["backupType"], string> = {
  daily: "Quotidienne",
  pre_expiration: "Préventive — jour 29",
  manual: "Manuelle",
};

function formatBytes(value: number) {
  if (!value) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  const exponent = Math.min(Math.floor(Math.log10(value) / 3), units.length - 1);
  const size = value / 10 ** (exponent * 3);
  return `${size.toFixed(size >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatDateTime(value: string | null, timezone = "Africa/Dakar") {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  });
}

const cardClass = "border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-5";
const quietButtonClass =
  "inline-flex min-h-9 items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] px-3 py-2 text-xs font-medium text-[#49524c] dark:text-[#ccd3cb] transition hover:bg-[#f5f2ea] dark:hover:bg-[#232c25] disabled:opacity-50";

export default function BackupManager({
  run,
  busy,
}: {
  run: (action: () => Promise<unknown>, success?: string) => Promise<void>;
  busy: boolean;
}) {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [items, setItems] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoreDatabaseUrl, setRestoreDatabaseUrl] = useState("");
  const confirm = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await api<{ status: BackupStatus; items: BackupItem[] }>("/admin/backups");
      setStatus(payload.status);
      setItems(payload.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load().catch(() => toast.error("Sauvegardes illisibles pour le moment."));
  }, [load]);

  const download = async (item: BackupItem, file: "dump" | "manifest" | "sql") => {
    if (file === "sql") {
      const link = document.createElement("a");
      link.href = apiUrl(`/api/admin/backups/${item.backupUuid}/download-sql`);
      link.download = item.filename.replace(/\.dump(?:\.enc)?$/, ".sql");
      document.body.append(link);
      link.click();
      link.remove();
      return;
    }
    const result = await api<{ url: string; expiresIn: number }>(
      `/admin/backups/${item.backupUuid}/download-url?file=${file}`,
    );
    const link = document.createElement("a");
    link.href = result.url;
    document.body.append(link);
    link.click();
    link.remove();
  };

  const verify = async (item: BackupItem) => {
    await api(`/admin/backups/${item.backupUuid}/verify`, { method: "POST" });
    toast.success("Checksum et archive PostgreSQL vérifiés.");
  };

  const restore = async (item: BackupItem) => {
    if (item.assetsFileCount > 0 && !status?.restoreAvailable) {
      toast.error("Le serveur n’est pas configuré pour restaurer les médias de cette ancienne sauvegarde.");
      return;
    }
    const targetDatabaseUrl = restoreDatabaseUrl.trim();
    if (!targetDatabaseUrl) {
      toast.error("Saisissez l’URL PostgreSQL de la base neuve à restaurer.");
      return;
    }
    const confirmed = await confirm({
      title: "Restaurer dans une nouvelle base ?",
      message: `L’archive ${item.filename} sera restaurée dans la base PostgreSQL indiquée. Elle doit être neuve, vide et distincte de la production. La restauration n’écrase aucune table existante.`,
      confirmLabel: "Restaurer",
      destructive: true,
    });
    if (!confirmed) return;
    await run(async () => {
      let result: { tableCount: number; assetsFileCount: number; restoredAssetsDirectory: string | null };
      try {
        result = await api<{ tableCount: number; assetsFileCount: number; restoredAssetsDirectory: string | null }>(
          `/admin/backups/${item.backupUuid}/restore`,
          {
            method: "POST",
            body: JSON.stringify({
              confirmation: "RESTAURER_DANS_LA_NOUVELLE_BASE",
              targetDatabaseUrl,
            }),
          },
        );
      } finally {
        setRestoreDatabaseUrl("");
      }
      await load();
      toast.success(
        `Restauration terminée : ${result.tableCount} tables et ${result.assetsFileCount} médias.` +
        (result.restoredAssetsDirectory ? ` Dossier média : ${result.restoredAssetsDirectory}` : ""),
      );
    });
  };

  const startBackup = () =>
    void run(async () => {
      await api<BackupItem>("/admin/backups", { method: "POST" });
      await load();
    }, "Sauvegarde créée et vérifiée dans R2.");

  const cards = status
    ? [
        {
          icon: ShieldCheck,
          label: "État du système",
          value: status.configured ? (status.storageConnected ? "Opérationnel" : "R2 inaccessible") : "À configurer",
          note: status.storageError || (status.configured ? `Planifié à ${status.backupTime} · ${status.timezone}` : "Variables Cloudflare R2 manquantes"),
        },
        {
          icon: Clock,
          label: "Dernière sauvegarde valide",
          value: formatDateTime(status.lastSuccessfulBackupAt, status.timezone),
          note: status.lock
            ? "Une sauvegarde est en cours"
            : status.lastMissedPeriod
              ? `Période manquée : ${status.lastMissedPeriod}`
              : status.missedDays
                ? `${status.missedDays} jour(s) de retard détecté(s)`
                : "État vérifié dans R2",
        },
        {
          icon: RefreshCw,
          label: "Prochaine vérification",
          value: formatDateTime(status.nextScheduledAt, status.timezone),
          note: `Tous les jours à ${status.backupTime} (${status.timezone})`,
        },
        {
          icon: HardDrive,
          label: "Archives disponibles",
          value: String(status.count),
          note: `Conservation : ${status.retentionDays} jours`,
        },
        {
          icon: Database,
          label: "Sauvegarde préventive",
          value: status.preExpirationBackupAt ? formatDateTime(status.preExpirationBackupAt, status.timezone) : "Non effectuée",
          note: status.preExpirationDueAt ? `Jour 29 : ${status.preExpirationDueAt}` : "Configurez DATABASE_CREATED_AT",
        },
        {
          icon: AlertTriangle,
          label: "Expiration de la base",
          value: status.databaseExpiresAt ? formatDateTime(status.databaseExpiresAt, status.timezone) : "Non configurée",
          note: status.databaseCreatedAt ? `Créée le ${formatDateTime(status.databaseCreatedAt, status.timezone)}` : "Configurez les dates de la base",
        },
      ]
    : [];

  return (
    <section className="space-y-5">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.17em] text-[#a97850] dark:text-[#dcb487]">SAUVEGARDE</p>
          <h2 className="mt-1 font-heading text-3xl font-semibold sm:text-4xl">Sauvegardes et restauration</h2>
          <p className="mt-1.5 max-w-3xl text-sm text-[#72766e] dark:text-[#aab3a8]">
            Les archives PostgreSQL vérifiées sont envoyées vers le bucket privé Cloudflare R2. Render Free suspend
            l’application sans trafic : les dates manquées sont détectées et une seule reprise est lancée au retour.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void run(load)} disabled={busy || loading} className={quietButtonClass}>
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
          <button
            type="button"
            onClick={startBackup}
            disabled={busy || loading || !status?.configured || !status.storageConnected}
            className="inline-flex min-h-11 items-center gap-2 bg-[#293b32] dark:bg-[#2f4438] px-4 text-sm font-semibold text-white hover:bg-[#354b3f] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Lancer une sauvegarde
          </button>
        </div>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 py-10 text-sm text-[#85877f] dark:text-[#96a094]">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement des sauvegardes…
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <div key={card.label} className={cardClass}>
                <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[#a97850] dark:text-[#dcb487]">
                  <card.icon className="h-4 w-4" /> {card.label.toUpperCase()}
                </p>
                <p className="mt-3 text-lg font-semibold text-[#29352f] dark:text-[#e9ece6]">{card.value}</p>
                <p className="mt-1 text-xs text-[#72766e] dark:text-[#aab3a8]">{card.note}</p>
              </div>
            ))}
          </div>

          <div className={`${cardClass} space-y-2`}>
            <label htmlFor="backup-restore-database-url" className="block text-sm font-semibold">
              URL PostgreSQL de la nouvelle base
            </label>
            <input
              id="backup-restore-database-url"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={restoreDatabaseUrl}
              onChange={(event) => setRestoreDatabaseUrl(event.target.value)}
              placeholder="postgresql://utilisateur:mot-de-passe@hote:5432/base"
              disabled={busy}
              className="w-full border border-[#dedbd3] bg-white px-3 py-2 text-sm text-[#29352f] outline-none focus:border-[#a97850] disabled:opacity-60 dark:border-[#333d34] dark:bg-[#151b16] dark:text-[#e9ece6]"
              aria-describedby="backup-restore-url-help"
            />
            <p id="backup-restore-url-help" className="text-xs text-[#72766e] dark:text-[#aab3a8]">
              Utilisée uniquement pour cette restauration et non enregistrée. La base doit être vide et différente de la production.
            </p>
          </div>

          <div className="border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c]">
            <p className="border-b border-[#efede7] dark:border-[#262e27] px-5 py-4 text-sm font-semibold">
              Historique — réconcilié avec les manifestes R2
            </p>
            {!items.length ? (
              <p className="px-5 py-10 text-center text-sm text-[#85877f] dark:text-[#96a094]">
                Aucune sauvegarde disponible. Configurez R2 puis lancez une sauvegarde manuelle.
              </p>
            ) : (
              <ul className="divide-y divide-[#efede7] dark:divide-[#262e27]">
                {items.map((item) => (
                  <li key={item.backupUuid} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#29352f] dark:text-[#e9ece6]">
                        {formatDateTime(item.completedAt || item.createdAt, status?.timezone)}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold ${
                            item.status === "succeeded"
                              ? "bg-[#e8f2e5] text-[#3c6b3c] dark:bg-[#22301f] dark:text-[#a7d3a0]"
                              : "bg-[#f9e4e0] text-[#8c3428] dark:bg-[#351d19] dark:text-[#e39d8f]"
                          }`}
                        >
                          {item.status === "succeeded" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                          {item.status === "succeeded" ? "Réussie" : item.status === "running" ? "En cours" : "Échec"}
                        </span>
                      </p>
                      <p className="mt-1 break-all text-xs text-[#72766e] dark:text-[#aab3a8]">
                        {item.filename} · {typeLabels[item.backupType]} · {formatBytes(item.fileSize)} · {item.assetsFileCount} média(aux)
                      </p>
                      <p className="mt-1 text-xs text-[#85877f] dark:text-[#96a094]">
                        Expire le {formatDateTime(item.retentionUntil, status?.timezone)}
                      </p>
                      {item.errorMessage ? (
                        <p className="mt-1 line-clamp-2 max-w-2xl text-xs text-[#8c3428] dark:text-[#e39d8f]">
                          {item.errorMessage}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.status === "succeeded" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void run(() => verify(item), "Archive vérifiée.")}
                            disabled={busy}
                            className={quietButtonClass}
                          >
                            <ShieldQuestion className="h-3.5 w-3.5" /> Vérifier
                          </button>
                          <button
                            type="button"
                            onClick={() => void run(() => download(item, "dump"), "Téléchargement démarré.")}
                            disabled={busy}
                            className={quietButtonClass}
                          >
                            <Download className="h-3.5 w-3.5" /> Télécharger
                          </button>
                          <button
                            type="button"
                            onClick={() => void run(() => download(item, "sql"), "Téléchargement SQL démarré.")}
                            disabled={busy}
                            className={quietButtonClass}
                          >
                            <Download className="h-3.5 w-3.5" /> SQL
                          </button>
                          <button
                            type="button"
                            onClick={() => void run(() => download(item, "manifest"), "Manifeste téléchargé.")}
                            disabled={busy}
                            className={quietButtonClass}
                          >
                            <Download className="h-3.5 w-3.5" /> Manifeste
                          </button>
                          <button
                            type="button"
                            onClick={() => void restore(item)}
                            disabled={busy || (item.assetsFileCount > 0 && !status?.restoreAvailable)}
                            title={item.assetsFileCount > 0 && !status?.restoreAvailable
                              ? "Configurez BACKUP_RESTORE_UPLOADS_DIR dans Render pour restaurer les médias."
                              : undefined}
                            className={`${quietButtonClass} border-[#e6c9c2] text-[#8c3428] dark:border-[#4a2e28] dark:text-[#e39d8f]`}
                          >
                            Restaurer
                          </button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
