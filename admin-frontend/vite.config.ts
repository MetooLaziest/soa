import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  build: {
    // 输出到 dist/admin/ 子目录，打包时从 dist/ 根 tar 解压到服务器 dist/admin/ 即可
    // 这样 index.html 和 assets/ 都在 admin/ 下，绝不会覆盖根首页
    outDir: 'dist/admin',
  },
})
