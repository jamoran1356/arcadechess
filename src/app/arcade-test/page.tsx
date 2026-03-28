import { requireUser } from "@/lib/auth";
import { ArcadeTestClient } from "@/components/arcade-test-client";

export const dynamic = "force-dynamic";

export default async function ArcadeTestPage() {
  await requireUser();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section>
        <p className="eyebrow">Sandbox</p>
        <h1 className="mt-2 text-4xl font-semibold text-white">Prueba la funcionalidad arcade</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          Usa este laboratorio para validar escenarios, seeds e intentos sin depender de una partida real.
        </p>
      </section>

      <ArcadeTestClient />
    </div>
  );
}
