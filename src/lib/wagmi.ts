import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import {
  LOCAL_DEV_ENABLED,
  RPC_URL,
  WALLETCONNECT_PROJECT_ID,
  robinhoodChain,
} from "@/config/chains";
import { localDevConnector } from "@/lib/local-dev-connector";

const connectors = [
  // Dev-only, chain-31337-only test wallet. The connector module refuses to load
  // when NEXT_PUBLIC_LOCAL_DEV=true is set with any other chain id.
  ...(LOCAL_DEV_ENABLED ? [localDevConnector()] : []),
  injected({ shimDisconnect: true }),
  ...(WALLETCONNECT_PROJECT_ID
    ? [
        walletConnect({
          projectId: WALLETCONNECT_PROJECT_ID,
          showQrModal: true,
          metadata: {
            name: "PixelFun",
            description: "512×512 collaborative pixel canvas on Robinhood Chain",
            url: "https://pixelfun.xyz",
            icons: [],
          },
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [robinhoodChain],
  connectors,
  transports: {
    [robinhoodChain.id]: http(RPC_URL),
  },
  ssr: true,
});
