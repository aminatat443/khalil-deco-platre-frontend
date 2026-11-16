import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Bath,
  Building2,
  Calculator,
  Check,
  ClipboardList,
  Home,
  ImageIcon,
  Lightbulb,
  MessageCircle,
  Plus,
  Ruler,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, formatCurrency } from "@/lib/api";
import { normalizeWhatsapp, whatsappSiteMessageUrl } from "@/lib/phone";
import NumericInput from "@/components/NumericInput";

type Space = { id: string; name: string; type: string; area: number | ""; ceilingTypeKey: string; bathroom?: Space };
type Apartment = { id: string; name: string; rooms: Space[] };
type Floor = { id: string; name: string; apartments: Apartment[] };
type Building = { floors: Floor[] };
type Price = { key: string; name: string; unit: string; rate: number; calculation: "area" | "linear" | "fixed" };
type LightingLayoutPoint = { key: string; name: string; productType: string; quantity: number; position: string; required: boolean };
type CeilingModel = {
  id: number; title: string; description: string;
  ceilingTypeKey: string; ceilingTypeName: string;
  minArea: number | null; maxArea: number | null;
  pricePerSqm: number;
  imageUrl: string; gallery: string[]; lightingLayout: LightingLayoutPoint[];
};
type LightingProduct = { id: string; name: string; sku: string; price: number; image: string; type: string; stock: number | null; variant?: string };
type SupplementalService = { id: number; name: string; description: string; photoUrl: string; price: number; unit: string; pricingType: "fixed" | "area" | "unit" | "quantity_unit" };
type Estimate = {
  project: { totalArea: number };
  items: Array<{ key: string; kind?: string; floorId?: string; floorName?: string; apartmentId?: string; apartmentName?: string; roomName?: string; parentRoomName?: string; ceilingTypeName?: string; label: string; unit: string; quantity: number; unitPrice: number; amount: number }>;
  totals: { subtotal: number; discount: number; total: number };
};
type PublicCompany = { whatsapp: string; phone: string };

const roomTypes = ["Chambre", "Salon", "Cuisine", "Couloir", "Balcon", "Entrée", "Bureau", "Autre"];
const steps = [
  { label: "Étages", icon: Building2 },
  { label: "Appartements", icon: Home },
  { label: "Pièces", icon: ClipboardList },
  { label: "Salles de bain", icon: Bath },
  { label: "Récapitulatif", icon: Check },
];
const newId = () => crypto.randomUUID();
const makeSpace = (type: string, name: string, ceilingTypeKey: string): Space => ({ id: newId(), type, name, area: "", ceilingTypeKey });
const initialBuilding: Building = {
  floors: [{
    id: newId(),
    name: "1er étage",
    apartments: [{ id: newId(), name: "Appartement 1", rooms: [makeSpace("Chambre", "Chambre 1", "plafond_platre")] }],
  }],
};

