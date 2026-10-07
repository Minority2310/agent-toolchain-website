import react from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

// https://vite.dev/config/
export default defineConfig({
  // 站点挂在 agent.minority2310.com/toolchain 下：Workers 静态资源按请求路径找文件，
  // 所以页面里的资源地址要带 /toolchain/ 前缀，构建产物也要放在 dist/toolchain/ 里
  base: "/toolchain/",
  build: { outDir: "dist/toolchain" },
  fmt: {
    ignorePatterns: ["AGENTS.md", "plan.md", "src/data/**", "dist/**"],
  },
  lint: {
    plugins: ["react", "typescript", "oxc"],
    rules: {
      "react/rules-of-hooks": "error",
      "react/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
        },
      ],
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
  plugins: lazyPlugins(() => [react()]),
});
