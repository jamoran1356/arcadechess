'use server';

import { randomUUID } from "node:crypto";
import { Chess } from "chess.js";
import { MatchStatus, TransactionStatus, TransactionType, TransactionNetwork, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSession, clearSession, hashPassword, hasAdminAccess, requireUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOnchainAdapter } from "@/lib/onchain/service";
import { calculateMatchEntryFee, getPlatformConfig } from "@/lib/platform-config";
import { createMatchSchema, FormState, loginSchema, placeBetSchema, registerSchema } from "@/lib/validators";
import { creditWallet, getOrCreateWalletForNetwork } from "@/lib/wallet";
import { refundPlayer, settleWinner } from "@/lib/match-engine";
import { getEnabledNetworks } from "@/lib/networks";

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

async function generateMatchTitle(network: TransactionNetwork, isSolo: boolean) {
  const count = await prisma.match.count();
  const seq = String(count + 1).padStart(4, "0");
  return `${isSolo ? "Solo" : "Versus"} ${network} #${seq}`;
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

  const enabledNets = await getEnabledNetworks();

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      wallets: {
        create: enabledNets.map((network) => ({
          network,
          address: defaultWalletAddress(network, randomUUID()),
          balance: "0",
        })),
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
    stakeAmount: formData.get("stakeAmount"),
    gameClockMinutes: formData.get("gameClockMinutes"),
    stakeToken: formData.get("stakeToken"),
    network: formData.get("network"),
    arcadeGamePool: formData.getAll("arcadeGamePool"),
  });

  if (!parsed.success) {
    throw new Error(Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "No se pudo crear la partida.");
  }

  const enabledNetsForMatch = await getEnabledNetworks();
  if (!enabledNetsForMatch.includes(parsed.data.network)) {
    throw new Error("Esta red no está habilitada actualmente.");
  }

  const platformConfig = await getPlatformConfig();
  const effectiveEntryFee = calculateMatchEntryFee(parsed.data.stakeAmount, platformConfig);

  const matchId = randomUUID();
  const hostTotalLock = (parsed.data.stakeAmount + effectiveEntryFee).toFixed(6);
  const hostWallet = await getOrCreateWalletForNetwork(currentUser.id, parsed.data.network);

  // Use the real wallet address from the client (init1...) if available,
  // otherwise fall back to the DB address.
  const clientWalletAddress = String(formData.get("walletAddress") ?? "").trim();
  const effectiveHostAddress = clientWalletAddress.startsWith("init1") ? clientWalletAddress : hostWallet.address;

  // Update the wallet record in DB with the real address if provided
  if (clientWalletAddress.startsWith("init1") && hostWallet.address !== clientWalletAddress) {
    await prisma.wallet.update({ where: { id: hostWallet.id }, data: { address: clientWalletAddress } });
  }

  // Validate balance on-chain (not from DB)
  const adapter = getOnchainAdapter(parsed.data.network);
  if (effectiveHostAddress.startsWith("init1")) {
    const onchainBal = await adapter.queryBalance(effectiveHostAddress);
    if (!onchainBal || onchainBal.amount < Number(hostTotalLock)) {
      throw new Error(
        `Fondos insuficientes on-chain. Necesitas ${hostTotalLock} INIT pero tu saldo es ${onchainBal?.amount.toFixed(6) ?? "0.000000"}. Deposita fondos en tu wallet.`,
      );
    }
  }

  // Always register the match on-chain via server adapter to get onchainMatchIndex
  // and deposit funds into the contract vault.
  // The client-signed MsgSend (if any) sends tokens to the admin account;
  // deposit_funds then moves them from admin into the vault.
  const clientTxHash = String(formData.get("escrowTxHash") ?? "").trim();
  const receipt = await adapter.createEscrow({
    matchId,
    actorId: currentUser.id,
    actorWallet: effectiveHostAddress,
    amount: hostTotalLock,
    token: parsed.data.stakeToken,
    stakeAmount: parsed.data.stakeAmount.toFixed(6),
    entryFee: effectiveEntryFee.toFixed(6),
  });
  const receiptTxHash = clientTxHash || receipt.txHash;
  const receiptMode = receipt.mode;
  const receiptDescription = receipt.description;
  const onchainMatchIndex = receipt.onchainMatchIndex;

  const match = await prisma.match.create({
    data: {
      id: matchId,
      title: await generateMatchTitle(parsed.data.network, isSolo),
      theme: isSolo
        ? "Partida rápida en solitario"
        : "Partida rápida contra rival",
      stakeAmount: parsed.data.stakeAmount.toFixed(6),
      entryFee: effectiveEntryFee.toFixed(6),
      stakeToken: parsed.data.stakeToken.toUpperCase(),
      preferredNetwork: parsed.data.network,
      gameClockMs: parsed.data.gameClockMinutes * 60_000,
      whiteClockMs: parsed.data.gameClockMinutes * 60_000,
      blackClockMs: parsed.data.gameClockMinutes * 60_000,
      turnStartedAt: isSolo ? new Date() : null,
      fen: new Chess().fen(),
      moveHistory: [],
        arcadeGamePool: parsed.data.arcadeGamePool.length > 0 ? parsed.data.arcadeGamePool : (await prisma.arcadeGame.findMany({ where: { isEnabled: true }, select: { gameType: true } })).map(g => g.gameType),
      hostId: currentUser.id,
      isSolo,
      onchainMatchIndex: onchainMatchIndex ?? null,
      status: isSolo ? MatchStatus.IN_PROGRESS : MatchStatus.OPEN,
    },
  });

  await prisma.transaction.create({
    data: {
      userId: currentUser.id,
      matchId: match.id,
      network: parsed.data.network,
      type: TransactionType.ESCROW_LOCK,
      status: receiptMode === "configured" ? TransactionStatus.PENDING : TransactionStatus.SETTLED,
      amount: hostTotalLock,
      token: parsed.data.stakeToken.toUpperCase(),
      txHash: receiptTxHash,
      metadata: {
        description: receiptDescription,
        mode: receiptMode,
        stakeAmount: parsed.data.stakeAmount.toFixed(6),
        entryFee: effectiveEntryFee.toFixed(6),
        feePolicy: {
          matchFeeBps: platformConfig.matchFeeBps,
          betFeeBps: platformConfig.betFeeBps,
          arcadeFeeFixed: platformConfig.arcadeFeeFixed.toString(),
          minEntryFee: platformConfig.minEntryFee.toString(),
        },
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

  const guestTotalLock = (Number(match.stakeAmount) + Number(match.entryFee)).toFixed(6);
  const guestWallet = await getOrCreateWalletForNetwork(currentUser.id, match.preferredNetwork);

  // Use the real wallet address from the client (init1...) if available
  const clientWalletAddress = String(formData.get("walletAddress") ?? "").trim();
  const effectiveGuestAddress = clientWalletAddress.startsWith("init1") ? clientWalletAddress : guestWallet.address;

  // Update the wallet record in DB with the real address if provided
  if (clientWalletAddress.startsWith("init1") && guestWallet.address !== clientWalletAddress) {
    await prisma.wallet.update({ where: { id: guestWallet.id }, data: { address: clientWalletAddress } });
  }

  // Validate balance on-chain
  const adapter = getOnchainAdapter(match.preferredNetwork);
  if (effectiveGuestAddress.startsWith("init1")) {
    const onchainBal = await adapter.queryBalance(effectiveGuestAddress);
    if (!onchainBal || onchainBal.amount < Number(guestTotalLock)) {
      throw new Error(
        `Fondos insuficientes on-chain. Necesitas ${guestTotalLock} INIT pero tu saldo es ${onchainBal?.amount.toFixed(6) ?? "0.000000"}. Deposita fondos en tu wallet.`,
      );
    }
  }

  // Always deposit on-chain via server adapter so funds enter the contract vault
  const clientTxHash = String(formData.get("escrowTxHash") ?? "").trim();
  const receipt = await adapter.joinEscrow({
    matchId,
    actorId: currentUser.id,
    actorWallet: effectiveGuestAddress,
    onchainMatchIndex: match.onchainMatchIndex,
    amount: guestTotalLock,
    token: match.stakeToken,
  });
  const receiptTxHash = clientTxHash || receipt.txHash;
  const receiptMode = receipt.mode;
  const receiptDescription = receipt.description;

  await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data: {
        guestId: currentUser.id,
        status: MatchStatus.IN_PROGRESS,
        whiteClockMs: match.gameClockMs,
        blackClockMs: match.gameClockMs,
        turnStartedAt: new Date(),
      },
    }),
    prisma.transaction.create({
      data: {
        userId: currentUser.id,
        matchId,
        network: match.preferredNetwork,
        type: TransactionType.ENTRY_STAKE,
        status: receiptMode === "configured" ? TransactionStatus.PENDING : TransactionStatus.SETTLED,
        amount: guestTotalLock,
        token: match.stakeToken,
        txHash: receiptTxHash,
        metadata: {
          description: receiptDescription,
          mode: receiptMode,
          stakeAmount: match.stakeAmount.toFixed(6),
          entryFee: match.entryFee.toFixed(6),
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

  // Use client-signed tx hash if provided, otherwise fall back to server adapter
  const clientTxHash = String(formData.get("escrowTxHash") ?? "").trim();
  let receiptTxHash: string | null = null;
  let receiptMode: "mock" | "configured" = "mock";
  let receiptDescription = "";
  let soloWallet: Awaited<ReturnType<typeof getOrCreateWalletForNetwork>> | null = null;
  let onchainMatchIndex: number | undefined;

  if (requiresLock) {
    soloWallet = await getOrCreateWalletForNetwork(currentUser.id, match.preferredNetwork);

    // Use the real wallet address from the client (init1...) if available
    const clientWalletAddress = String(formData.get("walletAddress") ?? "").trim();
    const effectiveSoloAddress = clientWalletAddress.startsWith("init1") ? clientWalletAddress : soloWallet.address;

    // Update the wallet record in DB with the real address if provided
    if (clientWalletAddress.startsWith("init1") && soloWallet.address !== clientWalletAddress) {
      await prisma.wallet.update({ where: { id: soloWallet.id }, data: { address: clientWalletAddress } });
    }

    // Validate balance on-chain
    const adapter = getOnchainAdapter(match.preferredNetwork);
    if (effectiveSoloAddress.startsWith("init1")) {
      const onchainBal = await adapter.queryBalance(effectiveSoloAddress);
      if (!onchainBal || onchainBal.amount < Number(totalLock)) {
        throw new Error(
          `Fondos insuficientes on-chain. Necesitas ${totalLock} INIT pero tu saldo es ${onchainBal?.amount.toFixed(6) ?? "0.000000"}. Deposita fondos en tu wallet.`,
        );
      }
    }

    // Always register on-chain via server adapter
    const receipt = await adapter.createEscrow({
      matchId,
      actorId: currentUser.id,
      actorWallet: effectiveSoloAddress,
      amount: totalLock,
      token: match.stakeToken,
      stakeAmount: match.stakeAmount.toString(),
      entryFee: match.entryFee.toString(),
    });
    receiptTxHash = clientTxHash || receipt.txHash;
    receiptMode = receipt.mode;
    receiptDescription = receipt.description;
    onchainMatchIndex = receipt.onchainMatchIndex;
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
        whiteClockMs: match.gameClockMs,
        blackClockMs: match.gameClockMs,
        turnStartedAt: new Date(),
        onchainMatchIndex: onchainMatchIndex ?? null,
      },
    });

    if (claimed.count === 0) {
      throw new Error("La partida solo fue tomada por otro jugador. Refresca e intenta de nuevo.");
    }

    if (requiresLock && receiptTxHash) {
      await tx.transaction.create({
        data: {
          userId: currentUser.id,
          matchId,
          network: match.preferredNetwork,
          type: TransactionType.ESCROW_LOCK,
          status: receiptMode === "configured" ? TransactionStatus.PENDING : TransactionStatus.SETTLED,
          amount: totalLock,
          token: match.stakeToken,
          txHash: receiptTxHash,
          metadata: {
            description: receiptDescription,
            mode: receiptMode,
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

  const betAmount = parsed.data.amount;
  const betWallet = await getOrCreateWalletForNetwork(currentUser.id, match.preferredNetwork);

  // Validate balance on-chain
  const adapter = getOnchainAdapter(match.preferredNetwork);
  if (betWallet.address.startsWith("init1")) {
    const onchainBal = await adapter.queryBalance(betWallet.address);
    if (!onchainBal || onchainBal.amount < betAmount) {
      throw new Error(
        `Fondos insuficientes on-chain. Necesitas ${betAmount.toFixed(6)} INIT pero tu saldo es ${onchainBal?.amount.toFixed(6) ?? "0.000000"}. Deposita fondos en tu wallet.`,
      );
    }
  }

  const amount = betAmount.toFixed(6);
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
  if (!hasAdminAccess(session)) throw new Error("Unauthorized");
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
  if (!hasAdminAccess(session)) throw new Error("Unauthorized");
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
  if (!hasAdminAccess(session)) throw new Error("Unauthorized");
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

export async function resignMatchAction(formData: FormData) {
  const session = await requireUser();
  const matchId = String(formData.get("matchId") ?? "").trim();

  if (!matchId) {
    throw new Error("ID de partida inválido.");
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      hostId: true,
      guestId: true,
      status: true,
      moveHistory: true,
      stakeAmount: true,
      entryFee: true,
      stakeToken: true,
      preferredNetwork: true,
      onchainMatchIndex: true,
    },
  });

  if (!match) {
    throw new Error("Partida no encontrada.");
  }

  const isParticipant = match.hostId === session.id || match.guestId === session.id;
  if (!isParticipant) {
    throw new Error("No sos participante de esta partida.");
  }

  const isActive =
    match.status === MatchStatus.IN_PROGRESS ||
    match.status === MatchStatus.OPEN ||
    match.status === MatchStatus.ARCADE_PENDING;

  if (!isActive) {
    throw new Error("La partida ya terminó.");
  }

  // If there is an opponent, they win; otherwise just cancel
  const opponentId =
    match.hostId === session.id ? match.guestId : match.hostId;

  await prisma.match.update({
    where: { id: matchId },
    data: {
      status: MatchStatus.FINISHED,
      winnerId: opponentId ?? null,
      moveHistory: [
        ...(Array.isArray(match.moveHistory) ? match.moveHistory.map(String) : []),
        `${session.name} [resign]`,
      ],
    },
  });

  // Liquidar fondos: acreditar al ganador y liquidar apuestas
  if (opponentId) {
    try {
      await settleWinner(match, opponentId);
    } catch (error) {
      console.error("Settlement error on resign:", error);
    }
  } else {
    // No opponent — refund the host's full lock (stake + entryFee)
    try {
      await refundPlayer(match, session.id);
    } catch (error) {
      console.error("Refund error on resign without opponent:", error);
    }
  }

  revalidatePath(`/match/${matchId}`);
  revalidatePath("/lobby");
  redirect("/lobby");
}

export async function updateMatchStatusAction(formData: FormData) {
  const session = await requireUser();
  if (!hasAdminAccess(session)) throw new Error("Unauthorized");
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
  if (!hasAdminAccess(session)) throw new Error("Unauthorized");
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

export async function toggleNetworkAction(formData: FormData) {
  const session = await requireUser();
  if (!hasAdminAccess(session)) throw new Error("Unauthorized");

  const network = String(formData.get("network") ?? "");
  if (!Object.values(TransactionNetwork).includes(network as TransactionNetwork)) {
    throw new Error("Red invalida.");
  }

  const config = await prisma.platformConfig.findUnique({ where: { key: "default" } });
  const current: string[] = Array.isArray(config?.enabledNetworks) ? (config.enabledNetworks as string[]) : ["INITIA"];

  let next: string[];
  if (current.includes(network)) {
    next = current.filter((n) => n !== network);
    if (next.length === 0) throw new Error("Debe haber al menos una red habilitada.");
  } else {
    next = [...current, network];
  }

  await prisma.platformConfig.upsert({
    where: { key: "default" },
    update: { enabledNetworks: next },
    create: { key: "default", enabledNetworks: next },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/redes");
  revalidatePath("/lobby");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function linkWalletAddressAction(formData: FormData) {
  const session = await requireUser();
  const currentUser = await resolveSessionUser(session);
  const network = String(formData.get("network") ?? "INITIA").toUpperCase();
  const address = String(formData.get("address") ?? "").trim();

  if (!Object.values(TransactionNetwork).includes(network as TransactionNetwork)) {
    throw new Error("Red invalida.");
  }

  const enabledNets = await getEnabledNetworks();
  if (!enabledNets.includes(network as TransactionNetwork)) {
    throw new Error("Esta red no está habilitada actualmente.");
  }

  if (address.length < 6) {
    throw new Error("Direccion de billetera invalida.");
  }

  const existingByUserNetwork = await prisma.wallet.findFirst({
    where: {
      userId: currentUser.id,
      network: network as TransactionNetwork,
    },
  });

  if (existingByUserNetwork) {
    await prisma.wallet.update({
      where: { id: existingByUserNetwork.id },
      data: { address },
    });
  } else {
    await prisma.wallet.create({
      data: {
        userId: currentUser.id,
        network: network as TransactionNetwork,
        address,
        balance: "0",
      },
    });
  }

  revalidatePath("/dashboard");
}

export async function addFriendAction(formData: FormData) {
  const session = await requireUser();
  const identifier = String(formData.get("identifier") ?? "").trim();

  if (!identifier) {
    throw new Error("Indicá un correo o dirección de wallet.");
  }

  // Find target user by email or wallet address
  let targetUser: { id: string } | null = null;

  if (identifier.includes("@")) {
    targetUser = await prisma.user.findUnique({
      where: { email: identifier },
      select: { id: true },
    });
  } else {
    const wallet = await prisma.wallet.findFirst({
      where: { address: identifier },
      select: { userId: true },
    });
    if (wallet) {
      targetUser = { id: wallet.userId };
    }
  }

  if (!targetUser) {
    throw new Error("No se encontró ningún usuario con ese correo o wallet.");
  }

  if (targetUser.id === session.id) {
    throw new Error("No podés agregarte a vos mismo.");
  }

  await prisma.friendship.upsert({
    where: { userId_friendId: { userId: session.id, friendId: targetUser.id } },
    create: { userId: session.id, friendId: targetUser.id, status: "PENDING" },
    update: {},
  });

  revalidatePath("/dashboard");
}

export async function acceptFriendAction(formData: FormData) {
  const session = await requireUser();
  const friendshipId = String(formData.get("friendshipId") ?? "").trim();

  if (!friendshipId) {
    throw new Error("ID de solicitud inválido.");
  }

  await prisma.friendship.updateMany({
    where: { id: friendshipId, friendId: session.id, status: "PENDING" },
    data: { status: "ACCEPTED" },
  });

  revalidatePath("/dashboard");
}

export async function removeFriendAction(formData: FormData) {
  const session = await requireUser();
  const friendshipId = String(formData.get("friendshipId") ?? "").trim();

  if (!friendshipId) {
    throw new Error("ID inválido.");
  }

  await prisma.friendship.deleteMany({
    where: {
      id: friendshipId,
      OR: [{ userId: session.id }, { friendId: session.id }],
    },
  });

  revalidatePath("/dashboard");
}

export async function upsertPlanAction(formData: FormData) {
  const session = await requireUser();
  if (!hasAdminAccess(session)) throw new Error("Unauthorized");
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
  if (!hasAdminAccess(session)) throw new Error("Unauthorized");
  const planId = String(formData.get("planId") ?? "");
  if (!planId) {
    throw new Error("Plan invalido.");
  }

  await prisma.plan.delete({ where: { id: planId } });
  revalidatePath("/admin");
  revalidatePath("/admin/planes");
}

export async function upsertPlatformConfigAction(formData: FormData) {
  const session = await requireUser();
  if (!hasAdminAccess(session)) throw new Error("Unauthorized");

  const matchFeeBps = Math.max(0, Math.min(10_000, Number(formData.get("matchFeeBps") ?? 0)));
  const betFeeBps = Math.max(0, Math.min(10_000, Number(formData.get("betFeeBps") ?? 0)));
  const arcadeFeeFixed = parseDecimal(formData.get("arcadeFeeFixed"), "0");
  const minEntryFee = parseDecimal(formData.get("minEntryFee"), "0");
  const isActive = parseBoolean(formData.get("isActive"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await prisma.platformConfig.upsert({
    where: { key: "default" },
    update: {
      matchFeeBps,
      betFeeBps,
      arcadeFeeFixed,
      minEntryFee,
      isActive,
      notes,
    },
    create: {
      key: "default",
      matchFeeBps,
      betFeeBps,
      arcadeFeeFixed,
      minEntryFee,
      isActive,
      notes,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/ingresos");
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
