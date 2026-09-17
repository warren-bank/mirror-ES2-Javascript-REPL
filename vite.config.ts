import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    base: "./",
    build: {
        outDir: "dist",
    },
    test: {
        coverage: {
            reporter: ["text", "html"],
        },
        include: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    },
});
