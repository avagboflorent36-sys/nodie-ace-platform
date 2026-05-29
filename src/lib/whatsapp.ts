/**
 * Normalise un numéro WhatsApp en chiffres E.164 (sans le « + »).
 * - retire tous les caractères non numériques
 * - retire un éventuel préfixe international « 00 »
 */
export function normalizeWhatsAppNumber(raw: string | null | undefined): string {
  return String(raw ?? "")
    .replace(/\D/g, "")
    .replace(/^00/, "");
}

export function isValidWhatsAppNumber(raw: string | null | undefined): boolean {
  return normalizeWhatsAppNumber(raw).length >= 8;
}

/**
 * Construit l'URL wa.me ouvrant une conversation avec un étudiant.
 * Retourne null si le numéro est invalide.
 */
export function buildWhatsAppHref(
  raw: string | null | undefined,
  firstName?: string | null,
): string | null {
  const digits = normalizeWhatsAppNumber(raw);
  if (digits.length < 8) return null;
  const greeting = `Bonjour ${firstName ?? ""},`.trim();
  return `https://wa.me/${digits}?text=${encodeURIComponent(greeting)}`;
}
