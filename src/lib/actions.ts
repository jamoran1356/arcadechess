'use server';

import { randomUUID } from "node:crypto";
import { Chess } from "chess.js";
import { MatchStatus, TransactionStatus, TransactionType, TransactionNetwork, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSession, clearSession, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOnchainAdapter } from "@/lib/onchain/service";
import { createMatchSchema, FormState, loginSchema, placeBetSchema, registerSchema } from "@/lib/validators";

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

const DEMO_AUTO_TOPUP_AMOUNT = Number(process.env.DEMO_AUTO_TOPUP_AMOUNT ?? "25");

async function getOrCreateWalletForNetwork(userId: string, network: TransactionNetwork) {
  const existing = await prisma.wallet.findFirst({
    where: { userId, network },
  });

  if (existing) {
    return existing;
  }

  return prisma.wallet.create({
    data: {
      userId,
      network,
      address: defaultWalletAddress(network, randomUUID()),
      balance: "0",
    },
  });
}

async function ensurePlayableWallet(userId: string, network: TransactionNetwork) {
  const wallet = await getOrCreateWalletForNetwork(userId, network);

  if (hasPositiveBalance(wallet.balance)) {
    return { wallet, autoFunded: false };
  }

  const nextBalance = Number.isFinite(DEMO_AUTO_TOPUP_AMOUNT) && DEMO_AUTO_TOPUP_AMOUNT > 0
    ? DEMO_AUTO_TOPUP_AMOUNT.toFixed(6)
    : "25.000000";

  const updated = await prisma.wallet.update({
    where: { id: wallet.id },
    data: { balance: nextBalance },
  });

  return { wallet: updated, autoFunded: true };
}

async function resolveSessionUser(session: { id: string; email: string; name: string; role: UserRole }) {
  const byId = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, name: true, role: true },
  });

  if (byId) {
    return byId;
  }

  const byEmail = await prisma.user.findUnique({
    where: { email: session.email },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!byEmail) {
    await clearSession();
    throw new Error("Sesion invalida o expirada. Inicia sesion nuevamente.");
  }

  // Rehidrata la cookie con el id actual del usuario para evitar FK rotas.
  await createSession({
    id: byEmail.id,
    email: byEmail.email,
    name: byEmail.name,
    role: byEmail.role,
  });

  return byEmail;
}

