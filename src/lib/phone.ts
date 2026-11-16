import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

// The workshop serves Senegal: a number typed without indicatif belongs to the company's own country.
const FALLBACK_COUNTRY: CountryCode = "SN";

function parse(value: string, country: CountryCode) {
  try {
    const parsed = parsePhoneNumberFromString(value, country);
    // A number can be parsed and still be impossible ("78289273" is one digit short):
    // WhatsApp would then open its home page instead of the conversation.
    return parsed && parsed.isValid() ? parsed : null;
  } catch {
    return null;
  }
}

/** Country the company operates in, read from its own WhatsApp number ("+221708289273" → "SN"). */
export function companyCountry(companyWhatsApp: string): CountryCode {
  return parse(companyWhatsApp, FALLBACK_COUNTRY)?.country ?? FALLBACK_COUNTRY;
}

/**
 * WhatsApp understands a dial number only in full international format, so every stored shape —
 * "+221 77 123 45 67", "00221 77 123 45 67", "221 77 123 45 67", "(77) 123-45-67", "70.82.89.27.3",
 * "77 123 45 67" without indicatif — is resolved before it is ever turned into a link.
 * Returns null when the number cannot exist: WhatsApp then must not be opened with it.
 */
export function normalizeWhatsapp(raw: string, companyWhatsApp = ""): { dial: string; label: string } | null {
  const value = raw.trim();
  if (!value) return null;

  const countries: CountryCode[] = [companyCountry(companyWhatsApp)];
  if (countries[0] !== FALLBACK_COUNTRY) countries.push(FALLBACK_COUNTRY);

  // A typed national trunk prefix ("077 123 45 67") is retried without it.
  for (const candidate of [value, value.replace(/^0+/, "")]) {
    if (!candidate) continue;
    for (const country of countries) {
      const parsed = parse(candidate, country);
      if (parsed?.number) return { dial: parsed.number.slice(1), label: parsed.formatInternational() };
    }
  }
  return null;
}

/** What the admin reads, plus the number WhatsApp can actually open. */
export function whatsappRecipient(phone: string, companyWhatsApp = ""): { label: string; dial: string | null } {
  const stored = phone.trim();
  if (!stored) return { label: "numéro à préciser dans WhatsApp", dial: null };

  const address = normalizeWhatsapp(stored, companyWhatsApp);
  if (address) return address;

  const problem = stored.replace(/\D/g, "").length < 9 ? "numéro incomplet" : "numéro invalide";
  return { label: `${stored} — ${problem}`, dial: null };
}

/**
 * wa.me is the only address that reaches the conversation on every device: it opens the WhatsApp
 * app on a phone and WhatsApp Web on a desktop. Returns null for an unresolvable number so the
 * caller never sends the browser to the WhatsApp home page, which reads as a blank screen.
 */
export function whatsappConversationUrl(dial: string | null): string | null {
  return dial ? `https://wa.me/${dial}` : null;
}

/** Prépare un message attribué au site, suivi seul de son URL pour permettre son aperçu. */
export function whatsappSiteMessageUrl(dial: string | null, message: string, siteUrl: string): string | null {
  const conversation = whatsappConversationUrl(dial);
  if (!conversation) return null;
  const website = siteUrl.trim().replace(/\/+$/, "");
  const text = `${message.trim()}\n\nMessage envoyé depuis le site web de Khalil Déco Plâtre.\n${website}`;
  return `${conversation}?text=${encodeURIComponent(text)}`;
}
