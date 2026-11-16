import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bath,
  Building2,
  CheckCircle2,
  ClipboardList,
  CircleDollarSign,
  Home,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { api, formatCurrency } from "@/lib/api";
import NumericInput from "@/components/NumericInput";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Price = { key: string; name: string; unit: string; rate: number; calculation: "area" | "linear" | "fixed" };
type TransportZone = { id: number; name: string; rate: number; active: number };
type Space = { id: string; name: string; type: string; area: number | ""; ceilingTypeKey: string };
type Room = Space & { bathroom?: Space };
type Apartment = { id: string; name: string; rooms: Room[] };
type Floor = { id: string; name: string; apartments: Apartment[] };
type Building = { floors: Floor[] };
type Service = { id: number; name: string; description: string; price: number; unit: string; pricingType: "fixed" | "area" | "unit" | "quantity_unit" };
type EstimateItem = {
  key: string;
  kind?: string;
  floorId?: string;
  floorName?: string;
  apartmentId?: string;
  apartmentName?: string;
  roomId?: string;
  roomName?: string;
  parentRoomName?: string;
  ceilingTypeName?: string;
  label: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};
type Estimate = {
  project: { totalArea: number };
  items: EstimateItem[];
  totals: { subtotal: number; discount: number; total: number };
};
type Customer = { name: string; whatsapp: string; email: string; location: string; notes: string };

const steps = [
  { label: "Informations générales", icon: UserRound },
  { label: "Étages", icon: Building2 },
  { label: "Appartements", icon: Home },
  { label: "Pièces", icon: ClipboardList },
  { label: "Salles de bain", icon: Bath },
  { label: "Options et prestations", icon: CircleDollarSign },
  { label: "Récapitulatif", icon: CheckCircle2 },
];
const roomTypes = ["Chambre", "Salon", "Cuisine", "Couloir", "Balcon", "Entrée", "Bureau", "Autre"];
const inputClass = "mt-1.5 min-h-11 w-full border border-[#dedbd3] dark:border-[#333d34] bg-white dark:bg-[#1b221c] px-3 py-2.5 text-base text-[#29352f] dark:text-[#e9ece6] outline-none transition focus:border-[#a97850] focus:ring-2 focus:ring-[#a97850]/15 sm:text-sm";
const labelClass = "block text-xs font-medium text-[#6c7169] dark:text-[#a8b1a6]";
const newId = () => crypto.randomUUID();
const emptyCustomer: Customer = { name: "", whatsapp: "", email: "", location: "", notes: "" };
const nextAvailableName = (names: string[], format: (index: number) => string) => {
  const existing = new Set(names.map((name) => name.trim().toLocaleLowerCase()));
  let index = 1;
  while (existing.has(format(index).toLocaleLowerCase())) index += 1;
  return format(index);
};

function makeSpace(type: string, name: string, ceilingTypeKey: string): Space {
  return { id: newId(), type, name, area: "", ceilingTypeKey };
}

