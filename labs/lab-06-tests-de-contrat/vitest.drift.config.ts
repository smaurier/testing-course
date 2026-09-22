import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@contract": at("./solution/contract/invitation.contract"),
      "@consumer": at("./consumer/fetchInvitation"),
      "@provider": at("./provider-mutant/getInvitationResponse"),
    },
  },
  test: { include: ["test/contract.provider.test.ts"] },
});
