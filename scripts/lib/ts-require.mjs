import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";

/**
 * require() for the site's TypeScript content modules from a Node script: each .ts
 * file is transpiled on load (no type checking) and "@/..." resolves to src/...
 * For plain data modules only (content, dictionaries); nothing framework-specific.
 */
const root = path.resolve(import.meta.dirname, "../..");
const src = path.join(root, "src");

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith("@/")) request = path.join(src, request.slice(2));
  if ((request.startsWith(".") || path.isAbsolute(request)) && !path.extname(request)) {
    const base = path.isAbsolute(request) ? request : path.resolve(path.dirname(parent?.filename ?? root), request);
    for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
      try {
        readFileSync(candidate);
        return candidate;
      } catch {
        /* try the next one */
      }
    }
  }
  return resolve.call(this, request, parent, ...rest);
};

for (const ext of [".ts", ".tsx"]) {
  Module._extensions[ext] = (module, filename) => {
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      fileName: filename,
    });
    module._compile(outputText, filename);
  };
}

/** Load a module by its path from the repository root, e.g. requireTs("src/content/services.ts"). */
export const requireTs = (file) => createRequire(path.join(root, "package.json"))(path.join(root, file));
