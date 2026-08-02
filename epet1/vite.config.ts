import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 编译时分发:
//   - soa 域: 不传 env (VITE_BASE / VITE_OUT_DIR 都不设) → base=/epet/, outDir=dist/epet
//   - vn  域: VITE_BASE=/ VITE_OUT_DIR=dist-vn → 根域 dist-vn
// 双 build 共存, 物理隔离, soa 默认零变化 (跟 7/30 旧 dist.epet 完全一致)
export default defineConfig({
  base: process.env.VITE_BASE || "/epet/",
  plugins: [react()],
  build: {
    // soa: outDir=dist/epet (index.html 和 assets/ 都在 epet/ 下, 不会覆盖根首页)
    // vn:  outDir=dist-vn  (跟 nginx 8/2 部署点 /var/www/iot-ai-doll/frontend/dist.vn 对齐)
    outDir: process.env.VITE_OUT_DIR || "dist/epet",
  },
});
