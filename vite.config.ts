import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs'
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  base: './',
  resolve: {
    extensions: ['.js', '.ts', '.json', '.wasm']
  },
  plugins: [
    viteCommonjs(),
    // checker({ typescript: true }),
    topLevelAwait(),
    {
      name: "configure-response-headers",
      configureServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
          res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          next();
        });
      },
    },
  ],
});
