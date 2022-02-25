/// <reference types="vitest" />
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [],
    test: {
        globals: true,
    },
    build: {
        outDir: "../server/build/public",
        emptyOutDir: true,
    },
});
