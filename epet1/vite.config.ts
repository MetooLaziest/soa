import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/epet/",
  plugins: [react()],
  build: {
    // 输出到 dist/epet/ 子目录，打包时从 dist/ 根 tar 解压到服务器 dist/epet/ 即可
    // 这样 index.html 和 assets/ 都在 epet/ 下，绝不会覆盖根首页
    outDir: "dist/epet",
  },
});
