import {
  createWalletClient,
  custom,
  http,
  numberToHex,
  type Address,
  type Hex,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createConnector } from "wagmi";
import {
  CHAIN_ID,
  LOCAL_DEV_CHAIN_ID,
  LOCAL_DEV_ENABLED,
  RPC_URL,
  robinhoodChain,
} from "@/config/chains";

/**
 * DEV ONLY. The first Anvil account from the public test mnemonic
 * ("test test ... junk"). It is a well-known key, never a real one.
 */
export const ANVIL_TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

const account = privateKeyToAccount(ANVIL_TEST_PRIVATE_KEY);

if (LOCAL_DEV_ENABLED && CHAIN_ID !== LOCAL_DEV_CHAIN_ID) {
  throw new Error(
    `NEXT_PUBLIC_LOCAL_DEV=true is only allowed with NEXT_PUBLIC_CHAIN_ID=${LOCAL_DEV_CHAIN_ID} ` +
      `(got ${CHAIN_ID}). Refusing to build/run a dev wallet connector against a real network.`,
  );
}

interface RpcError {
  code: number;
  message: string;
}

async function forward(method: string, params: unknown): Promise<unknown> {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params: params ?? [] }),
  });
  const body = (await response.json()) as { result?: unknown; error?: RpcError };
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

function localProvider(): WalletClient {
  return createWalletClient({
    account,
    chain: robinhoodChain,
    transport: http(RPC_URL),
  });
}

/** EIP-1193 provider that signs eth_sendTransaction locally with the test key. */
function provider() {
  let wallet: WalletClient | null = null;
  const request = async ({
    method,
    params,
  }: {
    method: string;
    params?: unknown;
  }): Promise<unknown> => {
    if (method === "eth_chainId") return numberToHex(CHAIN_ID);
    if (method === "net_version") return String(CHAIN_ID);
    if (method === "eth_accounts" || method === "eth_requestAccounts") {
      return [account.address as Address];
    }
    if (method === "wallet_switchEthereumChain") return null;
    if (method === "eth_sendTransaction") {
      const [tx] = (params as Array<{
        from?: Address;
        to?: Address;
        data?: Hex;
        value?: Hex;
        gas?: Hex;
      }>) ?? [];
      if (tx?.from && tx.from.toLowerCase() !== account.address.toLowerCase()) {
        throw new Error("Local dev connector only signs for the Anvil test account.");
      }
      wallet ??= localProvider();
      return wallet.sendTransaction({
        account,
        chain: robinhoodChain,
        to: tx?.to,
        data: tx?.data,
        value: tx?.value ? BigInt(tx.value) : undefined,
        gas: tx?.gas ? BigInt(tx.gas) : undefined,
      });
    }
    return forward(method, params);
  };

  return custom({ request })({ retryCount: 0 });
}

/**
 * Adds an "Anvil (dev)" connector to the wallet list. Production builds do not
 * include it unless NEXT_PUBLIC_LOCAL_DEV=true, and the module throws when that
 * flag is combined with any chain id other than 31337.
 */
export function localDevConnector() {
  if (!LOCAL_DEV_ENABLED) throw new Error("Local dev connector is disabled.");
  return createConnector<ReturnType<typeof provider>>((config) => ({
    id: "anvil-dev",
    name: "Anvil (dev)",
    type: "anvilDev",
    async connect<withCapabilities extends boolean = false>({
      withCapabilities,
    }: { withCapabilities?: withCapabilities | boolean } = {}) {
      const chain = config.chains.find((candidate) => candidate.id === CHAIN_ID);
      if (!chain) throw new Error(`Chain ${CHAIN_ID} is not configured.`);
      const accounts = (
        withCapabilities
          ? [{ address: account.address as Address, capabilities: {} }]
          : [account.address as Address]
      ) as never;
      return { accounts, chainId: CHAIN_ID };
    },
    async disconnect() {},
    async getAccounts() {
      return [account.address as Address];
    },
    async getChainId() {
      return CHAIN_ID;
    },
    async isAuthorized() {
      return true;
    },
    async switchChain({ chainId }) {
      const chain = config.chains.find((candidate) => candidate.id === chainId);
      if (!chain) throw new Error(`Chain ${chainId} is not configured.`);
      return chain;
    },
    onAccountsChanged() {},
    onChainChanged() {},
    onDisconnect() {},
    async getProvider() {
      return provider();
    },
  }));
}
