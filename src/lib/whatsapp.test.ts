import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  buildWhatsAppHref,
  isValidWhatsAppNumber,
  normalizeWhatsAppNumber,
} from "./whatsapp";

describe("normalizeWhatsAppNumber", () => {
  it("retire les espaces, tirets et le signe +", () => {
    assert.equal(normalizeWhatsAppNumber("+225 07 12-34 56 78"), "2250712345678");
  });

  it("retire le préfixe international « 00 »", () => {
    assert.equal(normalizeWhatsAppNumber("0033612345678"), "33612345678");
  });

  it("gère null / undefined / vide", () => {
    assert.equal(normalizeWhatsAppNumber(null), "");
    assert.equal(normalizeWhatsAppNumber(undefined), "");
    assert.equal(normalizeWhatsAppNumber(""), "");
  });
});

describe("isValidWhatsAppNumber", () => {
  it("accepte un numéro international complet", () => {
    assert.equal(isValidWhatsAppNumber("+225 07 12 34 56 78"), true);
  });

  it("refuse un numéro trop court ou vide", () => {
    assert.equal(isValidWhatsAppNumber("12345"), false);
    assert.equal(isValidWhatsAppNumber(null), false);
  });
});

describe("buildWhatsAppHref", () => {
  it("retourne null pour un numéro invalide", () => {
    assert.equal(buildWhatsAppHref("123", "Alice"), null);
    assert.equal(buildWhatsAppHref(null, "Alice"), null);
  });

  it("construit une URL wa.me ouvrant la conversation avec le bon numéro", () => {
    const href = buildWhatsAppHref("+225 07 12 34 56 78", "Awa");
    assert.ok(href);
    const url = new URL(href!);
    assert.equal(url.origin, "https://wa.me");
    assert.equal(url.pathname, "/2250712345678");
  });

  it("préremplit le message avec le prénom de l'étudiant (force l'ouverture de la conversation)", () => {
    const href = buildWhatsAppHref("33612345678", "Awa")!;
    const url = new URL(href);
    assert.equal(url.searchParams.get("text"), "Bonjour Awa,");
  });

  it("gère un prénom manquant sans casser l'URL", () => {
    const href = buildWhatsAppHref("33612345678", null)!;
    const url = new URL(href);
    assert.equal(url.searchParams.get("text"), "Bonjour,");
  });

  it("normalise un numéro avec préfixe 00 comme équivalent à +", () => {
    assert.equal(
      buildWhatsAppHref("0033612345678", "X"),
      buildWhatsAppHref("+33612345678", "X"),
    );
  });
});
