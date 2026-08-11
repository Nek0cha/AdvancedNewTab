// vite.web.config.ts のビルドスクリプト。
//
// このプロジェクトの環境（Node.js v24.12.0 / Windows）では、`fs.rmSync(dir, { recursive:
// true, force: true })` が site/app/ のような「Viteのビルド成果物が入った既存ディレクトリ」
// に対して単体で呼び出すだけでもネイティブクラッシュする（Node側からは 0xC0000409 系の
// 異常終了として見える）ことを確認済み。シェルの `rm -rf` やエクスプローラーからの削除は
// 問題なく、Vite/Rollup自体にも問題はない（一時ディレクトリへのビルド自体は毎回成功する）
// ため、Node の再帰削除の実装固有の不具合と見て、再帰オプションに頼らず
// readdir/unlink/rmdir を1階層ずつ手で辿る自前実装に置き換えて回避している。
import { existsSync, mkdtempSync, readdirSync, renameSync, rmdirSync, statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

/** fs.rmSync({recursive:true}) の代わりに使う、素朴な自前の再帰削除。 */
function removeDirRecursive(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const target = path.join(dir, entry);
    const stat = statSync(target);
    if (stat.isDirectory()) {
      removeDirRecursive(target);
    } else {
      unlinkSync(target);
    }
  }
  rmdirSync(dir);
}

const siteDir = fileURLToPath(new URL('../site', import.meta.url));
const finalOutDir = path.join(siteDir, 'app');

// OS標準の一時ディレクトリ配下にビルドする（site/ の外なので、既存ファイルの有無と
// 無関係な、確実にまっさらな場所になる）。
const tmpOutDir = mkdtempSync(path.join(tmpdir(), 'advanced-new-tab-web-'));
const buildOutDir = path.join(tmpOutDir, 'app');

try {
  await build({
    configFile: fileURLToPath(new URL('../vite.web.config.ts', import.meta.url)),
    build: { outDir: buildOutDir },
  });

  removeDirRecursive(finalOutDir);
  renameSync(buildOutDir, finalOutDir);
  console.log(`✔ ${path.relative(process.cwd(), finalOutDir)} に出力しました`);
} finally {
  removeDirRecursive(tmpOutDir);
}
