type HeroPanelProps = {
  projectCount: number;
  documentCount: number;
  historicalBidCount: number;
};

export function HeroPanel({ projectCount, documentCount, historicalBidCount }: HeroPanelProps) {
  return (
    <div className="hero-panel">
      <div>
        <p className="eyebrow">Workbench</p>
        <h2>前后端与数据库联调工作台</h2>
        <p>
          当前重点是把投标资料库、招标解析、标书生成、标书检测、排版定稿和标书管理六个模块挂到同一套前后端和数据库上，并保留证据检索与历史标书复用闭环。
        </p>
      </div>
      <div className="hero-stats">
        <div>
          <span>项目</span>
          <strong>{projectCount}</strong>
        </div>
        <div>
          <span>文档</span>
          <strong>{documentCount}</strong>
        </div>
        <div>
          <span>历史标书</span>
          <strong>{historicalBidCount}</strong>
        </div>
      </div>
    </div>
  );
}
