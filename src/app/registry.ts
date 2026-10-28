import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Braces, Clock3, Barcode, QrCode } from 'lucide-react';

/** 新工具只需提供描述与懒加载入口，导航、搜索和路由由注册表生成。 */
export interface ToolDefinition {
  id: string;
  title: string;
  description: string;
  category: string;
  keywords: string[];
  icon: LucideIcon;
  load: () => Promise<{ default: ComponentType }>;
}

export const tools: ToolDefinition[] = [
  {
    id: 'json', title: 'JSON 格式化', category: '文本工具',
    description: '让数据清晰有序。格式化、压缩与校验，一处完成。',
    keywords: ['json', 'format', '格式化', '压缩', '校验'], icon: Braces,
    load: () => import('../tools/json/JsonTool'),
  },
  {
    id: 'time', title: '时间戳转换', category: '时间工具',
    description: '在时间戳与日期之间自由转换，让每一毫秒都有意义。',
    keywords: ['time', 'timestamp', 'unix', '日期', '时间戳', 'utc'], icon: Clock3,
    load: () => import('../tools/time/TimeTool'),
  },
  {
    id: 'barcode', title: '条形码工具', category: '条码工具',
    description: '从内容到条码，从图片到信息。轻松生成与识别常用条形码。',
    keywords: ['barcode', 'code128', 'ean', 'upc', '条形码', '解码'], icon: Barcode,
    load: () => import('../tools/codes/BarcodeTool'),
  },
  {
    id: 'qrcode', title: '二维码工具', category: '条码工具',
    description: '把文字与链接装进二维码，或从图片中读取原始内容。',
    keywords: ['qr', 'qrcode', '二维码', '解码'], icon: QrCode,
    load: () => import('../tools/codes/QrTool'),
  },
];
