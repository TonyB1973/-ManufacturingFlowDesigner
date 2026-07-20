import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const cache = new Map();
export async function loadTypeScriptModule(relativePath, baseUrl) { return import(await compile(new URL(relativePath, baseUrl))); }
async function compile(url) { if (cache.has(url.href)) return cache.get(url.href); const source = await readFile(url, 'utf8'); let compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText; for (const match of [...compiled.matchAll(/from\s+['"](\.[^'"]+)['"]/g)]) { const specifier = match[1]; const dependency = new URL(specifier.endsWith('.js') ? specifier.replace(/\.js$/, '.ts') : `${specifier}.ts`, url); const dataUrl = await compile(dependency); compiled = compiled.replaceAll(`from '${specifier}'`, `from '${dataUrl}'`).replaceAll(`from "${specifier}"`, `from "${dataUrl}"`); } const dataUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`; cache.set(url.href, dataUrl); return dataUrl; }
