'use server';

import { randomUUID } from "node:crypto";
import { Chess } from "chess.js";
import { MatchStatus, TransactionStatus, TransactionType, TransactionNetwork, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, clearSession, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOnchainAdapter } from "@/lib/onchain/service";
import { createMatchSchema, FormState, loginSchema, registerSchema } from "@/lib/validators";

function parseBoolean(input: FormDataEntryValue | null | undefined) {
  return String(input ?? "").toLowerCase() === "true";
}

function parseDecimal(input: FormDataEntryValue | null | undefined, fallback = "0") {
  const raw = String(input ?? fallback);
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return value.toFixed(6);
}

function hasPositiveBalance(balance: string) {
  const numeric = Number(balance);
  return Number.isFinite(numeric) && numeric > 0;
}

function defaultWalletAddress(network: TransactionNetwork, userId: string) {
  return `${network.toLowerCase()}_${userId}`;
}

export async function registerAction(_: FormState | undefined, formData: FormData): Promise<FormState | void> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existingUser) {
    return {
      message: "Ya existe una cuenta con ese correo.",
    };
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      wallets: {
        create: [
          { network: TransactionNetwork.INITIA, address: defaultWalletAddress(TransactionNetwork.INITIA, randomUUID()), balance: "0" },
          { network: TransactionNetwork.FLOW, address: defaultWalletAddress(TransactionNetwork.FLOW, randomUUID()), balance: "0" },
          { network: TransactionNetwork.SOLANA, address: defaultWalletAddress(TransactionNetwork.SOLANA, randomUUID()), balance: "0" },
        ],
      },
    },
  });

  await createSession({ id: user.id, name: user.name, email: user.email, role: user.role });
  redirect("/dashboard");
}

export async function loginAction(_: FormState | undefined, formData: FormData): Promise<FormState | void> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return {
      message: "Credenciales invalidas.",
    };
  }

  await createSession({ id: user.id, name: user.name, email: user.email, role: user.role });
  redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/");
}

