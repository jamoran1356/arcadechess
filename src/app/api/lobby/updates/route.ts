import { onLobbyUpdate } from "@/lib/lobby-events";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 30_000);

      const unsubscribe = onLobbyUpdate(() => {
        controller.enqueue(encoder.encode("data: refresh\n\n"));
      });

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      controller.enqueue(encoder.encode(": connected\n\n"));
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
