import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowUpRight, ChevronRight, Code2, Command, Fingerprint, Menu, Monitor, Moon, Search, ShieldCheck, Sun, X, Zap } from 'lucide-react';
import { tools } from './registry';
import type { ToolDefinition } from './registry';
import { useTheme } from './theme';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import styles from './App.module.css';

const loadedTools = new Map(tools.map(tool => [tool.id, lazy(tool.load)]));
const captions: Record<string, string> = { json: 'JSON FORMATTER', time: 'TIMESTAMP CONVERTER', barcode: 'BARCODE STUDIO', qrcode: 'QR CODE STUDIO' };

function ToolPage({ tool }: { tool: ToolDefinition }) {
  const Content = loadedTools.get(tool.id)!;
  const Icon = tool.icon;
  useEffect(() => { document.title = `${tool.title} · dev-toolbox`; }, [tool.title]);
  return <>
    <section className={styles.intro} aria-labelledby="tool-title">
      <div className={styles.introIcon}><Icon size={27} strokeWidth={1.8} /></div>
      <div><p className={styles.eyebrow}>{captions[tool.id] ?? 'DEVELOPER TOOL'}</p><h1 id="tool-title">{tool.title}</h1><p className={styles.description}>{tool.description}</p></div>
      <span className={styles.localBadge}><span /> 本地处理</span>
    </section>
    <ErrorBoundary key={tool.id}>
      <Suspense fallback={<div className="tool-panel empty-state" role="status"><span className="spinner" /><p>正在准备工具…</p></div>}>
        <Content />
      </Suspense>
    </ErrorBoundary>
    <div className={styles.benefits}>
      <div><ShieldCheck size={18} /><span><strong>隐私优先</strong><small>你的数据始终留在浏览器中</small></span></div>
      <div><Zap size={18} /><span><strong>即开即用</strong><small>无需登录，让工作更专注</small></span></div>
      <div><Code2 size={18} /><span><strong>为开发者而造</strong><small>简单、准确，照顾每个细节</small></span></div>
    </div>
  </>;
}

export default function App() {
  const [theme, setTheme] = useTheme();
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const current = tools.find(tool => location.pathname === `/tools/${tool.id}`) ?? tools[0];
  const query = search.trim().toLocaleLowerCase();
  const filtered = tools.filter(tool => `${tool.title} ${tool.keywords.join(' ')}`.toLocaleLowerCase().includes(query));
  const categories = [...new Set(tools.map(tool => tool.category))];

  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (window.innerWidth < 768) setDrawer(true);
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    }
    window.addEventListener('keydown', shortcuts);
    return () => window.removeEventListener('keydown', shortcuts);
  }, []);

  useEffect(() => {
    if (!drawer) return;
    searchRef.current?.focus();
    const menuButton = menuRef.current;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function trap(event: KeyboardEvent) {
      if (event.key === 'Escape') { setDrawer(false); return; }
      if (event.key !== 'Tab') return;
      const nodes = sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button, input');
      if (!nodes?.length) return;
      const first = nodes[0]; const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    window.addEventListener('keydown', trap);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', trap);
      menuButton?.focus();
    };
  }, [drawer]);

  return <div className={styles.app}>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>跳到工具工作区</a>
    {drawer && <div className={styles.backdrop} onClick={() => setDrawer(false)} aria-hidden="true" />}
    <aside ref={sidebarRef} className={`${styles.sidebar} ${drawer ? styles.open : ''}`} aria-label="工具导航" role={drawer ? 'dialog' : undefined} aria-modal={drawer || undefined}>
      <div className={styles.brand}>
        <span className={styles.brandIcon}><Code2 size={25} strokeWidth={2.2} /></span>
        <span><strong>dev-toolbox</strong><small>开发者工具箱</small></span>
        <button className={`${styles.closeMenu} button button-quiet`} aria-label="关闭导航" onClick={() => setDrawer(false)}><X size={20} /></button>
      </div>
      <div className={styles.search}>
        <Search size={16} aria-hidden="true" /><input ref={searchRef} aria-label="搜索工具" placeholder="搜索工具…" value={search} onChange={event => setSearch(event.target.value)} /><kbd><Command size={10} /> K</kbd>
      </div>
      <nav className={styles.navigation}>
        {categories.map(category => {
          const items = filtered.filter(tool => tool.category === category);
          return items.length > 0 && <div className={styles.navGroup} key={category}>
            <p className={styles.groupTitle}>{category}</p>
            {items.map(tool => { const Icon = tool.icon; return <NavLink key={tool.id} to={`/tools/${tool.id}`} onClick={() => setDrawer(false)} className={({ isActive }) => `${styles.navItem} ${isActive ? styles.selected : ''}`}>
              <Icon size={19} strokeWidth={1.8} /><span>{tool.title}</span><ChevronRight size={14} className={styles.navChevron} />
            </NavLink>; })}
          </div>;
        })}
        {!filtered.length && <p className={styles.noResults}>没有找到相关工具<br /><small>试试 JSON、时间或二维码</small></p>}
      </nav>
      <div className={styles.sidebarBottom}>
        <div className={styles.privacyCard}><span className={styles.privacyIcon}><Fingerprint size={23} /></span><strong>只在你的设备上</strong><p>不上传，不留存。<br />安心处理每一份数据。</p><span className={styles.privacyLabel}><span /> 100% 浏览器内运行</span></div>
        <div className={styles.version}><span>用小工具，解决大问题</span><span>v1.0</span></div>
      </div>
    </aside>
    <div className={styles.mainColumn} inert={drawer || undefined}>
      <header className={styles.topbar}>
        <div className={styles.breadcrumb}><button ref={menuRef} className={`${styles.menuButton} button button-quiet`} aria-label="打开工具导航" aria-expanded={drawer} onClick={() => setDrawer(true)}><Menu size={20} /></button><span>工作台</span><ChevronRight size={13} /><strong>{current.title}</strong></div>
        <div className={styles.topActions}><span className={styles.topCaption}>专注开发，少一点切换<ArrowUpRight size={13} /></span><div className={styles.themeControl} role="group" aria-label="界面主题">
          {[{ value: 'light' as const, label: '浅色主题', Icon: Sun }, { value: 'dark' as const, label: '深色主题', Icon: Moon }, { value: 'system' as const, label: '跟随系统', Icon: Monitor }].map(({ value, label, Icon }) => <button key={value} title={label} aria-label={label} aria-pressed={theme === value} className={theme === value ? styles.themeActive : ''} onClick={() => setTheme(value)}><Icon size={16} /></button>)}
        </div></div>
      </header>
      <main id="main-content" tabIndex={-1} className={styles.content}>
        <Routes>{tools.map(tool => <Route path={`/tools/${tool.id}`} key={tool.id} element={<ToolPage tool={tool} />} />)}<Route path="*" element={<Navigate to="/tools/json" replace />} /></Routes>
      </main>
      <footer className={styles.footer}><span>dev-toolbox <span className={styles.footerDot}>/</span> 你的日常开发搭档</span><span><span className={styles.onlineDot} /> 本地计算 · 数据不离开设备</span></footer>
    </div>
  </div>;
}
