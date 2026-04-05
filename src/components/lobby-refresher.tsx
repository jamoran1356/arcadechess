"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LobbyRefresher() {
  const router = useRouter();

  useEffect(() => {
    const es = new EventSource("/api/lobby/updates");

    es.onmessage = (event) => {
      if (event.data === "refresh") {
        router.refresh();
      }
    };

    es.onerror = () => {
      // The browser will automatically reconnect
    };

    return () => es.close();
  }, [router]);

  return null;
}
