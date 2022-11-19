/* Partial HTML module polyfill */

if (window._htmlModulePolyfill === undefined) {
  window._htmlModulePolyfill = {
    fragments: [],
  };
}
const globalData = window._htmlModulePolyfill;
const url = new URL(import.meta.url).search.substr(1);
const response = await fetch(url);
const text = await response.text();
const fragment = document.createRange().createContextualFragment(text);
const fragmentIndex = globalData.fragments.length;
globalData.fragments.push(fragment);
const elements = Array.from(fragment.children);
const script = elements.find(el => el instanceof HTMLScriptElement);
// Polyfill `import.meta.document`
let scriptText = script.text;
scriptText = scriptText.replaceAll('import.meta.document', `window._htmlModulePolyfill.fragments[${fragmentIndex}]`);
// Relative imports won't work from Blob, convert to absolute imports
const relativeImportRegex = /(import (?:.*? from )?["'])((?:.\/|..\/|\/)[^"']+)(["'];)/g;
scriptText = scriptText.replace(relativeImportRegex, function replacer(match, part1, importPath, part2) {
  const absoluteImportUrl = new URL(importPath, response.url).href;
  return `${part1}${absoluteImportUrl}${part2}`;
});
const scriptBlobUrl = URL.createObjectURL(new Blob([scriptText], {type: 'text/javascript'}));

export default (await import(scriptBlobUrl)).default;
