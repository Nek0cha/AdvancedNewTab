/**
 * background.ts が保持する「今どのタブが何を再生しているか」の集約ロジック。
 * 複数の YouTube/YouTube Music タブが開かれている状況を想定し、
 * 再生中のものを優先し、無ければ直近に更新されたものを表示対象に選ぶ。
 */
import type { MediaState } from '@/lib/media-relay';

interface Entry {
  state: MediaState;
  updatedAt: number;
}

export class MediaStore {
  private entries = new Map<number, Entry>();

  set(tabId: number, state: MediaState | null): void {
    if (state) this.entries.set(tabId, { state, updatedAt: Date.now() });
    else this.entries.delete(tabId);
  }

  remove(tabId: number): void {
    this.entries.delete(tabId);
  }

  /** 現在表示すべき状態と、その送信元タブID。何も無ければ両方 null。 */
  current(): { state: MediaState | null; tabId: number | null } {
    let best: { tabId: number; entry: Entry } | null = null;

    for (const [tabId, entry] of this.entries) {
      if (!best) {
        best = { tabId, entry };
        continue;
      }
      const bestPlaying = best.entry.state.playing;
      const thisPlaying = entry.state.playing;
      // 再生中を優先。同条件なら直近更新を優先。
      if (thisPlaying && !bestPlaying) {
        best = { tabId, entry };
      } else if (thisPlaying === bestPlaying && entry.updatedAt > best.entry.updatedAt) {
        best = { tabId, entry };
      }
    }

    return best ? { state: best.entry.state, tabId: best.tabId } : { state: null, tabId: null };
  }
}
