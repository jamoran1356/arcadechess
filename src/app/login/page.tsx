import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-16">
      <div className="flex flex-col justify-center">
        <p className="eyebrow">Acceso</p>
        <h1 className="mt-3 text-5xl font-semibold leading-none text-white">Vuelve a la arena.</h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
          Usa una cuenta existente para administrar stakes, entrar a partidas activas y resolver capturas arcade.
        </p>

        <div className="panel mt-8 rounded-[2rem] p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">Cuentas demo</p>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <p>admin@playchess.gg / Admin123!</p>
            <p>luna@playchess.gg / Demo123!</p>
            <p>marco@playchess.gg / Demo123!</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <AuthForm mode="login" />
      </div>
    </div>
  );
}
