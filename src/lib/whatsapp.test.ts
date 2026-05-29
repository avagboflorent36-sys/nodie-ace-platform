import { describe, it, expect } from "bun:test";
import {
  buildWhatsAppHref,
  isValidWhatsAppNumber,
  normalizeWhatsAppNumber,
} from "./whatsapp";

describe("normalizeWhatsAppNumber", () => {
  it("retire les espaces, tirets et le signe +", () => {
    expect(normalizeWhatsAppNumber("+225 07 12-34 56 78")).toBe("2250712345678");
  });

  it("retire le préfixe international « 00 »", () => {
    expect(normalizeWhatsAppNumber("0033612345678")).toBe("33612345678");
  });

  it("gère null / undefined / vide", () => {
    expect(normalizeWhatsAppNumber(null)).toBe("");
    expect(normalizeWhatsAppNumber(undefined)).toBe("");
    expect(normalizeWhatsAppNumber("")).toBe("");
  });
});

describe("isValidWhatsAppNumber", () => {
  it("accepte un numéro international complet", () => {
    expect(isValidWhatsAppNumber("+225 07 12 34 56 78")).toBe(true);
  });

  it("refuse un numéro trop court", () => {
    expect(isValidWhatsAppNumber("12345")).toBe(false);
    expect(isValidWhatsAppNumber(null)).toBe(false);
  });
});

describe("buildWhatsAppHref", () => {
  it("retourne null pour un numéro invalide", () => {
    expect(buildWhatsAppHref("123", "Alice")).toBeNull();
    expect(buildWhatsAppHref(null, "Alice")).toBeNull();
  });

  it("construit une URL wa.me ouvrant la conversation avec le bon numéro", () => {
    const href = buildWhatsAppHref("+225 07 12 34 56 78", "Awa");
    expect(href).not.toBeNull();
    const url = new URL(href!);
    expect(url.origin).toBe("https://wa.me");
    // wa.me/<digits> — le pathname commence par /<digits>
    expect(url.pathname).toBe("/2250712345678");
  });

  it("préremplit le message avec le prénom de l'étudiant (force l'ouverture de la conversation)", () => {
    const href = buildWhatsAppHref("33612345678", "Awa")!;
    const url = new URL(href);
    expect(url.searchParams.get("text")).toBe("Bonjour Awa,");
  });

  it("gère un prénom manquant sans casser l'URL", () => {
    const href = buildWhatsAppHref("33612345678", null)!;
    const url = new URL(href);
    expect(url.searchParams.get("text")).toBe("Bonjour,");
  });

  it("normalise un numéro avec préfixe 00 (équivalent à +)", () => {
    const a = buildWhatsAppHref("0033612345678", "X");
    const b = buildWhatsAppHref("+33612345678", "X");
    expect(a).toBe(b);
  });
});
