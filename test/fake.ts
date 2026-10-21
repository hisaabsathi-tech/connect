import type { Call } from "./setup";

type Reply = { status?: number; body?: unknown } | "hang";

/** The fakes `setup.ts` installs, typed for the tests. */
export const fake = (
  globalThis as unknown as {
    fake: {
      appListeners: ((state: string) => void)[];
      files: Map<string, string>;
      networkListeners: ((state: {
        isConnected?: boolean;
        isInternetReachable?: boolean;
      }) => void)[];
      networkState: { isConnected: boolean; isInternetReachable: boolean };
      secure: Map<string, string>;
      server: {
        calls: Call[];
        offline: boolean;
        portal: boolean;
        routes: Map<string, (call: Call) => Reply>;
        reset: () => void;
      };
    };
  }
).fake;

export const TOKEN = "token-1";

/** Signed in, online, nothing saved: each test starts here. */
export function freshPhone() {
  fake.server.reset();
  fake.files.clear();
  fake.secure.clear();
  fake.secure.set("hisaabsathi.connector.auth-token", TOKEN);
  fake.networkState.isConnected = true;
  fake.networkState.isInternetReachable = true;
}

/** Lets queued promises and timers settle. */
export const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/** A server error answer in the API's envelope. */
export const refuse = (message: string, status = 422) => ({
  body: { error: { message }, message, success: false },
  status,
});