export async function registerAction(_: FormState | void | undefined, formData: FormData): Promise<FormState | void> {
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

export async function loginAction(_: FormState | void | undefined, formData: FormData): Promise<FormState | void> {
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
  const currentUser = await resolveSessionUser(session);
  const isSolo = parseBoolean(formData.get("isSolo"));
  const parsed = createMatchSchema.safeParse({
    title: formData.get("title"),
    theme: formData.get("theme"),
    stakeAmount: formData.get("stakeAmount"),
    entryFee: formData.get("entryFee"),
    gameClockMinutes: formData.get("gameClockMinutes"),
    stakeToken: formData.get("stakeToken"),
    network: formData.get("network"),
    arcadeGamePool: formData.getAll("arcadeGamePool"),
  });

  if (!parsed.success) {
    throw new Error(Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "No se pudo crear la partida.");
  }

  const { autoFunded: hostAutoFunded } = await ensurePlayableWallet(currentUser.id, parsed.data.network);

  const matchId = randomUUID();
  const hostTotalLock = (parsed.data.stakeAmount + parsed.data.entryFee).toFixed(6);
  const adapter = getOnchainAdapter(parsed.data.network);
  const receipt = await adapter.createEscrow({
    matchId,
    actorId: currentUser.id,
    amount: hostTotalLock,
    token: parsed.data.stakeToken,
  });

  const match = await prisma.match.create({
    data: {
      id: matchId,
      title: parsed.data.title,
      theme: parsed.data.theme,
      stakeAmount: parsed.data.stakeAmount.toFixed(6),
      entryFee: parsed.data.entryFee.toFixed(6),
      stakeToken: parsed.data.stakeToken.toUpperCase(),
      preferredNetwork: parsed.data.network,
      gameClockMs: parsed.data.gameClockMinutes * 60_000,
      fen: new Chess().fen(),
      moveHistory: [],
        arcadeGamePool: parsed.data.arcadeGamePool.length > 0 ? parsed.data.arcadeGamePool : (await prisma.arcadeGame.findMany({ where: { isEnabled: true }, select: { gameType: true } })).map(g => g.gameType),
      hostId: currentUser.id,
      isSolo,
      status: isSolo ? MatchStatus.IN_PROGRESS : MatchStatus.OPEN,
    },
  });

  await prisma.transaction.create({
    data: {
      userId: currentUser.id,
      matchId: match.id,
      network: parsed.data.network,
      type: TransactionType.ESCROW_LOCK,
      status: receipt.mode === "configured" ? TransactionStatus.PENDING : TransactionStatus.SETTLED,
      amount: hostTotalLock,
      token: parsed.data.stakeToken.toUpperCase(),
      txHash: receipt.txHash,
      metadata: {
        description: receipt.description,
        mode: receipt.mode,
        stakeAmount: parsed.data.stakeAmount.toFixed(6),
        entryFee: parsed.data.entryFee.toFixed(6),
        autoFundedWallet: hostAutoFunded,
      },
    },
  });

  revalidatePath("/");
  revalidatePath("/lobby");
  redirect(`/match/${match.id}`);
}

export async function joinMatchAction(formData: FormData) {
  const session = await requireUser();
  const currentUser = await resolveSessionUser(session);
  const matchId = String(formData.get("matchId") ?? "");

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.isSolo || match.hostId === currentUser.id || match.guestId || match.status !== MatchStatus.OPEN) {
    throw new Error("La partida ya no esta disponible.");
  }

  const { autoFunded: guestAutoFunded } = await ensurePlayableWallet(currentUser.id, match.preferredNetwork);

  const adapter = getOnchainAdapter(match.preferredNetwork);
  const guestTotalLock = (Number(match.stakeAmount) + Number(match.entryFee)).toFixed(6);
  const receipt = await adapter.joinEscrow({
    matchId,
    actorId: currentUser.id,
    amount: guestTotalLock,
    token: match.stakeToken,
  });

  await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data: {
        guestId: currentUser.id,
        status: MatchStatus.IN_PROGRESS,
      },
    }),
    prisma.transaction.create({
      data: {
        userId: currentUser.id,
        matchId,
        network: match.preferredNetwork,
        type: TransactionType.ENTRY_STAKE,
        status: receipt.mode === "configured" ? TransactionStatus.PENDING : TransactionStatus.SETTLED,
        amount: guestTotalLock,
        token: match.stakeToken,
        txHash: receipt.txHash,
        metadata: {
          description: receipt.description,
          mode: receipt.mode,
          stakeAmount: match.stakeAmount.toFixed(6),
          entryFee: match.entryFee.toFixed(6),
          autoFundedWallet: guestAutoFunded,
        },
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/lobby");
  redirect(`/match/${matchId}`);
}

export async function startSoloMatchAction(formData: FormData) {
  const session = await requireUser();
  const currentUser = await resolveSessionUser(session);
  const matchId = String(formData.get("matchId") ?? "");

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || !match.isSolo || match.status !== MatchStatus.OPEN || match.guestId) {
    throw new Error("La partida solo ya no esta disponible.");
  }

  const totalLock = (Number(match.stakeAmount) + Number(match.entryFee)).toFixed(6);
  const requiresLock = Number(totalLock) > 0;

  let receipt: Awaited<ReturnType<ReturnType<typeof getOnchainAdapter>["createEscrow"]>> | null = null;

  if (requiresLock) {
    await ensurePlayableWallet(currentUser.id, match.preferredNetwork);

    const adapter = getOnchainAdapter(match.preferredNetwork);
    receipt = await adapter.createEscrow({
      matchId,
      actorId: currentUser.id,
      amount: totalLock,
      token: match.stakeToken,
    });
  }

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.match.updateMany({
      where: {
        id: matchId,
        isSolo: true,
        status: MatchStatus.OPEN,
        guestId: null,
      },
      data: {
        hostId: currentUser.id,
        status: MatchStatus.IN_PROGRESS,
      },
    });

    if (claimed.count === 0) {
      throw new Error("La partida solo fue tomada por otro jugador. Refresca e intenta de nuevo.");
    }

    if (requiresLock && receipt) {
      await tx.transaction.create({
        data: {
          userId: currentUser.id,
          matchId,
          network: match.preferredNetwork,
          type: TransactionType.ESCROW_LOCK,
          status: receipt.mode === "configured" ? TransactionStatus.PENDING : TransactionStatus.SETTLED,
          amount: totalLock,
          token: match.stakeToken,
          txHash: receipt.txHash,
          metadata: {
            description: receipt.description,
            mode: receipt.mode,
            stakeAmount: match.stakeAmount.toFixed(6),
            entryFee: match.entryFee.toFixed(6),
            source: "start-solo",
          },
        },
      });
    }
  });

  revalidatePath("/");
  revalidatePath("/lobby");
  redirect(`/match/${matchId}`);
}

