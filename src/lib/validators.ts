import { ArcadeGameType, TransactionNetwork } from "@prisma/client";
import { z } from "zod";

export type FormState = {
  message?: string;
  errors?: Record<string, string[]>;
};

export const registerSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres.").trim(),
  email: z.email("Correo invalido.").trim(),
  password: z
    .string()
    .min(8, "La contrasena debe tener al menos 8 caracteres.")
    .regex(/[A-Za-z]/, "Debe incluir una letra.")
    .regex(/[0-9]/, "Debe incluir un numero.")
    .regex(/[^A-Za-z0-9]/, "Debe incluir un simbolo."),
});

export const loginSchema = z.object({
  email: z.email("Correo invalido.").trim(),
  password: z.string().min(1, "La contrasena es obligatoria."),
});

export const createMatchSchema = z.object({
  stakeAmount: z.coerce.number().min(0, "El stake no puede ser negativo."),
  entryFee: z.coerce.number().min(0, "El fee no puede ser negativo.").max(9999, "Fee demasiado alto."),
  gameClockMinutes: z.coerce.number().int().min(1, "Minimo 1 minuto.").max(30, "Maximo 30 minutos."),
  stakeToken: z.string().min(2).max(10).default("INIT"),
  network: z.nativeEnum(TransactionNetwork),
  arcadeGamePool: z.array(z.nativeEnum(ArcadeGameType)).min(1),
});

export const moveSchema = z.object({
  from: z.string().length(2),
  to: z.string().length(2),
  promotion: z.string().optional(),
});

export const duelAttemptSchema = z.object({
  startedAt: z.number().int().nonnegative(),
  finishedAt: z.number().int().positive(),
  actions: z.array(
    z.object({
      at: z.number().int().nonnegative(),
      value: z.string().min(1).max(12),
    }),
  ),
});

export const placeBetSchema = z.object({
  matchId: z.string().min(1, "La partida es obligatoria."),
  predictedWinnerId: z.string().min(1, "Debes elegir un jugador."),
  amount: z.coerce.number().positive("La apuesta debe ser mayor que cero.").max(999999, "La apuesta es demasiado alta."),
});
