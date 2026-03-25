// @bun
// src/index.ts
import { join } from "path";
import { existsSync } from "fs";
async function getRenderMode(sourcePath) {
  try {
    const src = await Bun.file(sourcePath).text();
    if (/export\s+const\s+render\s*=\s*["']server["']/.test(src))
      return "server";
    if (/export\s+const\s+render\s*=\s*["']static["']/.test(src))
      return "static";
  } catch {}
  return "client";
}
var BANNED_HOOKS = [
  "useState",
  "useEffect",
  "useReducer",
  "useCallback",
  "useMemo",
  "useRef",
  "useContext",
  "useLayoutEffect",
  "useId",
  "useImperativeHandle",
  "useDebugValue",
  "useDeferredValue",
  "useTransition",
  "useSyncExternalStore"
];
var BANNED_EVENTS = [
  "onClick",
  "onChange",
  "onSubmit",
  "onInput",
  "onFocus",
  "onBlur",
  "onMouseEnter",
  "onMouseLeave",
  "onKeyDown",
  "onKeyUp"
];
function validateServerIsland(sourceCode, _filePath) {
  const errors = [];
  for (const hook of BANNED_HOOKS) {
    if (new RegExp(`\\b${hook}\\s*\\(`).test(sourceCode)) {
      errors.push(`Cannot use React hook "${hook}" in a static/server page`);
    }
  }
  for (const event of BANNED_EVENTS) {
    if (sourceCode.includes(`${event}=`)) {
      errors.push(`Cannot use event handler "${event}" in a static/server page`);
    }
  }
  if (/window\.|document\.|localStorage\.|sessionStorage\./.test(sourceCode)) {
    errors.push("Cannot access browser APIs (window/document/localStorage) in a static/server page");
  }
  return { valid: errors.length === 0, errors };
}
function isServerIsland(sourceCode) {
  return /export\s+const\s+render\s*=\s*["'](server|static)["']/.test(sourceCode);
}
function extractStaticHTML(sourceCode, filePath = "unknown") {
  try {
    const returnMatch = sourceCode.match(/return\s*\(/s);
    if (!returnMatch)
      return null;
    const codeBeforeReturn = sourceCode.substring(0, returnMatch.index);
    for (const hook of BANNED_HOOKS) {
      if (new RegExp(`\\b${hook}\\s*\\(`).test(codeBeforeReturn))
        return null;
    }
    const fullReturnMatch = sourceCode.match(/return\s*\(([\s\S]*?)\);?\s*\}/s);
    if (!fullReturnMatch?.[1])
      return null;
    let html = fullReturnMatch[1].trim();
    html = html.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    html = html.replace(/className=/g, "class=");
    html = convertStyleObjects(html);
    html = fixVoidElements(html);
    html = removeJSExpressions(html);
    html = html.replace(/\s+/g, " ").trim();
    return html;
  } catch {
    return null;
  }
}
function convertStyleObjects(html) {
  return html.replace(/style=\{\{([^}]+)\}\}/g, (_match, styleObj) => {
    try {
      const cssString = styleObj.split(",").map((prop) => {
        const colonIdx = prop.indexOf(":");
        if (colonIdx === -1)
          return "";
        const key = prop.substring(0, colonIdx).trim();
        const value = prop.substring(colonIdx + 1).trim();
        if (!key || !value)
          return "";
        const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
        const cssValue = value.replace(/['"]/g, "");
        return `${cssKey}: ${cssValue}`;
      }).filter(Boolean).join("; ");
      return `style="${cssString}"`;
    } catch {
      return 'style=""';
    }
  });
}
var VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);
function fixVoidElements(html) {
  return html.replace(/<(\w+)([^>]*)\s*\/>/g, (_match, tag, attrs) => {
    return VOID_ELEMENTS.has(tag.toLowerCase()) ? `<${tag}${attrs}/>` : `<${tag}${attrs}></${tag}>`;
  });
}
function removeJSExpressions(html) {
  return html.replace(/\{`([^`]*)`\}/g, "$1").replace(/\{(['"])(.*?)\1\}/g, "$2").replace(/\{(\d+)\}/g, "$1").replace(/\{[^}]+\}/g, "");
}
async function renderPageToHTML(compiledPagePath, _buildDir) {
  try {
    const projectRoot = compiledPagePath.split(".bertuibuild")[0];
    const reactPath = join(projectRoot, "node_modules", "react", "index.js");
    const reactDomServerPath = join(projectRoot, "node_modules", "react-dom", "server.js");
    if (!existsSync(reactPath) || !existsSync(reactDomServerPath))
      return null;
    const React = await import(reactPath);
    const { renderToString } = await import(reactDomServerPath);
    const mod = await import(`${compiledPagePath}?t=${Date.now()}`);
    const Component = mod.default;
    if (typeof Component !== "function")
      return null;
    return renderToString(React.createElement(Component));
  } catch {
    return null;
  }
}
async function validateAllServerIslands(routes) {
  const serverIslands = [];
  const validationResults = [];
  for (const route of routes) {
    try {
      const src = await Bun.file(route.path).text();
      if (!isServerIsland(src))
        continue;
      const result = validateServerIsland(src, route.path);
      serverIslands.push(route);
      validationResults.push({ ...result, route: route.route, path: route.path });
    } catch {}
  }
  return { serverIslands, validationResults };
}
export {
  validateServerIsland,
  validateAllServerIslands,
  renderPageToHTML,
  isServerIsland,
  getRenderMode,
  extractStaticHTML
};
