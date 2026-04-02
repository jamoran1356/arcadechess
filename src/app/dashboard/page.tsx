import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";
import { hasAdminAccess, requireUser } from "@/lib/auth";
import { linkWalletAddressAction } from "@/lib/actions";
import { FriendInvitePanel, type FriendData } from "@/components/friend-invite-panel";
import { getDashboardSnapshot } from "@/lib/data";
import { getEnabledNetworks } from "@/lib/networks";
import { prisma } from "@/lib/db";
import { getExplorerTxUrl, getExplorerAddressUrl } from "@/lib/onchain/service";
import { OnchainBalance } from "@/components/onchain-balance";

export const dynamic = "force-dynamic";

function getWalletAccent(network: string) {
  switch (network) {
    case "INITIA":
      return "border-cyan-400/30 bg-cyan-400/10 text-cyan-100";
    case "FLOW":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
    case "SOLANA":
      return "border-amber-400/30 bg-amber-400/10 text-amber-100";
    default:
      return "border-white/10 bg-white/5 text-white";
  }
}

function formatAmount(value: string | number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(numeric);
}

function formatStatusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export default async function DashboardPage() {
  const session = await requireUser();
  const [user, rawFriendships, enabledNetworks] = await Promise.all([
    getDashboardSnapshot(session.id),
    prisma.friendship.findMany({
      where: { OR: [{ userId: session.id }, { friendId: session.id }] },
      include: {
        user: { select: { id: true, name: true, email: true } },
        friend: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    getEnabledNetworks(),
  ]);
  const locale = await getLocale();
  const { dashboard: t } = getDictionary(locale);
  const adminAccess = hasAdminAccess(session);

  const friends: FriendData[] = rawFriendships.map((f) => {
    const isSender = f.userId === session.id;
    const other = isSender ? f.friend : f.user;
    return {
      id: f.id,
      name: other.name,
      email: other.email,
      status: f.status as "PENDING" | "ACCEPTED",
      direction: isSender ? "sent" : "received",
    };
  });

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-16 sm:px-6 lg:px-8">
        <section className="panel rounded-[2rem] p-8 text-center">
          <p className="eyebrow">Dashboard</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">{t.errorTitle}</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">{t.errorDesc}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/login" className="button-primary px-6 py-3 text-center">{t.loginBtn}</Link>
            <Link href="/register" className="button-secondary px-6 py-3 text-center text-slate-100">{t.registerBtn}</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="grid gap-6 lg:grid-cols-[290px_minmax(0,1fr)] xl:gap-8">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.16),transparent_34%),linear-gradient(180deg,rgba(7,16,28,0.98),rgba(5,11,19,0.96))] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
            <p className="eyebrow">Control Deck</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{user.name}</h1>
            <p className="mt-2 text-sm text-slate-300">{user.email}</p>

            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-400">Resumen rápido</p>
              <div className="mt-4 grid gap-3">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>{t.ratingLabel}</span>
                  <span className="text-lg font-semibold text-amber-200">{user.rating}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>{t.walletsLabel}</span>
                  <span className="text-lg font-semibold text-cyan-100">{user.wallets.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>{t.transactionsLabel}</span>
                  <span className="text-lg font-semibold text-white">{user.transactions.length}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <Link href="/lobby" className="button-primary px-5 py-3 text-center text-sm">{t.primaryAction}</Link>
              <Link href="/arcade-test" className="button-secondary px-5 py-3 text-center text-sm text-slate-100">{t.secondaryAction}</Link>
              {adminAccess ? (
                <Link href="/admin" className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-center text-sm text-cyan-100 transition hover:border-cyan-200/60 hover:bg-cyan-300/15">
                  {t.adminAccessBtn}
                </Link>
              ) : null}
            </div>
          </div>
        </aside>

        <main className="grid gap-6 xl:gap-8">
          <section id="overview" className="relative overflow-hidden rounded-[2.4rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.14),transparent_34%),rgba(2,6,23,0.92)] p-6 lg:p-8">
            <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:28px_28px]" />
            <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="eyebrow">{t.profileEyebrow}</p>
                <h2 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">Centro de mando para tus partidas, redes y apuestas.</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{t.walletClusterDesc}</p>

                <div className="mt-7 grid gap-4 md:grid-cols-3">
                  <article className="rounded-[1.6rem] border border-white/10 bg-white/6 p-5 backdrop-blur">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">{t.hostedMatchesLabel}</p>
                    <p className="mt-3 text-4xl font-semibold text-white">{user.hostedMatches.length}</p>
                  </article>
                  <article className="rounded-[1.6rem] border border-white/10 bg-white/6 p-5 backdrop-blur">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">{t.joinedMatchesLabel}</p>
                    <p className="mt-3 text-4xl font-semibold text-cyan-100">{user.joinedMatches.length}</p>
                  </article>
                  <article className="rounded-[1.6rem] border border-white/10 bg-white/6 p-5 backdrop-blur">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">Amigos</p>
                    <p className="mt-3 text-4xl font-semibold text-amber-200">{friends.filter((friend) => friend.status === "ACCEPTED").length}</p>
                  </article>
                </div>
              </div>

              <div className="grid gap-4 self-start">
                <article className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5 backdrop-blur">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">Actividad</p>
                  <div className="mt-4 grid gap-3 text-sm text-slate-300">
                    <div className="flex items-center justify-between"><span>Partidas abiertas o activas</span><span className="font-semibold text-white">{user.hostedMatches.length + user.joinedMatches.length}</span></div>
                    <div className="flex items-center justify-between"><span>Invitaciones pendientes</span><span className="font-semibold text-white">{friends.filter((friend) => friend.status === "PENDING").length}</span></div>
                    <div className="flex items-center justify-between"><span>Últimos movimientos</span><span className="font-semibold text-white">{user.transactions.length}</span></div>
                  </div>
                </article>
                <article className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5 backdrop-blur">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">Estado de mesa</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">Wallets activas: {new Set(user.wallets.map((wallet) => wallet.network)).size}</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">Partidas hoy: {user.hostedMatches.length + user.joinedMatches.length}</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">Amigos: {friends.filter((friend) => friend.status === "ACCEPTED").length}</span>
                  </div>
                </article>
              </div>
            </div>
          </section>

          <section id="wallets" className="panel rounded-[2.2rem] p-6 lg:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">{t.walletsEyebrow}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{t.walletsTitle}</h2>
              </div>
              <span className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-slate-300">
                {user.wallets.length} {t.walletsCountLabel}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {user.wallets.length > 0 ? (
                user.wallets.filter((w) => enabledNetworks.includes(w.network)).map((wallet) => {
                  const addrUrl = getExplorerAddressUrl(wallet.network, wallet.address);
                  return (
                    <article key={wallet.id} className={`rounded-[1.75rem] border p-5 shadow-[0_20px_60px_rgba(2,6,23,0.25)] ${getWalletAccent(wallet.network)}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-xs uppercase tracking-[0.18em] opacity-80">{wallet.network}</p>
                        <span className="rounded-full border border-current/20 px-3 py-1 text-[10px] uppercase tracking-[0.18em] opacity-80">Live</span>
                      </div>
                      <OnchainBalance address={wallet.address} network={wallet.network} walletId={wallet.id} />
                      <p className="mt-3 break-all text-xs opacity-75">
                        {addrUrl ? (
                          <a href={addrUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-100">
                            {wallet.address}
                          </a>
                        ) : (
                          wallet.address
                        )}
                      </p>
                    </article>
                  );
                })
              ) : (
                <article className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 md:col-span-2 2xl:col-span-3">
                  <p className="text-sm text-slate-300">{t.noWallets}</p>
                </article>
              )}
            </div>

            <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
              <form action={linkWalletAddressAction} className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
                {enabledNetworks.length === 1 ? (
                  <input type="hidden" name="network" value={enabledNetworks[0]} />
                ) : (
                  <select name="network" className="input" defaultValue={enabledNetworks[0]}>
                    {enabledNetworks.map((network) => (
                      <option key={network} value={network}>{network}</option>
                    ))}
                  </select>
                )}
                <input name="address" className="input" placeholder="Wallet address to link" required />
                <button type="submit" className="button-primary px-4 py-2 text-sm">Vincular</button>
              </form>
              <p className="mt-3 text-xs text-slate-400">Vincula tu billetera para jugar y recibir pagos.</p>
            </div>
          </section>

          <section id="matches" className="grid gap-6 xl:grid-cols-2">
            <div className="panel rounded-[2rem] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="eyebrow">{t.myMatchesEyebrow}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{t.myMatchesTitle}</h2>
                </div>
                <Link href="/lobby" className="text-sm text-cyan-200 hover:text-cyan-100">{t.createAnother}</Link>
              </div>
              <div className="mt-6 grid gap-4">
                {user.hostedMatches.length > 0 ? (
                  user.hostedMatches.map((match) => (
                    <Link key={match.id} href={`/match/${match.id}`} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 transition hover:border-white/20 hover:bg-white/7">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold text-white">{match.title}</h3>
                        <span className="text-xs text-slate-400">{match.status.replaceAll("_", " ")}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">{match.theme}</p>
                    </Link>
                  ))
                ) : (
                  <article className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                    <p className="text-sm text-slate-300">{t.noMatches}</p>
                  </article>
                )}
              </div>
            </div>

            <div className="panel rounded-[2rem] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="eyebrow">{t.joinedMatchesEyebrow}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{t.joinedMatchesTitle}</h2>
                </div>
              </div>
              <div className="mt-6 grid gap-4">
                {user.joinedMatches.length > 0 ? (
                  user.joinedMatches.map((match) => (
                    <Link key={match.id} href={`/match/${match.id}`} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 transition hover:border-cyan-300/30 hover:bg-white/7">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold text-white">{match.title}</h3>
                        <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                          {formatStatusLabel(match.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">{match.theme}</p>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{t.vsHostLabel}: {match.host?.name ?? t.unknownHost}</p>
                    </Link>
                  ))
                ) : (
                  <article className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                    <p className="text-sm text-slate-300">{t.noJoinedMatches}</p>
                  </article>
                )}
              </div>
            </div>
          </section>

          <section id="friends" className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="panel rounded-[2rem] p-6">
              <FriendInvitePanel initialFriends={friends} />
            </div>
            <div className="panel rounded-[2rem] p-6">
              <p className="eyebrow">Network Snapshot</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Tu círculo y tus redes</h2>
              <div className="mt-6 grid gap-4">
                <article className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">Amigos aceptados</p>
                  <p className="mt-2 text-3xl font-semibold text-emerald-200">{friends.filter((friend) => friend.status === "ACCEPTED").length}</p>
                </article>
                <article className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">Solicitudes pendientes</p>
                  <p className="mt-2 text-3xl font-semibold text-amber-200">{friends.filter((friend) => friend.status === "PENDING").length}</p>
                </article>
                <article className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">Redes activas</p>
                  <p className="mt-2 text-3xl font-semibold text-cyan-100">{new Set(user.wallets.map((wallet) => wallet.network)).size}</p>
                </article>
              </div>
            </div>
          </section>

          <section id="ledger" className="panel rounded-[2rem] p-6">
            <p className="eyebrow">{t.financialEyebrow}</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{t.financialTitle}</h2>
            <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950/50">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">{t.ledgerType}</th>
                    <th className="px-4 py-3">{t.ledgerAmount}</th>
                    <th className="px-4 py-3">{t.ledgerNetwork}</th>
                    <th className="px-4 py-3">{t.ledgerStatus}</th>
                    <th className="px-4 py-3">Explorer</th>
                  </tr>
                </thead>
                <tbody>
                  {user.transactions.length > 0 ? (
                    user.transactions.map((transaction) => {
                      const explorerUrl = transaction.txHash
                        ? getExplorerTxUrl(transaction.network, transaction.txHash)
                        : null;
                      return (
                        <tr key={transaction.id} className="border-t border-white/10">
                          <td className="px-4 py-3 text-white">{formatStatusLabel(transaction.type)}</td>
                          <td className="px-4 py-3 font-medium text-amber-200">{formatAmount(transaction.amount.toString())}</td>
                          <td className="px-4 py-3">{transaction.network}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-200">
                              {transaction.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {explorerUrl ? (
                              <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline underline-offset-2 text-xs hover:text-cyan-100">
                                Ver tx
                              </a>
                            ) : (
                              <span className="text-xs text-slate-500">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr className="border-t border-white/10">
                      <td className="px-4 py-6 text-slate-400" colSpan={5}>{t.noTransactions}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
