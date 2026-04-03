"use client";

import { useState } from "react";
import { CreateMatchForm } from "@/components/create-match-form";

type Props = React.ComponentProps<typeof CreateMatchForm> & {
  buttonLabel: string;
};

export function LobbyClient({ buttonLabel, ...formProps }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="button-primary inline-flex shrink-0 items-center gap-2 px-6 py-3 text-sm"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4 sm:p-6 lg:p-10">
          <div className="relative w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-950 p-6 shadow-2xl lg:p-8">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-5 top-5 rounded-full border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Cerrar"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <p className="eyebrow">{formProps.labels.publishEyebrow}</p>
            <h2 className="mt-2 text-2xl font-bold text-white">{formProps.labels.publishTitle}</h2>

            <CreateMatchForm {...formProps} />
          </div>
        </div>
      )}
    </>
  );
}
