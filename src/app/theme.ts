import { useEffect, useState } from 'react';
export type Theme = 'light' | 'dark' | 'system';
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      // 兼容旧品牌版本的主题偏好；后续统一写入项目名称对应的 key。
      const saved = localStorage.getItem('dev-toolbox-theme') ?? localStorage.getItem('devkit-theme');
      return saved === 'dark' || saved === 'system' ? saved : 'light';
    } catch { return 'light'; }
  });
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
    };
    apply();
    media.addEventListener('change', apply);
    try {
      localStorage.setItem('dev-toolbox-theme', theme);
      localStorage.removeItem('devkit-theme');
    } catch { /* 禁用存储时仍可在会话内切换主题。 */ }
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  return [theme, setTheme] as const;
}