export async function createMatchAction(formData: FormData) {
  const session = await requireUser();
  const isSolo = parseBoolean(formData.get("isSolo"));
  const parsed = createMatchSchema.safeParse({
    title: formData.get("title"),
    theme: formData.get("theme"),
    stakeAmount: formData.get("stakeAmount"),
    stakeToken: formData.get("stakeToken"),
    network: formData.get("network"),
    arcadeGamePool: formData.getAll("arcadeGamePool"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "No se pudo crear la partida.");
  }

  const hostWallet = await prisma.wallet.findFirst({
    where: {
      userId: session.id,
      network: parsed.data.network,
    },
  });

  if (!hostWallet || !hasPositiveBalance(hostWallet.balance)) {
    throw new Error("Necesitas una billetera activa con balance en la red elegida para crear partidas.");
  }

  const matchId = randomUUID();
  const adapter = getOnchainAdapter(parsed.data.network);
  const receipt = await adapter.createEscrow({
    matchId,
    actorId: session.id,
    amount: parsed.data.stakeAmount.toFixed(6),
    token: parsed.data.stakeToken,
  });

  const match = await prisma.match.create({
    data: {
      id: matchId,
      title: parsed.data.title,
      theme: parsed.data.theme,
      stakeAmount: parsed.data.stakeAmount.toFixed(6),
      stakeToken: parsed.data.stakeToken.toUpperCase(),
      preferredNetwork: parsed.data.network,
      fen: new Chess().fen(),
      moveHistory: [],
      arcadeGamePool: parsed.data.arcadeGamePool,
      hostId: session.id,
      isSolo,
      status: isSolo ? MatchStatus.IN_PROGRESS : MatchStatus.OPEN,
    },
  });

  await prisma.transaction.create({
    data: {
      userId: session.id,
      matchId: match.id,
      network: parsed.data.network,
      type: TransactionType.ESCROW_LOCK,
      status: receipt.mode === "configured" ? TransactionStatus.PENDING : TransactionStatus.SETTLED,
      amount: parsed.data.stakeAmount.toFixed(6),
      token: parsed.data.stakeToken.toUpperCase(),
      txHash: receipt.txHash,
      metadata: { description: receipt.description, mode: receipt.mode },
    },
  });

  revalidatePath("/");
  revalidatePath("/lobby");
  redirect(`/match/${match.id}`);
}

export async function joinMatchAction(formData: FormData) {
  const session = await requireUser();
  const matchId = String(formData.get("matchId") ?? "");

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.isSolo || match.hostId === session.id || match.guestId || match.status !== MatchStatus.OPEN) {
    throw new Error("La partida ya no esta disponible.");
  }

  const guestWallet = await prisma.wallet.findFirst({
    where: {
      userId: session.id,
      network: match.preferredNetwork,
    },
  });

  if (!guestWallet || !hasPositiveBalance(guestWallet.balance)) {
    throw new Error("Necesitas una billetera activa con balance en esta red para unirte.");
  }

  const adapter = getOnchainAdapter(match.preferredNetwork);
  const receipt = await adapter.joinEscrow({
    matchId,
    actorId: session.id,
    amount: match.stakeAmount.toFixed(6),
    token: match.stakeToken,
  });

  await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data: {
        guestId: session.id,
        status: MatchStatus.IN_PROGRESS,
      },
    }),
    prisma.transaction.create({
      data: {
        userId: session.id,
        matchId,
        network: match.preferredNetwork,
        type: TransactionType.ENTRY_STAKE,
        status: receipt.mode === "configured" ? TransactionStatus.PENDING : TransactionStatus.SETTLED,
        amount: match.stakeAmount.toFixed(6),
        token: match.stakeToken,
        txHash: receipt.txHash,
        metadata: { description: receipt.description, mode: receipt.mode },
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/lobby");
  redirect(`/match/${matchId}`);
}

export async function updateUserAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "USER");

  if (!userId || !Object.values(UserRole).includes(role as UserRole)) {
    throw new Error("Datos de usuario invalidos.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: role as UserRole },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
}

export async function deleteUserAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) {
    throw new Error("Usuario invalido.");
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
}

export async function updateTransactionAction(formData: FormData) {
  await requireAdmin();
  const transactionId = String(formData.get("transactionId") ?? "");
  const status = String(formData.get("status") ?? "PENDING");

  if (!transactionId || !Object.values(TransactionStatus).includes(status as TransactionStatus)) {
    throw new Error("Transaccion invalida.");
  }

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { status: status as TransactionStatus },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/transacciones");
}

export async function updateMatchStatusAction(formData: FormData) {
  await requireAdmin();
  const matchId = String(formData.get("matchId") ?? "");
  const status = String(formData.get("status") ?? MatchStatus.OPEN);

  if (!matchId || !Object.values(MatchStatus).includes(status as MatchStatus)) {
    throw new Error("Partida invalida.");
  }

  await prisma.match.update({
    where: { id: matchId },
    data: { status: status as MatchStatus },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/mesas");
}

export async function updateWalletNetworkAction(formData: FormData) {
  await requireAdmin();
  const walletId = String(formData.get("walletId") ?? "");
  const network = String(formData.get("network") ?? TransactionNetwork.INITIA);
  const balance = parseDecimal(formData.get("balance"), "0");

  if (!walletId || !Object.values(TransactionNetwork).includes(network as TransactionNetwork)) {
    throw new Error("Billetera invalida.");
  }

  await prisma.wallet.update({
    where: { id: walletId },
    data: {
      network: network as TransactionNetwork,
      balance,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/redes");
}

export async function upsertPlanAction(formData: FormData) {
  await requireAdmin();
  const planId = String(formData.get("planId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const token = String(formData.get("token") ?? "INIT").toUpperCase();
  const price = parseDecimal(formData.get("price"), "0");
  const features = String(formData.get("features") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const isActive = parseBoolean(formData.get("isActive"));

  if (!name || !description) {
    throw new Error("Nombre y descripcion son obligatorios.");
  }

  if (planId) {
    await prisma.plan.update({
      where: { id: planId },
      data: {
        name,
        description,
        token,
        price,
        features,
        isActive,
      },
    });
  } else {
    await prisma.plan.create({
      data: {
        name,
        description,
        token,
        price,
        features,
        isActive,
      },
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/planes");
}

export async function deletePlanAction(formData: FormData) {
  await requireAdmin();
  const planId = String(formData.get("planId") ?? "");
  if (!planId) {
    throw new Error("Plan invalido.");
  }

  await prisma.plan.delete({ where: { id: planId } });
  revalidatePath("/admin");
  revalidatePath("/admin/planes");
}
