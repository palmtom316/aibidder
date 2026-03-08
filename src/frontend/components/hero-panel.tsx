type HeroPanelProps = {
  projectCount: number;
  documentCount: number;
  historicalBidCount: number;
};

export function HeroPanel({ projectCount, documentCount, historicalBidCount }: HeroPanelProps) {
  return (
    <section className="hero-panel" aria-label="首页引导区">
      <div className="stack compact">
        <p className="eyebrow">首页</p>
        <h2>今天先处理哪一步？</h2>
        <p>可以先补齐投标资料，也可以直接回到上次停下的步骤继续处理。</p>
      </div>

      <div className="hero-stats workspace-grid workspace-grid-3" aria-label="当前概况">
        <div>
          <span>在办项目</span>
          <strong>{projectCount}</strong>
        </div>
        <div>
          <span>已收资料</span>
          <strong>{documentCount}</strong>
        </div>
        <div>
          <span>可复用历史标书</span>
          <strong>{historicalBidCount}</strong>
        </div>
      </div>
    </section>
  );
}
