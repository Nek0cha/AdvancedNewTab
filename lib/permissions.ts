/**
 * optional_permissions / optional_host_permissions の要求・確認を一元化する層。
 *
 * 必須権限は storage / unlimitedStorage / favicon / alarms のみとし、
 * ブックマークや履歴のようなユーザーデータへのアクセスは、該当ウィジェットを
 * 配置した瞬間にだけ要求する（wxt.config.ts のコメントも参照）。
 *
 * 重要な制約: chrome.permissions.request() はユーザージェスチャーのコールスタック内でしか
 * 呼び出せない。await を挟むと（たとえ直前でも）ジェスチャー扱いが切れてブラウザに
 * 拒否されることがあるため、呼び出し側はこの関数をクリックハンドラの先頭から
 * 同期的に呼ぶこと。
 */

import { isExtensionContext } from '@/lib/platform';
import type { AnyWidgetDef } from '@/widgets/types';

export interface PermissionSpec {
  chrome?: readonly string[];
  hosts?: readonly string[];
}

/**
 * PermissionSpec を chrome.permissions.* が受け取れる形に変換する。
 *
 * WidgetDef.permissions.chrome は string[] で宣言できるようにしている（ウィジェット定義側の
 * 書きやすさを優先）一方、browser.permissions.* の型は manifest.json の値から生成された
 * ManifestPermission という閉じた文字列合併型を要求する。ここでの as キャストは、
 * 実際に manifest.json 側で宣言済みの値しか渡らないことを人間が保証する前提の橋渡しであり、
 * 誤った権限名を渡しても実行時には chrome.permissions.request 側が拒否するだけで安全側に倒れる。
 */
function toPermissionsRequest(
  spec: PermissionSpec,
): { permissions: Browser.runtime.ManifestPermission[]; origins: string[] } | null {
  const chromePerms = spec.chrome ?? [];
  const hosts = spec.hosts ?? [];
  if (chromePerms.length === 0 && hosts.length === 0) return null;
  return {
    permissions: [...chromePerms] as Browser.runtime.ManifestPermission[],
    origins: [...hosts],
  };
}

/** 指定した権限を、追加の許可なしにすでに持っているか。 */
export async function hasPermissions(spec: PermissionSpec): Promise<boolean> {
  const request = toPermissionsRequest(spec);
  if (!request) return true;
  // 拡張機能コンテキスト以外（静的サイト版）には chrome.permissions 自体が存在しない。
  // 「権限」という概念そのものが無く、host権限はCORSが許す限りそのままfetchできるため、
  // 常に許可済み扱いにしてPermissionGateを素通りさせる（lib/platform.ts参照）。
  if (!isExtensionContext()) return true;
  try {
    return await browser.permissions.contains(request);
  } catch (error) {
    console.error('[AdvancedNewTab] 権限確認に失敗しました', error);
    return false;
  }
}

/**
 * 指定した権限をまとめて要求する。
 * 必ずユーザー操作のイベントハンドラから直接呼び出すこと（このファイル冒頭の注記を参照）。
 */
export async function requestPermissions(spec: PermissionSpec): Promise<boolean> {
  const request = toPermissionsRequest(spec);
  if (!request) return true;
  if (!isExtensionContext()) return true;
  try {
    return await browser.permissions.request(request);
  } catch (error) {
    console.error('[AdvancedNewTab] 権限要求に失敗しました', error);
    return false;
  }
}

/** ウィジェット定義から必要権限を確認する（AddWidgetList など、定義単位で扱う場面向け）。 */
export function hasWidgetPermissions(def: AnyWidgetDef): Promise<boolean> {
  return hasPermissions(def.permissions ?? {});
}

/** ウィジェット定義から必要権限を要求する（AddWidgetList など、定義単位で扱う場面向け）。 */
export function requestWidgetPermissions(def: AnyWidgetDef): Promise<boolean> {
  return requestPermissions(def.permissions ?? {});
}
