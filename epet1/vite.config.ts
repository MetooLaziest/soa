import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/epet/",
  plugins: [react()],
  build: {
    outDir: "/tmp/build-temp-623657/epet",
    emptyOutDir: true,
  },
});
