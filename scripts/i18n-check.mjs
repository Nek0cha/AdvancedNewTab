// コード中の日本語の文字列リテラル・JSXテキストを集め、各言語の辞書に訳が無いものを列出する。
// 使い方: pnpm i18n:check            … 言語ごとの未訳件数
//         pnpm i18n:check --missing ko … ko の未訳キーを JSON で出力（翻訳作業用）
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOTS = ['components', 'entrypoints', 'lib', 'widgets'];
const SKIP = [path.join('lib', 'i18n')];
const JA = /[\u3040-\u30ff\u3400-\u9fff]/;

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (SKIP.some((s) => p.startsWith(s))) continue;
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const keys = new Set();
for (const file of ROOTS.flatMap((r) => walk(r, []))) {
  const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = (node) => {
    let text;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
    else if (ts.isJsxText(node)) text = node.text.trim();
    // console 出力や例外メッセージは利用者に見えないので対象外
    if (text && JA.test(text) && !isDevOnly(node)) keys.add(text);
    ts.forEachChild(node, visit);
  };
  visit(src);
}

function isDevOnly(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p) && /^console\./.test(p.expression.getText())) return true;
    if (ts.isNewExpression(p) && /Error$/.test(p.expression.getText())) return true;
    if (ts.isCallExpression(p) || ts.isNewExpression(p)) return false;
  }
  return false;
}

const locales = fs.readdirSync('lib/i18n/messages').map((f) => f.replace(/\.ts$/, ''));
const load = (l) => {
  const src = fs.readFileSync(`lib/i18n/messages/${l}.ts`, 'utf8');
  const sf = ts.createSourceFile(l, src, ts.ScriptTarget.Latest, true);
  const found = new Set();
  const visit = (n) => {
    if (ts.isPropertyAssignment(n) && (ts.isStringLiteral(n.name) || ts.isIdentifier(n.name))) found.add(n.name.text);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
};

const idx = process.argv.indexOf('--missing');
if (idx >= 0) {
  const l = process.argv[idx + 1];
  const have = load(l);
  console.log(JSON.stringify([...keys].filter((k) => !have.has(k)).sort(), null, 1));
} else {
  console.log(`原文 ${keys.size} 件`);
  for (const l of locales) {
    const have = load(l);
    const missing = [...keys].filter((k) => !have.has(k)).length;
    console.log(`${l.padEnd(6)} 未訳 ${missing}`);
  }
}