export default function QuoteBuilderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (quoteId: number) => void;
}) {
  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState<Customer>(emptyCustomer);
  const [building, setBuilding] = useState<Building>({ floors: [] });
  const [prices, setPrices] = useState<Price[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [transportZones, setTransportZones] = useState<TransportZone[]>([]);
  const [options, setOptions] = useState<Record<string, number>>({});
  const [additionalServices, setAdditionalServices] = useState<Record<number, number>>({});
  const [transportZone, setTransportZone] = useState<"dakar" | "hors_dakar">("dakar");
  const [transportMode, setTransportMode] = useState<"zone" | "custom">("zone");
  const [transportZoneId, setTransportZoneId] = useState<number | null>(null);
  const [transportCustomPrice, setTransportCustomPrice] = useState("");
  const [discount, setDiscount] = useState(0);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep(0);
    setCustomer(emptyCustomer);
    setBuilding({ floors: [] });
    setOptions({});
    setAdditionalServices({});
    setTransportZone("dakar");
    setTransportMode("zone");
    setTransportZoneId(null);
    setTransportCustomPrice("");
    setDiscount(0);
    setEstimate(null);
  };

  const loadCatalog = useCallback(async () => {
    try {
      const [catalog, serviceCatalog, zones] = await Promise.all([
        api<Price[]>("/public/pricing"),
        api<Service[]>("/public/supplemental-services"),
        api<TransportZone[]>("/admin/transport-zones").catch(() => []),
      ]);
      setPrices(catalog);
      setServices(serviceCatalog);
      setTransportZones(zones.filter((zone) => zone.active));
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Le catalogue des tarifs n’a pas pu être chargé.");
    }
  }, []);

  useEffect(() => {
    if (open) {
      reset();
      void loadCatalog();
    }
  }, [open, loadCatalog]);

  const areaPrices = useMemo(
    () => prices.filter((price) => price.calculation === "area" && !["main_oeuvre", "materiaux"].includes(price.key)),
    [prices],
  );
  const optionPrices = useMemo(
    () => prices.filter((price) => price.calculation !== "area" && !["main_oeuvre", "materiaux"].includes(price.key)),
    [prices],
  );
  const totalArea = useMemo(
    () => building.floors.flatMap((floor) => floor.apartments.flatMap((apartment) => apartment.rooms.flatMap((room) => [room, ...(room.bathroom ? [room.bathroom] : [])]))).reduce((total, space) => total + Number(space.area || 0), 0),
    [building],
  );

  const transportRate = prices.find((price) => price.key === "transport")?.rate ?? 0;
  const selectedTransportZone = transportZones.find((zone) => zone.id === transportZoneId) ?? null;

  const projectPayload = () => ({
    building,
    options: Object.entries(options).filter(([, quantity]) => quantity > 0).map(([key, quantity]) => ({ key, quantity })),
    additionalServices: Object.entries(additionalServices).filter(([, quantity]) => quantity > 0).map(([id, quantity]) => ({ id: Number(id), quantity })),
    transportZone,
    ...(transportZone === "hors_dakar" && transportMode === "zone" && transportZoneId ? { transportZoneId } : {}),
    ...(transportZone === "hors_dakar" && transportMode === "custom" && transportCustomPrice !== "" ? { transportCustomPrice: Number(transportCustomPrice) } : {}),
    discount: Number(discount) || 0,
  });

  const updateFloor = (floorId: string, update: (floor: Floor) => Floor) =>
    setBuilding((current) => ({ ...current, floors: current.floors.map((floor) => floor.id === floorId ? update(floor) : floor) }));
  const updateApartment = (floorId: string, apartmentId: string, update: (apartment: Apartment) => Apartment) =>
    updateFloor(floorId, (floor) => ({ ...floor, apartments: floor.apartments.map((apartment) => apartment.id === apartmentId ? update(apartment) : apartment) }));
  const updateRoom = (floorId: string, apartmentId: string, roomId: string, update: (room: Room) => Room) =>
    updateApartment(floorId, apartmentId, (apartment) => ({ ...apartment, rooms: apartment.rooms.map((room) => room.id === roomId ? update(room) : room) }));

  const validateStep = (): string => {
    if (step === 0) {
      if (customer.name.trim().length < 2) return "Renseignez le nom du client.";
      if (customer.whatsapp.trim().length < 6) return "Renseignez le numéro WhatsApp du client.";
      if (customer.location.trim().length < 2) return "Renseignez l’adresse du chantier.";
    }
    if (step === 1 && (!building.floors.length || building.floors.some((floor) => !floor.name.trim())))
      return "Ajoutez au moins un étage et renseignez son nom.";
    if (step === 2 && building.floors.some((floor) => !floor.apartments.length || floor.apartments.some((apartment) => !apartment.name.trim())))
      return "Ajoutez au moins un appartement à chaque étage et renseignez son nom.";
    if (step === 3) {
      if (building.floors.some((floor) => floor.apartments.some((apartment) => !apartment.rooms.length)))
        return "Ajoutez au moins une pièce dans chaque appartement.";
      if (building.floors.some((floor) => floor.apartments.some((apartment) => apartment.rooms.some((room) =>
        !room.name.trim() || !(Number(room.area) > 0) || !room.ceilingTypeKey))))
        return "Chaque pièce doit avoir un nom, une surface positive et un type de plafond.";
    }
    if (step === 4 && building.floors.some((floor) => floor.apartments.some((apartment) => apartment.rooms.some((room) =>
      room.bathroom && (!(Number(room.bathroom.area) > 0) || !room.bathroom.ceilingTypeKey)))))
      return "Renseignez une surface positive et un type de plafond pour chaque salle de bain.";
    return "";
  };

  const calculate = async () => {
    if (options.transport > 0 && transportZone === "hors_dakar") {
      if (transportMode === "zone" && !selectedTransportZone) {
        toast.error("Choisissez une zone de déplacement hors Dakar ou passez en prix personnalisé.");
        return false;
      }
      if (transportMode === "custom" && (transportCustomPrice === "" || !(Number(transportCustomPrice) >= 0))) {
        toast.error("Saisissez le prix personnalisé du déplacement hors Dakar.");
        return false;
      }
    }
    setBusy(true);
    try {
      const result = await api<Estimate>("/admin/quotes/estimate", {
        method: "POST",
        body: JSON.stringify(projectPayload()),
      });
      setEstimate(result);
      return true;
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Le calcul du devis a échoué.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const goNext = async () => {
    const problem = validateStep();
    if (problem) {
      toast.error(problem);
      return;
    }
    if (step === 5 && !(await calculate())) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const save = async (issue: boolean) => {
    if (!(await calculate())) return;
    setBusy(true);
    try {
      const created = await api<{ id: number; number: string }>("/admin/quotes", {
        method: "POST",
        body: JSON.stringify({
          customer: { name: customer.name, whatsapp: customer.whatsapp, email: customer.email },
          project: projectPayload(),
          description: customer.notes || `Devis établi pour un bâtiment de ${totalArea} m².`,
          location: customer.location,
          issue,
        }),
      });
      toast.success(issue ? `Devis ${created.number} créé et émis.` : `Devis ${created.number} enregistré.`);
      onOpenChange(false);
      onCreated(created.id);
      reset();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "La création du devis a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const moveFloor = (floorIndex: number, direction: -1 | 1) => {
    setBuilding((current) => {
      const floors = [...current.floors];
      const nextIndex = floorIndex + direction;
      if (nextIndex < 0 || nextIndex >= floors.length) return current;
      [floors[floorIndex], floors[nextIndex]] = [floors[nextIndex], floors[floorIndex]];
      return { floors };
    });
  };

  const apartmentSubtotal = (floorId: string, apartmentId: string) =>
    estimate?.items.filter((item) => item.floorId === floorId && item.apartmentId === apartmentId).reduce((sum, item) => sum + item.amount, 0) || 0;
  const floorSubtotal = (floorId: string) =>
    estimate?.items.filter((item) => item.floorId === floorId).reduce((sum, item) => sum + item.amount, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) reset(); onOpenChange(nextOpen); }}>
      <DialogContent busy={busy} scrollClassName="flex-1 gap-0" className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-[#e8e5de] dark:border-[#2b342c] bg-[#fbfaf7] dark:bg-[#171d18] p-0 sm:h-[94dvh] sm:max-h-[94dvh] sm:w-[calc(100vw-2rem)] sm:max-w-5xl">
        <DialogHeader className="border-b border-[#e8e5de] dark:border-[#2b342c] px-4 py-3 pr-12 text-left sm:px-7 sm:py-4">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[#a97850] dark:text-[#dcb487]">NOUVEAU DEVIS</p>
          <DialogTitle className="font-heading text-xl sm:text-2xl">Construire le bâtiment étape par étape</DialogTitle>
          <DialogDescription className="text-xs">Les prix des plafonds sont calculés par espace et validés par le serveur.</DialogDescription>
        </DialogHeader>

        <nav aria-label="Progression du devis" className="border-b border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] px-4 py-3">
          <div className="flex items-center justify-between gap-3 sm:hidden">
            <p className="flex min-w-0 items-center gap-2 text-xs font-semibold">{(() => {
              const Icon = steps[step].icon;
              return <><Icon size={16} className="shrink-0 text-[#a97850]" /><span className="truncate">{steps[step].label}</span></>;
            })()}</p>
            <span className="shrink-0 text-[10px] text-[#85877f]">ÉTAPE {step + 1} / {steps.length}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#eeeae2] sm:hidden">
            <div className="h-full bg-[#5c6f52] transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
          <div className="hidden gap-1 overflow-x-auto sm:flex">
            {steps.map((entry, index) => {
              const Icon = entry.icon;
              return <button key={entry.label} type="button" disabled={index >= step} onClick={() => setStep(index)} aria-current={index === step ? "step" : undefined} className={`flex shrink-0 items-center gap-1.5 px-3 py-2 text-[11px] font-medium ${index === step ? "bg-[#293b32] text-white" : index < step ? "text-[#4e6854] hover:bg-[#f0f3ee]" : "text-[#9a9d95]"}`}><Icon size={13} />{index + 1}. {entry.label}</button>;
            })}
          </div>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-7 sm:py-5">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>Nom du client *
                <input className={inputClass} value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} required />
              </label>
              <label className={labelClass}>WhatsApp *
                <input className={inputClass} type="tel" inputMode="tel" autoComplete="tel" value={customer.whatsapp} onChange={(event) => setCustomer({ ...customer, whatsapp: event.target.value })} required />
              </label>
              <label className={labelClass}>E-mail
                <input className={inputClass} type="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} />
              </label>
              <label className={labelClass}>Adresse du chantier *
                <input className={inputClass} value={customer.location} onChange={(event) => setCustomer({ ...customer, location: event.target.value })} required />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>Notes
                <textarea className={`${inputClass} min-h-20`} value={customer.notes} onChange={(event) => setCustomer({ ...customer, notes: event.target.value })} />
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-[#687068] dark:text-[#b3bcb2]">Ajoutez les étages du bâtiment et définissez leur ordre d’apparition dans le devis.</p>
              {building.floors.map((floor, index) => (
                <div key={floor.id} className="flex items-end gap-2 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-3">
                  <label className={`${labelClass} flex-1`}>Nom ou numéro de l’étage
                    <input className={inputClass} value={floor.name} placeholder="Ex. Rez-de-chaussée, 1er étage" onChange={(event) => updateFloor(floor.id, (current) => ({ ...current, name: event.target.value }))} required />
                  </label>
                  <button type="button" aria-label="Monter l’étage" disabled={index === 0} onClick={() => moveFloor(index, -1)} className="grid size-10 shrink-0 place-items-center border border-[#dedbd3] disabled:opacity-40"><ArrowUp size={15} /></button>
                  <button type="button" aria-label="Descendre l’étage" disabled={index === building.floors.length - 1} onClick={() => moveFloor(index, 1)} className="grid size-10 shrink-0 place-items-center border border-[#dedbd3] disabled:opacity-40"><ArrowDown size={15} /></button>
                  <button type="button" aria-label="Supprimer l’étage" onClick={() => setBuilding((current) => ({ floors: current.floors.filter((entry) => entry.id !== floor.id) }))} className="grid size-10 shrink-0 place-items-center border border-[#ead6d1] text-[#8a4d43]"><Trash2 size={15} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setBuilding((current) => ({ floors: [...current.floors, { id: newId(), name: nextAvailableName(current.floors.map((floor) => floor.name), (index) => `${index === 1 ? "1er" : `${index}e`} étage`), apartments: [] }] }))} className="inline-flex min-h-10 items-center gap-2 border border-[#dedbd3] px-3 text-xs font-semibold text-[#526b57]"><Plus size={14} /> Ajouter un étage</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {building.floors.map((floor) => (
                <section key={floor.id} className="space-y-3 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-3 sm:p-4">
                  <h3 className="font-heading text-lg font-semibold text-[#293b32] dark:text-[#e9ece6]">{floor.name || "Étage sans nom"}</h3>
                  {floor.apartments.map((apartment) => (
                    <div key={apartment.id} className="flex items-end gap-2 border-t border-[#efede7] dark:border-[#262e27] pt-3">
                      <label className={`${labelClass} flex-1`}>Nom ou numéro de l’appartement
                        <input className={inputClass} value={apartment.name} placeholder="Ex. Appartement 1" onChange={(event) => updateApartment(floor.id, apartment.id, (current) => ({ ...current, name: event.target.value }))} required />
                      </label>
                      <button type="button" aria-label="Supprimer l’appartement" onClick={() => updateFloor(floor.id, (current) => ({ ...current, apartments: current.apartments.filter((entry) => entry.id !== apartment.id) }))} className="grid size-10 shrink-0 place-items-center border border-[#ead6d1] text-[#8a4d43]"><Trash2 size={15} /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => updateFloor(floor.id, (current) => ({ ...current, apartments: [...current.apartments, { id: newId(), name: nextAvailableName(current.apartments.map((apartment) => apartment.name), (index) => `Appartement ${index}`), rooms: [] }] }))} className="inline-flex min-h-9 items-center gap-2 border border-[#dedbd3] px-3 text-xs font-semibold text-[#526b57]"><Plus size={14} /> Ajouter un appartement</button>
                </section>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {building.floors.map((floor) => (
                <section key={floor.id} className="space-y-3 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-3 sm:p-4">
                  <h3 className="font-heading text-lg font-semibold text-[#293b32] dark:text-[#e9ece6]">{floor.name}</h3>
                  {floor.apartments.map((apartment) => (
                    <div key={apartment.id} className="space-y-3 border-t border-[#efede7] dark:border-[#262e27] pt-3">
                      <h4 className="text-sm font-semibold text-[#526b57] dark:text-[#9ecfa9]">{apartment.name}</h4>
                      {apartment.rooms.map((room) => (
                        <div key={room.id} className="grid gap-3 border border-[#e8e5de] dark:border-[#2b342c] p-3 sm:grid-cols-2 lg:grid-cols-4">
                          <label className={labelClass}>Type de pièce
                            <select className={inputClass} value={room.type} onChange={(event) => updateRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, type: event.target.value, name: event.target.value === "Autre" ? "" : `${event.target.value} ${apartment.rooms.filter((entry) => entry.type === event.target.value).findIndex((entry) => entry.id === room.id) + 1}` }))}>
                              {roomTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                            </select>
                          </label>
                          <label className={labelClass}>Nom de la pièce
                            <input className={inputClass} value={room.name} placeholder={room.type === "Autre" ? "Nom personnalisé" : room.type} onChange={(event) => updateRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, name: event.target.value }))} required />
                          </label>
                          <label className={labelClass}>Surface (m²)
                            <NumericInput className={inputClass} min="0.1" step="0.1" value={room.area} onChange={(event) => updateRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, area: event.target.value === "" ? "" : Number(event.target.value) }))} required />
                          </label>
                          <label className={labelClass}>Type de plafond
                            <select className={inputClass} value={room.ceilingTypeKey} onChange={(event) => updateRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, ceilingTypeKey: event.target.value }))} required>
                              <option value="">Choisir un tarif</option>
                              {areaPrices.map((price) => <option key={price.key} value={price.key}>{price.name} · {formatCurrency(price.rate)}/m²</option>)}
                            </select>
                          </label>
                          <p className="text-xs font-medium text-[#815d3e] sm:col-span-2">Montant estimé : {formatCurrency(Number(room.area || 0) * (areaPrices.find((price) => price.key === room.ceilingTypeKey)?.rate || 0))}</p>
                          <button type="button" onClick={() => updateApartment(floor.id, apartment.id, (current) => ({ ...current, rooms: current.rooms.filter((entry) => entry.id !== room.id) }))} className="inline-flex min-h-9 items-center justify-center gap-2 border border-[#ead6d1] px-3 text-xs text-[#8a4d43] lg:col-start-4"><Trash2 size={14} /> Supprimer la pièce</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => updateApartment(floor.id, apartment.id, (current) => ({ ...current, rooms: [...current.rooms, { ...makeSpace("Chambre", `Chambre ${current.rooms.filter((room) => room.type === "Chambre").length + 1}`, areaPrices[0]?.key || ""), type: "Chambre" }] }))} className="inline-flex min-h-9 items-center gap-2 border border-[#dedbd3] px-3 text-xs font-semibold text-[#526b57]"><Plus size={14} /> Ajouter une pièce</button>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-[#687068] dark:text-[#b3bcb2]">L’option salle de bain n’est proposée que pour les chambres. Chaque salle de bain est facturée comme un espace distinct.</p>
              {building.floors.flatMap((floor) => floor.apartments.flatMap((apartment) => apartment.rooms.filter((room) => room.type === "Chambre").map((room) => (
                <section key={room.id} className="border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-4">
                  <label className="flex min-h-9 items-center gap-3 text-sm font-medium">
                    <input type="checkbox" checked={Boolean(room.bathroom)} onChange={(event) => updateRoom(floor.id, apartment.id, room.id, (current) => ({
                      ...current,
                      bathroom: event.target.checked
                        ? makeSpace("Salle de bain", "Salle de bain", areaPrices[0]?.key || "")
                        : undefined,
                    }))} />
                    Cette chambre possède-t-elle une salle de bain ?
                    <span className="ml-auto text-xs text-[#85877f]">{floor.name} · {apartment.name} · {room.name}</span>
                  </label>
                  {room.bathroom && (
                    <div className="mt-3 grid gap-3 border-t border-[#efede7] dark:border-[#262e27] pt-3 sm:grid-cols-2">
                      <p className="self-center text-sm font-semibold text-[#526b57] dark:text-[#9ecfa9]">↳ Salle de bain de {room.name}</p>
                      <label className={labelClass}>Surface (m²)
                        <NumericInput className={inputClass} min="0.1" step="0.1" value={room.bathroom.area} onChange={(event) => updateRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, bathroom: current.bathroom ? { ...current.bathroom, area: event.target.value === "" ? "" : Number(event.target.value) } : undefined }))} required />
                      </label>
                      <label className={labelClass}>Type de plafond
                        <select className={inputClass} value={room.bathroom.ceilingTypeKey} onChange={(event) => updateRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, bathroom: current.bathroom ? { ...current.bathroom, ceilingTypeKey: event.target.value } : undefined }))} required>
                          <option value="">Choisir un tarif</option>
                          {areaPrices.map((price) => <option key={price.key} value={price.key}>{price.name} · {formatCurrency(price.rate)}/m²</option>)}
                        </select>
                      </label>
                      <p className="self-end pb-2 text-xs font-medium text-[#815d3e]">Montant estimé : {formatCurrency(Number(room.bathroom.area || 0) * (areaPrices.find((price) => price.key === room.bathroom?.ceilingTypeKey)?.rate || 0))}</p>
                    </div>
                  )}
                </section>
              ))))}
              {!building.floors.some((floor) => floor.apartments.some((apartment) => apartment.rooms.some((room) => room.type === "Chambre"))) && <p className="border border-dashed border-[#d8d5cc] p-6 text-center text-sm text-[#85877f]">Aucune chambre : vous pourrez continuer sans ajouter de salle de bain.</p>}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-heading text-xl font-semibold">Options et prestations supplémentaires</h3>
                <p className="mt-1 text-sm text-[#687068] dark:text-[#b3bcb2]">Ajoutez les options et prestations facultatives avant de vérifier le devis.</p>
              </div>
              <section className="space-y-3 border border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] p-4">
                <h4 className="text-xs font-semibold tracking-wide text-[#a97850] dark:text-[#dcb487]">OPTIONS DU TARIF</h4>
                {optionPrices.map((price) => (
                  <div key={price.key} className="space-y-2 border-t border-[#efede7] dark:border-[#262e27] pt-3">
                    <label className="flex flex-wrap items-center gap-2 text-xs">
                      <input type="checkbox" checked={Boolean(options[price.key])} onChange={(event) => setOptions((current) => ({ ...current, [price.key]: event.target.checked ? 1 : 0 }))} />
                      <span className="flex-1">{price.name} ({price.unit})</span>
                      {price.key === "transport" && <span className="text-[#815d3e] dark:text-[#dcb487]">{transportZone === "dakar" ? `${formatCurrency(transportRate)} · Dakar` : transportMode === "zone" && selectedTransportZone ? `${formatCurrency(selectedTransportZone.rate)} · ${selectedTransportZone.name}` : transportMode === "custom" && transportCustomPrice !== "" ? `${formatCurrency(Number(transportCustomPrice))} · prix personnalisé` : "Hors Dakar · prix à renseigner"}</span>}
                      {options[price.key] > 0 && price.key !== "transport" && <NumericInput aria-label={`Quantité ${price.name}`} className="w-24 border border-[#dedbd3] px-2 py-1.5" min="0.1" step="0.1" value={options[price.key]} onChange={(event) => setOptions((current) => ({ ...current, [price.key]: Number(event.target.value) }))} />}
                    </label>
                    {price.key === "transport" && options.transport > 0 && (
                      <div className="space-y-3 border border-[#efede7] dark:border-[#262e27] p-3">
                        <label className={labelClass}>Zone de déplacement
                          <select className={inputClass} value={transportZone} onChange={(event) => setTransportZone(event.target.value as "dakar" | "hors_dakar")}>
                            <option value="dakar">Dakar · {formatCurrency(transportRate)}</option>
                            <option value="hors_dakar">Hors Dakar</option>
                          </select>
                        </label>
                        {transportZone === "hors_dakar" && (
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-4 text-xs font-medium">
                              <label className="flex items-center gap-2"><input type="radio" name="transport-mode" checked={transportMode === "zone"} onChange={() => setTransportMode("zone")} /> Choisir parmi les prix de déplacement</label>
                              <label className="flex items-center gap-2"><input type="radio" name="transport-mode" checked={transportMode === "custom"} onChange={() => setTransportMode("custom")} /> Prix personnalisé</label>
                            </div>
                            {transportMode === "zone" ? (
                              transportZones.length > 0 ? (
                                <label className={labelClass}>Zone hors Dakar
                                  <select className={inputClass} value={transportZoneId ?? ""} onChange={(event) => setTransportZoneId(event.target.value ? Number(event.target.value) : null)}>
                                    <option value="">Choisir une zone</option>
                                    {transportZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} · {formatCurrency(zone.rate)}</option>)}
                                  </select>
                                </label>
                              ) : (
                                <p className="text-xs text-[#85877f] dark:text-[#96a094]">Aucune zone configurée : ajoutez vos zones dans « Tarifs du calculateur » ou choisissez un prix personnalisé.</p>
                              )
                            ) : (
                              <label className={labelClass}>Prix personnalisé du déplacement (FCFA)
                                <NumericInput className={inputClass} min="0" step="100" value={transportCustomPrice} onChange={(event) => setTransportCustomPrice(event.target.value)} />
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {services.length > 0 && <h4 className="border-t border-[#efede7] dark:border-[#262e27] pt-3 text-xs font-semibold tracking-wide text-[#a97850] dark:text-[#dcb487]">PRESTATIONS SUPPLÉMENTAIRES</h4>}
                {services.map((service) => (
                  <label key={service.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <input type="checkbox" checked={Boolean(additionalServices[service.id])} onChange={(event) => setAdditionalServices((current) => ({ ...current, [service.id]: event.target.checked ? 1 : 0 }))} />
                    <span className="flex-1">{service.name} · {formatCurrency(service.price)} {service.pricingType === "fixed" ? "forfait" : `/ ${service.unit}`}</span>
                    {additionalServices[service.id] > 0 && !["fixed", "area"].includes(service.pricingType) && <NumericInput aria-label={`Quantité ${service.name}`} className="w-24 border border-[#dedbd3] px-2 py-1.5" min="0.1" step="0.1" value={additionalServices[service.id]} onChange={(event) => setAdditionalServices((current) => ({ ...current, [service.id]: Number(event.target.value) }))} />}
                  </label>
                ))}
                <label className={labelClass}>Remise (FCFA)
                  <NumericInput className={inputClass} min="0" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} />
                </label>
              </section>
            </div>
          )}

          {step === 6 && estimate && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="font-heading text-xl font-semibold">Récapitulatif du bâtiment</h3><p className="mt-1 text-xs text-[#687068] dark:text-[#b3bcb2]">{building.floors.length} étage(s) · {totalArea.toLocaleString("fr-FR")} m²</p></div>
                <button type="button" disabled={busy} onClick={() => void calculate()} className="min-h-9 border border-[#dedbd3] px-3 text-xs">{busy ? "Recalcul…" : "Recalculer"}</button>
              </div>
              {building.floors.map((floor) => (
                <section key={floor.id} className="overflow-hidden border border-[#d9d4c9] dark:border-[#333d34] bg-white dark:bg-[#1b221c]">
                  <h3 className="bg-[#293b32] px-4 py-3 text-sm font-bold uppercase tracking-wide text-white">{floor.name}</h3>
                  {floor.apartments.map((apartment) => (
                    <div key={apartment.id} className="border-t border-[#efede7] dark:border-[#262e27]">
                      <h4 className="bg-[#f3f1eb] dark:bg-[#232b24] px-4 py-2.5 text-sm font-semibold">{apartment.name}</h4>
                      <div className="divide-y divide-[#efede7] dark:divide-[#262e27]">
                        {estimate.items.filter((item) => item.floorId === floor.id && item.apartmentId === apartment.id).map((item) => (
                          <div key={item.key} className={`grid grid-cols-[minmax(0,1.3fr)_auto] gap-2 px-4 py-3 text-xs sm:grid-cols-[minmax(0,1.5fr)_auto_auto_auto] ${item.kind === "bathroom" ? "pl-8" : ""}`}>
                            <span className="min-w-0 font-medium">{item.kind === "bathroom" ? `↳ ${item.roomName} de ${item.parentRoomName}` : item.roomName}<span className="mt-1 block font-normal text-[#687068] dark:text-[#b3bcb2]">{item.ceilingTypeName}</span></span>
                            <span>{item.quantity} m²</span>
                            <span>{formatCurrency(item.unitPrice)}/m²</span>
                            <strong className="text-right">{formatCurrency(item.amount)}</strong>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between border-t border-[#efede7] dark:border-[#262e27] px-4 py-2.5 text-xs font-semibold"><span>Sous-total {apartment.name}</span><span>{formatCurrency(apartmentSubtotal(floor.id, apartment.id))}</span></div>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-[#d9d4c9] dark:border-[#333d34] bg-[#f8f7f3] dark:bg-[#202820] px-4 py-3 text-sm font-bold"><span>Total {floor.name}</span><span>{formatCurrency(floorSubtotal(floor.id))}</span></div>
                </section>
              ))}

              <section className="space-y-2 border border-[#d9d4c9] dark:border-[#333d34] bg-[#f8f7f3] dark:bg-[#202820] p-4 text-sm">
                <div className="flex justify-between"><span>Sous-total général</span><span>{formatCurrency(estimate.totals.subtotal)}</span></div>
                {estimate.totals.discount > 0 && <div className="flex justify-between"><span>Remise</span><span>- {formatCurrency(estimate.totals.discount)}</span></div>}
                <div className="flex justify-between border-t border-[#d9d4c9] dark:border-[#333d34] pt-2 text-base font-bold"><span>TOTAL GÉNÉRAL DU DEVIS</span><span className="text-[#815d3e]">{formatCurrency(estimate.totals.total)}</span></div>
              </section>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e8e5de] dark:border-[#2b342c] bg-white dark:bg-[#1b221c] px-4 py-3 sm:px-7">
          <button type="button" disabled={step === 0 || busy} onClick={() => setStep((current) => Math.max(0, current - 1))} className="inline-flex min-h-10 items-center gap-2 border border-[#dedbd3] dark:border-[#333d34] px-4 text-xs font-medium disabled:opacity-40"><ArrowLeft size={14} /> Retour</button>
          {step < steps.length - 1 ? (
            <button type="button" disabled={busy} onClick={() => void goNext()} className="inline-flex min-h-10 items-center gap-2 bg-[#293b32] dark:bg-[#2f4438] px-4 text-xs font-semibold text-white disabled:opacity-60">{busy ? "Calcul en cours…" : "Continuer"}<ArrowRight size={14} /></button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void save(false)} className="min-h-10 border border-[#dedbd3] dark:border-[#333d34] px-4 text-xs font-semibold disabled:opacity-60">Enregistrer le devis</button>
              <button type="button" disabled={busy} onClick={() => void save(true)} className="min-h-10 bg-[#293b32] dark:bg-[#2f4438] px-4 text-xs font-semibold text-white disabled:opacity-60">Enregistrer et émettre</button>
            </div>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
