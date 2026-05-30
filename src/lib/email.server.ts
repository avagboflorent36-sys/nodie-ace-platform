// Server-only email helper (Resend). Never import from client code.
const EMAIL_FROM = process.env.EMAIL_FROM || "Nodie IA Academy <onboarding@resend.dev>";
const SITE_URL = process.env.SITE_URL || "https://futuretalents.me";

export function siteUrl(path = "/") {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY missing");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

export function wrapHtml(title: string, body: string) {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
    <h2 style="color:#0d0d0d;margin:0 0 16px">${title}</h2>
    ${body}
    <hr style="margin:24px 0;border:none;border-top:1px solid #e5e5e5"/>
    <p style="font-size:12px;color:#888">Nodie IA Academy</p>
  </div>`;
}
