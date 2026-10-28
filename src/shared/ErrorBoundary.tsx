import { Component } from 'react';
import type { ReactNode } from 'react';
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="tool-panel empty-state" role="alert">
      <h2>工具暂时无法加载</h2><p>请检查网络连接，再重新载入页面。</p>
      <button className="button button-primary" onClick={() => window.location.reload()}>重新载入</button>
    </div>;
    return this.props.children;
  }
}
