import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-16">
      <div className="flex items-center justify-center order-2 lg:order-1">
        <AuthForm mode="register" />
      </div>

      <div className="order-1 flex flex-col justify-center lg:order-2">
        <p className="eyebrow">Nuevo jugador</p>
        <h1 className="mt-3 text-5xl font-semibold leading-none text-white">Crea una cuenta y publica tu primera mesa.</h1>
        <div className="mt-8 grid gap-4">
          <article className="panel rounded-[1.75rem] p-6">
            <h2 className="text-xl font-semibold text-white">Lobby con stakes</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">Cada jugador puede abrir partidas con monto, token y red preferida.</p>
          </article>
          <article className="panel rounded-[1.75rem] p-6">
            <h2 className="text-xl font-semibold text-white">Captura por arcade</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">Las piezas atacantes solo toman la casilla si ganan el minijuego.</p>
          </article>
          <article className="panel rounded-[1.75rem] p-6">
            <h2 className="text-xl font-semibold text-white">Integracion multired</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">Initia como foco principal, con contratos de referencia para Flow y Solana.</p>
          </article>
        </div>
      </div>
    </div>
  );
}
