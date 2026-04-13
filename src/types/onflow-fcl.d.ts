declare module "@onflow/fcl" {
  export function config(cfg?: Record<string, string>): {
    put(key: string, value: string): ReturnType<typeof config>;
  };
  export function authenticate(): Promise<void>;
  export function unauthenticate(): Promise<void>;

  interface CurrentUserObject {
    subscribe(callback: (user: { addr: string | null; loggedIn: boolean }) => void): void;
  }

  export const currentUser: CurrentUserObject;

  export function query(opts: {
    cadence: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args?: (...a: any[]) => unknown[];
  }): Promise<unknown>;

  export function mutate(opts: {
    cadence: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args?: (...a: any[]) => any[];
    proposer?: unknown;
    payer?: unknown;
    authorizations?: unknown[];
    limit?: number;
  }): Promise<string>;

  export const authz: unknown;

  export function tx(transactionId: string): {
    onceSealed(): Promise<{
      status: number;
      statusCode: number;
      errorMessage: string;
      events: unknown[];
    }>;
  };

  export function arg(value: unknown, type: unknown): unknown;
}

declare module "@onflow/types" {
  const UFix64: unknown;
  const Address: unknown;
  const String: unknown;
  const UInt64: unknown;
  const Int: unknown;
  export { UFix64, Address, String, UInt64, Int };
  export default { UFix64, Address, String, UInt64, Int };
}
