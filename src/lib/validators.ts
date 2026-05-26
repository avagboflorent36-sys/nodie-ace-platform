import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(8, "8 caractères minimum").max(72),
  firstName: z.string().trim().min(1, "Requis").max(80),
  lastName: z.string().trim().min(1, "Requis").max(80),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(1, "Requis").max(72),
});

export const inscriptionSchema = z.object({
  firstName: z.string().trim().min(1, "Requis").max(80),
  lastName: z.string().trim().min(1, "Requis").max(80),
  email: z.string().trim().email("Email invalide").max(255),
  whatsapp: z.string().trim().min(6, "Numéro WhatsApp invalide").max(30),
  country: z.string().trim().min(2, "Requis").max(60),
  paymentMode: z.enum(["full", "installments_2"]),
});

export type InscriptionInput = z.infer<typeof inscriptionSchema>;