export default function QuoteCalculatorSection() {
  const [step, setStep] = useState(0);
  const [building, setBuilding] = useState<Building>(initialBuilding);
  const [prices, setPrices] = useState<Price[]>([]);
  const [companyWhatsApp, setCompanyWhatsApp] = useState("");
  const [models, setModels] = useState<CeilingModel[]>([]);
  const [supplementalServices, setSupplementalServices] = useState<SupplementalService[]>([]);
  const [ceiling, setCeiling] = useState<{ typeKey: string; modelId: number | null }>({ typeKey: "plafond_platre", modelId: null });
  const [detailModel, setDetailModel] = useState<CeilingModel | null>(null);
  const [lightingProducts, setLightingProducts] = useState<Record<string, LightingProduct[]>>({});
  const [lightingSelections, setLightingSelections] = useState<Record<string, string>>({});
  const [additionalSelections, setAdditionalSelections] = useState<Record<number, number>>({});
  const [extras, setExtras] = useState<Record<string, number>>({});
  const [transportZone, setTransportZone] = useState<"dakar" | "hors_dakar">("dakar");
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [customer, setCustomer] = useState({ name: "", whatsapp: "", email: "" });
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const allSpaces = useMemo(
    () => building.floors.flatMap((floor) => floor.apartments.flatMap((apartment) => apartment.rooms.flatMap((room) => [room, ...(room.bathroom ? [room.bathroom] : [])]))),
    [building],
  );
  const totalArea = useMemo(() => Math.round(allSpaces.reduce((total, space) => total + Number(space.area || 0), 0) * 100) / 100, [allSpaces]);
  const modelTypeKey = allSpaces.length && allSpaces.every((space) => space.ceilingTypeKey === allSpaces[0].ceilingTypeKey)
    ? allSpaces[0].ceilingTypeKey
    : null;
  const selectedModel = ceiling.modelId !== null
    ? models.find((model) => model.id === ceiling.modelId && model.ceilingTypeKey === modelTypeKey) || null
    : null;
  const lightingPoints = selectedModel?.lightingLayout || [];
  const areaPrices = prices.filter((price) => price.calculation === "area" && !["main_oeuvre", "materiaux"].includes(price.key));
  const optionPrices = prices.filter((price) => !["main_oeuvre", "materiaux"].includes(price.key) && price.calculation !== "area");

  useEffect(() => {
    Promise.all([
      api<Price[]>("/public/pricing").catch(() => [] as Price[]),
      api<CeilingModel[]>("/public/ceiling-models").catch(() => [] as CeilingModel[]),
    ]).then(([pricing, ceilingModels]) => {
      setPrices(pricing);
      setModels(ceilingModels);
      if (pricing.length && !pricing.some((item) => item.key === "plafond_platre")) {
        const firstArea = pricing.find((item) => item.calculation === "area" && !["main_oeuvre", "materiaux"].includes(item.key));
        if (firstArea) {
          setCeiling((current) => (current.modelId === null ? { ...current, typeKey: firstArea.key } : current));
          setBuilding((current) => ({
            ...current,
            floors: current.floors.map((floor) => ({
              ...floor,
              apartments: floor.apartments.map((apartment) => ({
                ...apartment,
                rooms: apartment.rooms.map((room) => ({
                  ...room,
                  ceilingTypeKey: room.ceilingTypeKey === "plafond_platre" ? firstArea.key : room.ceilingTypeKey,
                  bathroom: room.bathroom ? { ...room.bathroom, ceilingTypeKey: room.bathroom.ceilingTypeKey === "plafond_platre" ? firstArea.key : room.bathroom.ceilingTypeKey } : undefined,
                })),
              })),
            })),
          }));
        }
      }
      if (!pricing.length) setError("Le calculateur sera disponible dès que le serveur backend sera lancé.");
    });
  }, []);

  useEffect(() => {
    api<SupplementalService[]>("/public/supplemental-services")
      .then(setSupplementalServices)
      .catch(() => setSupplementalServices([]));
  }, []);

  useEffect(() => {
    api<PublicCompany>("/public/company")
      .then((company) => setCompanyWhatsApp(company.whatsapp || company.phone || ""))
      .catch(() => setCompanyWhatsApp(""));
  }, []);

  const fetchLightingForModel = useCallback((model: CeilingModel) => {
    const types = [...new Set(model.lightingLayout.map((point) => point.productType))];
    types.forEach((type) => {
      api<LightingProduct[]>(`/public/lighting-products?type=${encodeURIComponent(type)}`)
        .then((products) => setLightingProducts((current) => ({ ...current, [type]: products })))
        .catch(() => setLightingProducts((current) => ({ ...current, [type]: [] })));
    });
  }, []);

  const chooseModel = (model: CeilingModel) => {
    setCeiling({ typeKey: model.ceilingTypeKey, modelId: model.id });
    setBuilding((current) => ({
      ...current,
      floors: current.floors.map((floor) => ({
        ...floor,
        apartments: floor.apartments.map((apartment) => ({
          ...apartment,
          rooms: apartment.rooms.map((room) => ({
            ...room,
            ceilingTypeKey: model.ceilingTypeKey,
            bathroom: room.bathroom ? { ...room.bathroom, ceilingTypeKey: model.ceilingTypeKey } : undefined,
          })),
        })),
      })),
    }));
    setLightingSelections({});
    fetchLightingForModel(model);
  };

  const deselectModel = () => {
    setCeiling((current) => ({ ...current, modelId: null }));
    setLightingSelections({});
  };

  const updateFloor = (floorId: string, update: (floor: Floor) => Floor) =>
    setBuilding((current) => ({ ...current, floors: current.floors.map((floor) => floor.id === floorId ? update(floor) : floor) }));
  const updateApartment = (floorId: string, apartmentId: string, update: (apartment: Apartment) => Apartment) =>
    updateFloor(floorId, (floor) => ({ ...floor, apartments: floor.apartments.map((apartment) => apartment.id === apartmentId ? update(apartment) : apartment) }));
  const updateRoom = (floorId: string, apartmentId: string, roomId: string, update: (room: Space) => Space) =>
    updateApartment(floorId, apartmentId, (apartment) => ({ ...apartment, rooms: apartment.rooms.map((room) => room.id === roomId ? update(room) : room) }));

  const projectPayload = () => ({
    building,
    options: Object.entries(extras).filter(([, quantity]) => quantity > 0).map(([key, quantity]) => ({ key, quantity })),
    lightingSelections: Object.entries(lightingSelections).filter(([, productId]) => productId).map(([layoutKey, productId]) => ({ layoutKey, productId })),
    additionalServices: Object.entries(additionalSelections).filter(([, quantity]) => quantity > 0).map(([id, quantity]) => ({ id: Number(id), quantity })),
    transportZone,
    ...(ceiling.modelId !== null ? { ceilingModelId: ceiling.modelId } : {}),
    discount: 0,
  });

  const validateStep = () => {
    if (step === 0 && (!building.floors.length || building.floors.some((floor) => !floor.name.trim())))
      return "Ajoutez au moins un étage et renseignez son nom.";
    if (step === 1 && building.floors.some((floor) => !floor.apartments.length || floor.apartments.some((apartment) => !apartment.name.trim())))
      return "Ajoutez au moins un appartement à chaque étage et renseignez son nom.";
    if (step === 2 || step === 3) {
      if (building.floors.some((floor) => floor.apartments.some((apartment) => !apartment.rooms.length)))
        return "Ajoutez au moins une pièce dans chaque appartement.";
      if (allSpaces.some((space) => !space.name.trim() || !(Number(space.area) > 0) || !space.ceilingTypeKey))
        return "Chaque espace doit avoir un nom, une surface positive et un type de plafond.";
    }
    return "";
  };
  const goNext = () => {
    const problem = validateStep();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setEstimate(null);
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };
  const moveFloor = (index: number, direction: -1 | 1) => {
    setBuilding((current) => {
      const floors = [...current.floors];
      const next = index + direction;
      if (next < 0 || next >= floors.length) return current;
      [floors[index], floors[next]] = [floors[next], floors[index]];
      return { floors };
    });
  };
  const apartmentSubtotal = (floorId: string, apartmentId: string) =>
    estimate?.items.filter((item) => item.floorId === floorId && item.apartmentId === apartmentId).reduce((sum, item) => sum + item.amount, 0) || 0;
  const floorSubtotal = (floorId: string) =>
    estimate?.items.filter((item) => item.floorId === floorId).reduce((sum, item) => sum + item.amount, 0) || 0;

  useEffect(() => {
    if (!estimate) return;
    const timeout = window.setTimeout(() => {
      api<Estimate>("/public/estimate", { method: "POST", body: JSON.stringify(projectPayload()) })
        .then(setEstimate)
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Le recalcul a échoué."));
    }, 250);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building, ceiling, extras, additionalSelections, lightingSelections, transportZone]);

  const calculate = async (event?: FormEvent) => {
    event?.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setEstimate(await api<Estimate>("/public/estimate", { method: "POST", body: JSON.stringify(projectPayload()) }));
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le calcul n'a pas pu être effectué.");
      setEstimate(null);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    if (!customer.whatsapp.trim() || !address.trim()) {
      setError("Renseignez votre WhatsApp et l’adresse du chantier.");
      setBusy(false);
      return;
    }
    try {
      const result = await api<{ number: string }>("/public/quote-requests", {
        method: "POST",
        body: JSON.stringify({
          customer: { name: customer.name, whatsapp: customer.whatsapp, email: customer.email, address: address.trim() },
          project: projectPayload(),
          description,
          location: address.trim(),
        }),
      });
      const confirmation = `Votre demande ${result.number} a bien été transmise. Vous recevrez votre devis par WhatsApp sous peu.`;
      setMessage(confirmation);
      toast.success(confirmation);
      setEstimate(null);
      setCustomer({ name: "", whatsapp: "", email: "" });
      setAddress("");
      setDescription("");
      setBuilding(initialBuilding);
      setStep(0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La demande n'a pas pu être envoyée.");
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "mt-1.5 min-h-11 w-full border border-[#dfe5df] bg-white px-3 py-2.5 text-sm text-[#202923] outline-none focus:border-[#315c40] focus:ring-2 focus:ring-[#315c40]/15";
  const companyWhatsAppDial = normalizeWhatsapp(companyWhatsApp, companyWhatsApp)?.dial ?? null;
  const directQuoteUrl = whatsappSiteMessageUrl(
    companyWhatsAppDial,
    "Bonjour, je souhaite demander un devis pour des travaux de faux plafond et décoration en plâtre. Pouvez-vous me renseigner ?",
    typeof window === "undefined" ? "" : window.location.origin,
  );

  return (
    <section id="calculateur" aria-labelledby="calculator-title" className="section-padding bg-[#f7f8f6]">
      <div className="container-custom">
        <div className="mb-10 flex flex-col gap-4 border-y border-[#dfe5df] py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:py-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.16em] text-[#315c40]">UN PROJET EN TÊTE ?</p>
            <h2 className="mt-2 font-heading text-2xl font-medium text-[#202923] sm:text-3xl">Échangeons sur vos travaux</h2>
            <p className="mt-2 text-sm leading-6 text-[#626c65]">Estimez votre projet ou écrivez-nous sur WhatsApp.</p>
          </div>
          {directQuoteUrl ? (
            <a
              href={directQuoteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 bg-[#294b35] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#203d2a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294b35] motion-reduce:transition-none sm:w-auto"
            >
              <MessageCircle size={19} />
              Demander un devis par WhatsApp
            </a>
          ) : (
            <p className="text-sm text-[#626c65]">Le contact WhatsApp est momentanément indisponible.</p>
          )}
        </div>
      </div>
      <div className="container-custom grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Estimation de projet</p>
          <h2 id="calculator-title" className="mt-3 font-heading text-4xl font-medium leading-[1.08] text-foreground sm:text-5xl">
            Votre faux plafond, estimé pièce par pièce.
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">
            Indiquez la surface ou les dimensions de vos pièces. L’estimation utilise les tarifs et modèles configurés par l’entreprise; vos coordonnées ne sont demandées qu’après le calcul.
          </p>
          <div className="mt-6 flex items-center gap-3 border-t border-[#d9ddd5] pt-4 text-sm text-[#5f6b61]">
            <Ruler size={19} className="text-[#9d7049]" />
            Les mesures restent modifiables après notre visite technique.
          </div>
        </div>
        <div className="min-w-0 border border-[#e2e8e2] bg-white p-4 sm:p-6 lg:p-7">
          <div className="mb-6 flex items-center gap-3 border-b border-[#ecefea] pb-5">
            <span className="grid size-10 shrink-0 place-items-center bg-[#f0f4f0] text-[#315c40]">
              <Calculator size={19} />
            </span>
            <div>
              <h3 className="text-sm font-semibold">Calculateur multi-pièces</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Surface totale : <strong className="text-foreground">{totalArea.toLocaleString("fr-FR")} m²</strong>
              </p>
            </div>
          </div>
          <form onSubmit={calculate} className="space-y-5">
            <div className="border-b border-[#e8ede8] pb-3">
              <div className="flex items-center justify-between gap-3 text-xs sm:hidden">
                <span className="text-muted-foreground">Étape {step + 1} sur {steps.length}</span>
                <strong className="text-right font-semibold text-foreground">{steps[step].label}</strong>
              </div>
              <div className="mt-3 h-1 overflow-hidden bg-[#edf0ed] sm:hidden">
                <div className="h-full bg-[#315c40] transition-[width] motion-reduce:transition-none" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
              </div>
              <div className="hidden flex-wrap items-center gap-2 sm:flex">
              {steps.map((entry, index) => {
                const Icon = entry.icon;
                return <span key={entry.label} aria-current={index === step ? "step" : undefined} className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold ${index === step ? "bg-[#294b35] text-white" : "text-[#758078]"}`}><Icon size={12} />{index + 1}. {entry.label}</span>;
              })}
              </div>
            </div>
            <div className="space-y-4">
              {building.floors.map((floor, floorIndex) => (
                <section key={floor.id} className="space-y-3 border border-[#d9d4c9] bg-white p-3 sm:p-4">
                  {step === 0 && (
                  <div className="flex items-end gap-2">
                    <label className="flex-1 text-xs font-semibold text-[#526b57]">Étage
                      <input className={inputClass} value={floor.name} onChange={(event) => updateFloor(floor.id, (current) => ({ ...current, name: event.target.value }))} required />
                    </label>
                    <button type="button" onClick={() => moveFloor(floorIndex, -1)} disabled={floorIndex === 0} aria-label="Monter l’étage" className="grid size-10 shrink-0 place-items-center border border-[#dedbd3] disabled:opacity-40"><ArrowUp size={15} /></button>
                    <button type="button" onClick={() => moveFloor(floorIndex, 1)} disabled={floorIndex === building.floors.length - 1} aria-label="Descendre l’étage" className="grid size-10 shrink-0 place-items-center border border-[#dedbd3] disabled:opacity-40"><ArrowDown size={15} /></button>
                    {building.floors.length > 1 && <button type="button" onClick={() => setBuilding((current) => ({ floors: current.floors.filter((entry) => entry.id !== floor.id) }))} aria-label="Supprimer l’étage" className="grid size-10 shrink-0 place-items-center border border-[#ead6d1] text-[#8a4d43]"><Trash2 size={15} /></button>}
                  </div>
                  )}
                  {floor.apartments.map((apartment) => (
                    <div key={apartment.id} className="space-y-3 border-t border-[#efede7] pt-3">
                      {step === 1 && (
                      <div className="flex items-end gap-2">
                        <label className="flex-1 text-xs font-semibold text-[#526b57]">Appartement
                          <input className={inputClass} value={apartment.name} onChange={(event) => updateApartment(floor.id, apartment.id, (current) => ({ ...current, name: event.target.value }))} required />
                        </label>
                        {floor.apartments.length > 1 && <button type="button" onClick={() => updateFloor(floor.id, (current) => ({ ...current, apartments: current.apartments.filter((entry) => entry.id !== apartment.id) }))} aria-label="Supprimer l’appartement" className="grid size-10 shrink-0 place-items-center border border-[#ead6d1] text-[#8a4d43]"><Trash2 size={15} /></button>}
                      </div>
                      )}
                      {(step === 2 || step === 3) && <h4 className="text-sm font-semibold text-[#526b57]">{floor.name} · {apartment.name}</h4>}
                      {(step === 2 || step === 3) && <>
                      {apartment.rooms.map((room) => (
                        <div key={room.id} className="border border-[#e8e5de] bg-[#fbfaf7] p-3">
                          {step === 2 && (
                          <>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <label className="text-xs font-medium text-[#6c7169]">Type de pièce
                              <select className={inputClass} value={room.type} onChange={(event) => updateRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, type: event.target.value, name: event.target.value === "Autre" ? "" : `${event.target.value} ${apartment.rooms.filter((entry) => entry.type === event.target.value).length + 1}` }))}>
                                {roomTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                              </select>
                            </label>
                            <label className="text-xs font-medium text-[#6c7169]">Nom de la pièce
                              <input className={inputClass} value={room.name} onChange={(event) => updateRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, name: event.target.value }))} required />
                            </label>
                            <label className="text-xs font-medium text-[#6c7169]">Surface (m²)
                              <NumericInput className={inputClass} min="0.1" step="0.1" value={room.area} onChange={(event) => updateRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, area: event.target.value === "" ? "" : Number(event.target.value) }))} required />
                            </label>
                            <label className="text-xs font-medium text-[#6c7169]">Type de plafond de cette pièce *
                              <select className={inputClass} value={room.ceilingTypeKey} onChange={(event) => {
                                if (ceiling.modelId !== null) deselectModel();
                                updateRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, ceilingTypeKey: event.target.value }));
                              }} required>
                                {areaPrices.map((price) => <option key={price.key} value={price.key}>{price.name} · {formatCurrency(price.rate)}/m²</option>)}
                              </select>
                            </label>
                          </div>
                          {apartment.rooms.length > 1 && <button type="button" onClick={() => updateApartment(floor.id, apartment.id, (current) => ({ ...current, rooms: current.rooms.filter((entry) => entry.id !== room.id) }))} aria-label={`Supprimer ${room.name}`} className="mt-2 p-2 text-xs text-[#8c6960]"><Trash2 size={14} /> Supprimer la pièce</button>}
                          </>
                          )}
                          {step === 3 && <p className="text-xs font-semibold text-[#526b57]">{room.name}</p>}
                          {step === 3 && (
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <label className="flex items-center gap-2 text-xs text-[#526b57]">
                              <input type="checkbox" checked={Boolean(room.bathroom)} onChange={(event) => updateRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, bathroom: event.target.checked ? current.bathroom || makeSpace("Salle de bain", "Salle de bain", room.ceilingTypeKey) : undefined }))} />
                              Ajouter une salle de bain à cette pièce
                            </label>
                            <span className="text-xs font-medium text-[#815d3e]">{formatCurrency(Number(room.area || 0) * (areaPrices.find((price) => price.key === room.ceilingTypeKey)?.rate || 0))}</span>
                            {apartment.rooms.length > 1 && <button type="button" onClick={() => updateApartment(floor.id, apartment.id, (current) => ({ ...current, rooms: current.rooms.filter((entry) => entry.id !== room.id) }))} aria-label={`Supprimer ${room.name}`} className="p-2 text-[#8c6960]"><Trash2 size={15} /></button>}
                          </div>
                          )}
                          {step === 3 && room.bathroom && (
                            <div className="mt-3 grid gap-3 border-t border-[#efede7] pt-3 sm:grid-cols-3">
                              <p className="self-center text-xs font-semibold text-[#526b57]">↳ Salle de bain de {room.name}</p>
                              <label className="text-xs font-medium text-[#6c7169]">Nom
                                <input className={inputClass} value={room.bathroom.name} onChange={(event) => updateRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, bathroom: current.bathroom ? { ...current.bathroom, name: event.target.value } : undefined }))} required />
                              </label>
                              <label className="text-xs font-medium text-[#6c7169]">Surface (m²)
                                <NumericInput className={inputClass} min="0.1" step="0.1" value={room.bathroom.area} onChange={(event) => updateRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, bathroom: current.bathroom ? { ...current.bathroom, area: event.target.value === "" ? "" : Number(event.target.value) } : undefined }))} required />
                              </label>
                              <label className="text-xs font-medium text-[#6c7169]">Type de plafond de cette salle de bain *
                                <select className={inputClass} value={room.bathroom.ceilingTypeKey} onChange={(event) => {
                                  if (ceiling.modelId !== null) deselectModel();
                                  updateRoom(floor.id, apartment.id, room.id, (current) => ({ ...current, bathroom: current.bathroom ? { ...current.bathroom, ceilingTypeKey: event.target.value } : undefined }));
                                }} required>
                                  {areaPrices.map((price) => <option key={price.key} value={price.key}>{price.name} · {formatCurrency(price.rate)}/m²</option>)}
                                </select>
                              </label>
                            </div>
                          )}
                        </div>
                      ))}
                      </>}
                      {step === 2 && (
                      <button type="button" onClick={() => updateApartment(floor.id, apartment.id, (current) => ({ ...current, rooms: [...current.rooms, makeSpace("Chambre", `Chambre ${current.rooms.length + 1}`, ceiling.typeKey)] }))} className="flex items-center gap-2 text-xs font-semibold text-[#526b57]"><Plus size={15} /> Ajouter une pièce</button>
                      )}
                    </div>
                  ))}
                  {step === 1 && (
                  <button type="button" onClick={() => updateFloor(floor.id, (current) => ({ ...current, apartments: [...current.apartments, { id: newId(), name: `Appartement ${current.apartments.length + 1}`, rooms: [makeSpace("Chambre", "Chambre 1", ceiling.typeKey)] }] }))} className="flex items-center gap-2 text-xs font-semibold text-[#526b57]"><Plus size={15} /> Ajouter un appartement</button>
                  )}
                </section>
              ))}
              {step === 0 && (
              <button type="button" onClick={() => setBuilding((current) => ({ floors: [...current.floors, { id: newId(), name: `${current.floors.length + 1}e étage`, apartments: [{ id: newId(), name: "Appartement 1", rooms: [makeSpace("Chambre", "Chambre 1", ceiling.typeKey)] }] }] }))} className="flex items-center gap-2 text-xs font-semibold text-[#526b57]"><Plus size={15} /> Ajouter un étage</button>
              )}
            </div>

            {step === 4 && <>
            <div>
              {(() => {
                const typeModels = modelTypeKey ? models.filter((model) => model.ceilingTypeKey === modelTypeKey) : [];
                if (!typeModels.length) return null;
                return (
                  <div className="mt-4">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-[#a97850]"><Sparkles size={12} />MODÈLE DE PLAFOND POUR TOUTES LES PIÈCES — FACULTATIF</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {typeModels.map((model) => {
                        const selected = ceiling.modelId === model.id;
                        const lamps = model.lightingLayout.reduce((total, point) => total + point.quantity, 0);
                        return (
                          <div key={model.id} className={`flex flex-col border bg-white ${selected ? "border-[#a97850] ring-1 ring-[#a97850]/30" : "border-[#e8e5de]"}`}>
                            <button type="button" onClick={() => setDetailModel(model)} className="relative block h-32 overflow-hidden text-left" aria-label={`Voir le modèle ${model.title}`}>
                              <img src={model.imageUrl} alt={model.title} loading="lazy" className="h-full w-full object-cover" />
                              {selected && <span className="absolute right-2 top-2 bg-[#293b32] px-2 py-0.5 text-[10px] font-semibold text-white">Sélectionné</span>}
                            </button>
                            <div className="flex flex-1 flex-col p-3">
                              <p className="text-sm font-semibold">{model.title}</p>
                              {model.description && <p className="mt-1 line-clamp-2 text-xs text-[#72766e]">{model.description}</p>}
                              <p className="mt-2 text-xs text-[#815d3e]">Tarif du type : {formatCurrency(areaPrices.find((price) => price.key === model.ceilingTypeKey)?.rate || 0)}/m²{lamps > 0 ? ` · ${lamps} point(s) lumineux` : ""}</p>
                              <p className="text-[11px] text-[#85877f]">Surface recommandée : {model.minArea || 0}–{model.maxArea || "∞"} m²</p>
                              <div className="mt-3 flex gap-2">
                                <button type="button" onClick={() => (selected ? deselectModel() : chooseModel(model))} className={`min-h-9 flex-1 px-3 text-xs font-semibold ${selected ? "border border-[#dedbd3]" : "bg-[#293b32] text-white"}`}>
                                  {selected ? "Retirer le modèle" : "Choisir ce modèle"}
                                </button>
                                <button type="button" onClick={() => setDetailModel(model)} className="min-h-9 border border-[#dedbd3] px-2.5 text-xs hover:bg-[#f7f6f2]">Détails</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[11px] text-[#85877f]">Sans modèle, le tarif standard du type sélectionné s’applique.</p>
                  </div>
                );
              })()}
            </div>

            {selectedModel && lightingPoints.length > 0 && (
              <fieldset className="space-y-3 border-t border-[#ece9e2] pt-5">
                <legend className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-[#29352f]"><Lightbulb size={15} className="text-[#a97850]" />Éclairage du modèle</legend>
                <p className="text-xs text-[#72766e]">Choisissez les luminaires du catalogue Khalil Déco pour chaque point lumineux du modèle « {selectedModel.title} ».</p>
                {lightingPoints.map((point) => {
                  const products = lightingProducts[point.productType] || [];
                  const chosen = products.find((product) => product.id === lightingSelections[point.key]);
                  return (
                    <div key={point.key} className="border border-[#e8e5de] bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{point.name} <span className="font-normal text-[#85877f]">× {point.quantity} · {point.position}{point.required ? " · obligatoire" : " · facultatif"}</span></p>
                        <span className="text-[10px] uppercase tracking-wide text-[#a97850]">{point.productType}</span>
                      </div>
                      {chosen ? (
                        <div className="mt-2 flex items-center gap-3">
                          {chosen.image ? <img src={chosen.image} alt="" className="size-12 object-cover" /> : <span className="grid size-12 place-items-center bg-[#f2f0ea]"><ImageIcon size={14} className="text-[#a5a89f]" /></span>}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{chosen.name}</p>
                            <p className="text-[11px] text-[#815d3e]">{formatCurrency(chosen.price)} × {point.quantity}</p>
                          </div>
                          <button type="button" onClick={() => setLightingSelections({ ...lightingSelections, [point.key]: "" })} className="min-h-9 border border-[#dedbd3] px-2 text-xs">Changer</button>
                        </div>
                      ) : (
                        <div className="mt-2 space-y-1.5">
                          {products.length === 0 && <p className="text-xs text-[#85877f]">Catalogue éclairage momentanément indisponible pour ce type.</p>}
                          {products.map((product) => (
                            <button type="button" key={product.id} onClick={() => setLightingSelections({ ...lightingSelections, [point.key]: product.id })} className="flex w-full items-center gap-3 border border-[#efede7] p-2 text-left hover:border-[#c9b69f] hover:bg-[#fffdfa]">
                              {product.image ? <img src={product.image} alt="" className="size-10 object-cover" /> : <span className="grid size-10 place-items-center bg-[#f2f0ea]"><ImageIcon size={14} className="text-[#a5a89f]" /></span>}
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-medium">{product.name}</span>
                                <span className="block text-[11px] text-[#85877f]">Réf. {product.sku}</span>
                              </span>
                              <span className="text-xs font-semibold text-[#815d3e]">{formatCurrency(product.price)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </fieldset>
            )}

            {optionPrices.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-[#6c7169]">Prestations complémentaires</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {optionPrices.map((price) => (
                    <div key={price.key} className="space-y-2 border border-[#e8e5de] bg-white p-3">
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={Boolean(extras[price.key])} onChange={(event) => setExtras((current) => ({ ...current, [price.key]: event.target.checked ? (price.calculation === "linear" ? Math.round(Math.sqrt(totalArea) * 4 * 10) / 10 : 1) : 0 }))} />
                        <span>{price.name}</span>
                        <span className="ml-auto text-[#85877f]">{price.key === "transport" ? (transportZone === "dakar" ? `${formatCurrency(price.rate)} · Dakar` : "Hors Dakar · à discuter") : price.unit}</span>
                      </label>
                      {price.key === "transport" && Boolean(extras.transport) && (
                        <>
                          <label className="block text-xs font-medium text-[#6c7169]">Zone de déplacement
                            <select className={inputClass} value={transportZone} onChange={(event) => setTransportZone(event.target.value as "dakar" | "hors_dakar")}>
                              <option value="dakar">Dakar · {formatCurrency(price.rate)}</option>
                              <option value="hors_dakar">Hors Dakar · à discuter</option>
                            </select>
                          </label>
                          {transportZone === "hors_dakar" && <p className="text-xs text-[#815d3e]">Les frais de déplacement hors Dakar sont à discuter et ne sont pas inclus dans le total estimatif.</p>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {supplementalServices.length > 0 && (
              <fieldset className="space-y-3 border-t border-[#ece9e2] pt-5">
                <legend className="mb-2 text-sm font-semibold text-[#29352f]">Prestations supplémentaires</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {supplementalServices.map((service) => (
                    <div key={service.id} className="border border-[#e8e5de] bg-white p-3">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input type="checkbox" checked={Boolean(additionalSelections[service.id])} onChange={(event) => setAdditionalSelections((current) => ({ ...current, [service.id]: event.target.checked ? 1 : 0 }))} className="mt-1" />
                        {service.photoUrl && <img src={service.photoUrl} alt="" loading="lazy" className="size-14 shrink-0 object-cover" />}
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-[#29352f]">{service.name}</span>
                          {service.description && <span className="mt-1 block text-xs leading-5 text-[#72766e]">{service.description}</span>}
                          <span className="mt-2 block text-xs text-[#815d3e]">{formatCurrency(service.price)} {service.pricingType === "area" ? "/ m²" : service.pricingType === "fixed" ? "· forfait" : "/ " + service.unit}</span>
                        </span>
                      </label>
                      {additionalSelections[service.id] && service.pricingType !== "fixed" && service.pricingType !== "area" && (
                        <label className="mt-3 block text-xs font-medium text-[#6c7169]">Quantité
                          <NumericInput min="0.1" step="0.1" value={additionalSelections[service.id]} onChange={(event) => setAdditionalSelections((current) => ({ ...current, [service.id]: Number(event.target.value) }))} className={inputClass} />
                        </label>
                      )}
                      {additionalSelections[service.id] && service.pricingType === "area" && <p className="mt-2 text-xs text-[#72766e]">Surface du projet : {totalArea.toLocaleString("fr-FR")} m²</p>}
                    </div>
                  ))}
                </div>
              </fieldset>
            )}

            <button disabled={busy || !prices.length} className="flex w-full items-center justify-center gap-2 bg-[#293b32] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#354b3f] disabled:opacity-50">
              {busy ? "Calcul en cours…" : "Calculer mon estimation"}
              <ArrowRight size={16} />
            </button>
            </>}
            <div className="flex justify-between gap-3 border-t border-[#e8e5de] pt-4">
              <button type="button" disabled={step === 0 || busy} onClick={() => setStep((current) => Math.max(0, current - 1))} className="inline-flex min-h-10 items-center gap-2 border border-[#dedbd3] px-4 text-xs font-medium disabled:opacity-40"><ArrowLeft size={14} /> Retour</button>
              {step < 4 && <button type="button" disabled={busy} onClick={goNext} className="inline-flex min-h-10 items-center gap-2 bg-[#293b32] px-4 text-xs font-semibold text-white disabled:opacity-60">Continuer<ArrowRight size={14} /></button>}
            </div>
          </form>

          {error && (
            <p role="alert" className="mt-4 border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>
          )}

          {estimate && step === 4 && (
            <div className="mt-6 border-t border-[#e8e5de] pt-5">
              <p className="text-xs text-[#777b73]">Estimation indicative · {estimate.project.totalArea} m²</p>
              <p className="mt-1 font-heading text-4xl font-semibold text-[#293b32]">{formatCurrency(estimate.totals.total)}</p>
              <p className="mt-1 text-[11px] text-[#85877f]">TOTAL ESTIMATIF calculé par notre serveur. Vos coordonnées ne sont demandées que pour recevoir la proposition détaillée.</p>
              <div className="mt-4 space-y-2 border-y border-[#efede7] py-3">
                {estimate.items.map((item) => (
                  <div key={item.key} className="flex justify-between gap-4 text-xs">
                    <span className="text-[#676d65]">{item.label} · {item.quantity} {item.unit}</span>
                    <span className="shrink-0 font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {estimate && step === 4 && (
            <form onSubmit={submitRequest} className="mt-6 space-y-3 border border-[#e8e5de] bg-white p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Check size={17} className="text-[#65806a]" />
                <p className="text-sm font-semibold text-[#29352f]">Recevez votre devis détaillé</p>
              </div>
              <p className="text-xs text-[#72766e]">Laissez vos coordonnées, nous vous recontactons rapidement.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-[#6c7169]">
                  Nom complet *
                  <input className={inputClass} required value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} />
                </label>
                <label className="text-xs font-medium text-[#6c7169]">
                  WhatsApp *
                  <input className={inputClass} type="tel" required autoComplete="tel" placeholder="Ce numéro sert aussi de téléphone" value={customer.whatsapp} onChange={(event) => setCustomer({ ...customer, whatsapp: event.target.value })} />
                </label>
                <label className="text-xs font-medium text-[#6c7169]">
                  E-mail (facultatif)
                  <input className={inputClass} type="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} />
                </label>
                <label className="text-xs font-medium text-[#6c7169] sm:col-span-2">
                  Adresse du chantier *
                  <input className={inputClass} required maxLength={300} placeholder="Adresse complète du chantier" value={address} onChange={(event) => setAddress(event.target.value)} />
                </label>
              </div>
              <label className="block text-xs font-medium text-[#6c7169]">
                Décrivez votre projet (facultatif)
                <textarea className={`${inputClass} min-h-20`} maxLength={3000} placeholder="Ex. : faux plafond avec bandes LED dans le salon et la salle à manger…" value={description} onChange={(event) => setDescription(event.target.value)} />
              </label>
              {message && <p role="status" className="border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</p>}
              <button disabled={busy} className="flex w-full items-center justify-center gap-2 border border-[#b17d53] px-4 py-3 text-sm font-semibold text-[#815d3e] hover:bg-[#f7f1e9] disabled:opacity-50">
                {busy ? "Envoi…" : "Envoyer ma demande de devis"}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </div>
      </div>

      <Dialog open={Boolean(detailModel)} onOpenChange={(open) => { if (!open) setDetailModel(null); }}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] overflow-y-auto border-[#e8e5de] bg-[#fbfaf7] p-0 sm:max-w-2xl">
          {detailModel && (
            <>
              <img src={detailModel.imageUrl} alt={detailModel.title} className="h-52 w-full object-cover sm:h-72" />
              <DialogHeader className="px-5 pb-2 text-left sm:px-8">
                <DialogTitle className="font-heading text-2xl text-[#29352f]">{detailModel.title}</DialogTitle>
                <DialogDescription className="text-sm leading-6">{detailModel.description || "Modèle de faux plafond sur mesure."}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 px-5 pb-7 sm:px-8">
                <div className="grid gap-2 text-xs text-[#5f6b61] sm:grid-cols-2">
                  <p>Tarif du type : <strong className="text-[#815d3e]">{formatCurrency(areaPrices.find((price) => price.key === detailModel.ceilingTypeKey)?.rate || 0)}/m²</strong></p>
                  <p>Surface recommandée : {detailModel.minArea || 0}–{detailModel.maxArea || "∞"} m²</p>
                  <p>Points lumineux : {detailModel.lightingLayout.reduce((total, point) => total + point.quantity, 0)}</p>
                </div>
                {detailModel.lightingLayout.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-[#a97850]">DISPOSITION DE L’ÉCLAIRAGE</p>
                    <ul className="mt-2 grid gap-1.5 text-xs text-[#676d65] sm:grid-cols-2">
                      {detailModel.lightingLayout.map((point) => (
                        <li key={point.key} className="border border-[#efede7] bg-white px-3 py-2">{point.name} · × {point.quantity} · {point.position}{point.required ? " (requis)" : ""}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {detailModel.gallery.length > 1 && (
                  <div className="grid grid-cols-3 gap-2">
                    {detailModel.gallery.map((src) => <img key={src} src={src} alt="" loading="lazy" className="h-24 w-full object-cover" />)}
                  </div>
                )}
                <button type="button" onClick={() => { chooseModel(detailModel); setDetailModel(null); }} className="w-full bg-[#293b32] px-4 py-3 text-sm font-semibold text-white hover:bg-[#354b3f]">
                  Choisir ce modèle
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
