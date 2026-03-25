// @bun
var __require = import.meta.require;

// src/index.ts
import { transform } from "lightningcss";
import { join } from "path";
import { existsSync, readdirSync, mkdirSync } from "fs" with { type: "json" };
var DEFAULT_TARGETS = {
  chrome: 90 << 16,
  firefox: 88 << 16,
  safari: 14 << 16,
  edge: 90 << 16
};
async function minifyCSS(css, options = {}) {
  const { filename = "style.css", minify = true, sourceMap = false } = options;
  if (!css.trim())
    return "/* No CSS */";
  try {
    const { code } = transform({
      filename,
      code: Buffer.from(css),
      minify,
      sourceMap,
      targets: DEFAULT_TARGETS,
      drafts: { nesting: true }
    });
    return code.toString();
  } catch {
    return fallbackMinify(css);
  }
}
function minifyCSSSync(css, options = {}) {
  const { filename = "style.css", minify = true, sourceMap = false } = options;
  if (!css.trim())
    return "/* No CSS */";
  try {
    const { code } = transform({
      filename,
      code: Buffer.from(css),
      minify,
      sourceMap,
      targets: DEFAULT_TARGETS,
      drafts: { nesting: true }
    });
    return code.toString();
  } catch {
    return fallbackMinify(css);
  }
}
function fallbackMinify(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{}:;,])\s*/g, "$1").replace(/;}/g, "}").trim();
}
function combineCSS(files) {
  return files.map(({ filename, content }) => `/* ${filename} */
${content}`).join(`

`);
}
function hashClassName(filename, className) {
  const str = filename + className;
  let hash = 0;
  for (let i = 0;i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).slice(0, 5);
}
function scopeCSSModule(cssText, filename) {
  const classNames = new Set;
  const classRegex = /\.([a-zA-Z_][a-zA-Z0-9_-]*)\s*[{,\s:]/g;
  let match;
  while ((match = classRegex.exec(cssText)) !== null) {
    classNames.add(match[1]);
  }
  const mapping = {};
  for (const cls of classNames) {
    mapping[cls] = `${cls}_${hashClassName(filename, cls)}`;
  }
  let scopedCSS = cssText;
  for (const [original, scoped] of Object.entries(mapping)) {
    scopedCSS = scopedCSS.replace(new RegExp(`\\.${original}(?=[\\s{,:\\[#.>+~)\\]])`, "g"), `.${scoped}`);
  }
  return { mapping, scopedCSS };
}
async function buildAllCSS(root, outDir) {
  const srcStylesDir = join(root, "src", "styles");
  const stylesOutDir = join(outDir, "styles");
  mkdirSync(stylesOutDir, { recursive: true });
  let combined = "";
  if (existsSync(srcStylesDir)) {
    const cssFiles = readdirSync(srcStylesDir).filter((f) => f.endsWith(".css") && !f.endsWith(".module.css"));
    for (const file of cssFiles) {
      const content = await Bun.file(join(srcStylesDir, file)).text();
      combined += `/* ${file} */
${content}

`;
    }
  }
  const minified = combined.trim() ? await minifyCSS(combined, { filename: "bertui.min.css" }) : "/* No CSS */";
  await Bun.write(join(stylesOutDir, "bertui.min.css"), minified);
}
async function processSCSS(scssCode, options = {}) {
  const sass = await import("sass").catch(() => {
    throw new Error("sass not installed. Run: bun add sass");
  });
  const result = sass.compileString(scssCode, {
    style: "expanded",
    sourceMap: false,
    loadPaths: options.loadPaths ?? []
  });
  return result.css;
}
export {
  scopeCSSModule,
  processSCSS,
  minifyCSSSync,
  minifyCSS,
  combineCSS,
  buildAllCSS
};