export async function placeMatchBetAction(formData: FormData) {
  const session = await requireUser();
  const currentUser = await resolveSessionUser(session);
  const parsed = placeBetSchema.safeParse({
    matchId: formData.get("matchId"),
    predictedWinnerId: formData.get("predictedWinnerId"),
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    throw new Error(Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "No se pudo registrar la apuesta.");
  }

  const match = await prisma.match.findUnique({
    where: { id: parsed.data.matchId },
    include: {
      bets: {
        where: { userId: currentUser.id },
        take: 1,
      },
    },
  });

  if (!match) {
    throw new Error("La partida no existe.");
  }

  if (
    !match.guestId ||
    (match.status !== MatchStatus.IN_PROGRESS && match.status !== MatchStatus.ARCADE_PENDING)
  ) {
    throw new Error("Las apuestas solo se abren cuando la partida ya tiene dos jugadores activos.");
  }

  if (currentUser.id === match.hostId || currentUser.id === match.guestId) {
    throw new Error("Los jugadores de la partida no pueden apostar en su propio match.");
  }

  if (![match.hostId, match.guestId].includes(parsed.data.predictedWinnerId)) {
    throw new Error("Debes apostar por uno de los dos jugadores de la partida.");
  }

  if (match.bets.length > 0) {
    throw new Error("Ya registraste una apuesta para esta partida.");
  }

  const { autoFunded } = await ensurePlayableWallet(currentUser.id, match.preferredNetwork);
  const adapter = getOnchainAdapter(match.preferredNetwork);
  const amount = parsed.data.amount.toFixed(6);
  const receipt = await adapter.placeBet({
    matchId: match.id,
    bettorId: currentUser.id,
    predictedWinnerId: parsed.data.predictedWinnerId,
    amount,
    token: match.stakeToken,
  });

  await prisma.$transaction([
    prisma.matchBet.create({
      data: {
        matchId: match.id,
        userId: currentUser.id,
        network: match.preferredNetwork,
        predictedWinnerId: parsed.data.predictedWinnerId,
        amount,
        token: match.stakeToken,
        txHash: receipt.txHash,
        metadata: {
          description: receipt.description,
          mode: receipt.mode,
          autoFundedWallet: autoFunded,
        },
      },
    }),
    prisma.transaction.create({
      data: {
        userId: currentUser.id,
        matchId: match.id,
        network: match.preferredNetwork,
        type: TransactionType.ENTRY_STAKE,
        status: receipt.mode === "configured" ? TransactionStatus.PENDING : TransactionStatus.SETTLED,
        amount,
        token: match.stakeToken,
        txHash: receipt.txHash,
        metadata: {
          description: receipt.description,
          mode: receipt.mode,
          category: "spectator-bet",
          predictedWinnerId: parsed.data.predictedWinnerId,
        },
      },
    }),
  ]);

  revalidatePath(`/match/${match.id}`);
  revalidatePath("/dashboard");
}

export async function updateUserAction(formData: FormData) {
  const session = await requireUser();
  if (session.role !== "ADMIN") throw new Error("Unauthorized");
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
  const session = await requireUser();
  if (session.role !== "ADMIN") throw new Error("Unauthorized");
  const userId = String(formData.get("userId") ?? "");
  if (!userId) {
    throw new Error("Usuario invalido.");
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
}

export async function updateTransactionAction(formData: FormData) {
  const session = await requireUser();
  if (session.role !== "ADMIN") throw new Error("Unauthorized");
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
  const session = await requireUser();
  if (session.role !== "ADMIN") throw new Error("Unauthorized");
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
  const session = await requireUser();
  if (session.role !== "ADMIN") throw new Error("Unauthorized");
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
  const session = await requireUser();
  if (session.role !== "ADMIN") throw new Error("Unauthorized");
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
  const session = await requireUser();
  if (session.role !== "ADMIN") throw new Error("Unauthorized");
  const planId = String(formData.get("planId") ?? "");
  if (!planId) {
    throw new Error("Plan invalido.");
  }

  await prisma.plan.delete({ where: { id: planId } });
  revalidatePath("/admin");
  revalidatePath("/admin/planes");
}

export async function setLocaleAction(locale: string) {
  const validLocale = locale === "en" ? "en" : "es";
  const store = await cookies();
  store.set("NEXT_LOCALE", validLocale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
    sameSite: "lax",
  });
}
