/**
 * リンク集アイコンの「アイコンから選ぶ」タブで提示する候補。
 * 個人のショートカット集で需要が高そうな系統に絞っている（多すぎると選びにくいため）。
 */
import {
  Banknote,
  Calendar,
  Cloud,
  Code,
  FileText,
  Gamepad2,
  Globe,
  Image as ImageIcon,
  Mail,
  MessageCircle,
  Music,
  Newspaper,
  ShoppingCart,
  Video,
  type LucideIcon,
} from 'lucide-react';

export interface LinkIconOption {
  id: string;
  label: string;
  Icon: LucideIcon;
}

export const LINK_ICON_OPTIONS: LinkIconOption[] = [
  { id: 'mail', label: 'メール', Icon: Mail },
  { id: 'calendar', label: 'カレンダー', Icon: Calendar },
  { id: 'video', label: '動画', Icon: Video },
  { id: 'music', label: '音楽', Icon: Music },
  { id: 'code', label: '開発・コード', Icon: Code },
  { id: 'chat', label: 'チャット', Icon: MessageCircle },
  { id: 'file', label: 'ドキュメント', Icon: FileText },
  { id: 'newspaper', label: 'ニュース', Icon: Newspaper },
  { id: 'cart', label: '買い物', Icon: ShoppingCart },
  { id: 'bank', label: '金融', Icon: Banknote },
  { id: 'game', label: 'ゲーム', Icon: Gamepad2 },
  { id: 'image', label: '画像', Icon: ImageIcon },
  { id: 'cloud', label: 'クラウド', Icon: Cloud },
  { id: 'globe', label: 'その他サイト', Icon: Globe },
];

export function getLinkIconOption(id: string): LinkIconOption | undefined {
  return LINK_ICON_OPTIONS.find((o) => o.id === id);
}
