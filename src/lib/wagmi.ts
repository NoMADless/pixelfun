import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import {
  RPC_URL,
  WALLETCONNECT_PROJECT_ID,
  robinhoodChain,
} from "@/config/chains";

const connectors = [
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
