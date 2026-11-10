// Bundles client/entry.tsx (React hydration + the B.C. Design System's
// React component library) into public/js/client.js. Run via
// `deno task build:client`. Must be re-run any time client/ or a component
// it pulls in changes - the Dockerfile runs it at image build time.
import * as esbuild from "esbuild";
import { denoPlugins } from "@luca/esbuild-deno-loader";

const configPath = `${Deno.cwd()}/deno.json`;

const result = await esbuild.build({
  plugins: [...denoPlugins({ configPath })],
  entryPoints: ["client/entry.tsx"],
  bundle: true,
  format: "esm",
  target: "es2020",
  minify: true,
  sourcemap: true,
  outfile: "public/js/client.js",
  jsx: "automatic",
  jsxImportSource: "react",
});

for (const w of result.warnings) console.warn(w.text);
for (const e of result.errors) console.error(e.text);

esbuild.stop();

if (result.errors.length > 0) {
  Deno.exit(1);
}

console.log("Built public/js/client.js");
