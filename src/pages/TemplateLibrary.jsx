import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const TEMPLATES = [
  {
    id: 1, title: '小红书种草体', desc: '极高亲近感 / 高情绪浓度 / 强催促力度 / 种草倾向',
    tags: ['社交媒体', '种草'], category: '社交媒体', style: '轻松活泼', industry: '美妆护肤', usageCount: 2847,
    scores: { intimacy: 0.9, arousal: 0.85, urgency: 0.8, emotion_polarity: 1, info_density: 0.3 },
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="3"/></svg>
  },
  {
    id: 2, title: '公众号深度文', desc: '极高干货密度 / 极低催促力度 / 理性客观 / 专业黑话',
    tags: ['内容创作', '深度'], category: '内容创作', style: '专业严谨', industry: '科技数码', usageCount: 1523,
    scores: { intimacy: 0.2, arousal: 0.3, urgency: 0.1, info_density: 0.9, jargon_density: 0.8 },
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
  },
  {
    id: 3, title: '电商促销页', desc: '极高催促力度 / 狂热情绪 / 开门见山直白表达',
    tags: ['电商营销', '促销'], category: '电商营销', style: '轻松活泼', industry: '美食餐饮', usageCount: 1892,
    scores: { arousal: 0.95, urgency: 0.95, directness: 0.1, emotion_polarity: 0.8 },
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
  },
  {
    id: 4, title: '知乎硬核答', desc: '极高干货密度 / 极低亲近感(官方态) / 垂类黑话密集',
    tags: ['内容创作', '硬核'], category: '内容创作', style: '专业严谨', industry: '科技数码', usageCount: 956,
    scores: { intimacy: 0.1, info_density: 0.95, jargon_density: 0.9, arousal: 0.1 },
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21h6"/><path d="M10.5 21v-3"/><path d="M13.5 21v-3"/><path d="M8 12.5v-1a4 4 0 1 1 8 0v1a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z"/></svg>
  },
  {
    id: 5, title: '朋友圈轻语录', desc: '高含蓄度(留白) / 情绪浓郁 / 低干货密度',
    tags: ['社交媒体', '日常分享'], category: '社交媒体', style: '情感浓郁', industry: '美妆护肤', usageCount: 3104,
    scores: { directness: 0.8, arousal: 0.8, info_density: 0.1, intimacy: 0.8 },
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  },
  {
    id: 6, title: '专业白皮书', desc: '低亲近感(官方态) / 中性褒贬倾向 / 极度理性克制',
    tags: ['商务文档', '官方发布'], category: '商务文档', style: '专业严谨', industry: '科技数码', usageCount: 412,
    scores: { intimacy: 0.1, emotion_polarity: 0.5, arousal: 0.1, urgency: 0.1 },
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
  }
];

function formatUsage(count) {
  return count.toLocaleString();
}

function TemplateLibrary() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState('模板库');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortType, setSortType] = useState('hot');
  const [activeFilters, setActiveFilters] = useState({});
  const [toastMsg, setToastMsg] = useState(null);
  const [toastType, setToastType] = useState('success');

  const showToast = (msg, type = 'success') => {
    setToastMsg(msg); setToastType(type);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const filterGroups = useMemo(() => {
    const counts = { category: {}, style: {}, industry: {} };
    TEMPLATES.forEach(t => {
      counts.category[t.category] = (counts.category[t.category] || 0) + 1;
      counts.style[t.style] = (counts.style[t.style] || 0) + 1;
      counts.industry[t.industry] = (counts.industry[t.industry] || 0) + 1;
    });
    return [
      { key: 'category', label: '场景', options: Object.entries(counts.category).map(([name, count]) => ({ name, count })) },
      { key: 'style', label: '风格', options: Object.entries(counts.style).map(([name, count]) => ({ name, count })) },
      { key: 'industry', label: '行业', options: Object.entries(counts.industry).map(([name, count]) => ({ name, count })) }
    ];
  }, []);

  const handleMenuClick = (item) => {
    setActiveMenu(item);
    if (item === '首页') navigate('/');
    if (item === '工作台') navigate('/workspace');
    if (item === '我的') navigate('/my');
    if (item === '设置') navigate('/settings');
  };

  const toggleFilter = (groupKey, optionName) => {
    setActiveFilters(prev => {
      const current = prev[groupKey];
      if (current === optionName) {
        const next = { ...prev };
        delete next[groupKey];
        return next;
      }
      return { ...prev, [groupKey]: optionName };
    });
  };

  const filteredTemplates = useMemo(() => {
    let result = TEMPLATES;

    // 搜索过滤
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }

    // 侧边栏筛选
    for (const [groupKey, selected] of Object.entries(activeFilters)) {
      if (selected) {
        result = result.filter(t => t[groupKey] === selected);
      }
    }

    // 排序
    if (sortType === 'hot') {
      result = [...result].sort((a, b) => b.usageCount - a.usageCount);
    } else if (sortType === 'name') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title, 'zh'));
    }

    return result;
  }, [searchQuery, sortType, activeFilters]);

  const handleCollectTemplate = (template) => {
    const newTemplate = {
      id: Date.now().toString(),
      name: template.title,
      scores: template.scores
    };

    const existingData = localStorage.getItem('abbel_templates');
    const templates = existingData ? JSON.parse(existingData) : [];
    templates.push(newTemplate);

    localStorage.setItem('abbel_templates', JSON.stringify(templates));
    showToast(`已将 [${template.title}] 配置添加至您的记忆槽！`);
  };

  const handleCopyFingerprint = (template) => {
    if (!template.scores) {
      showToast('该模板暂无指纹数据', 'error');
      return;
    }
    const fingerprint = `ABBEL_PRESET:${JSON.stringify(template.scores)}`;
    navigator.clipboard.writeText(fingerprint).then(() => {
      showToast(`已复制 [${template.title}] 的专属调参指纹！`);
    }).catch(() => {
      showToast('复制失败，请重试', 'error');
    });
  };

  return (
    <div className="workspace-page" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, padding: 0, margin: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100vw', maxWidth: 'none' }}>
      {toastMsg && (
        <div style={{
          position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(30, 30, 30, 0.85)', backdropFilter: 'blur(8px)',
          border: `1px solid ${toastType === 'success' ? 'rgba(102,255,136,0.4)' : 'rgba(255,100,100,0.4)'}`, 
          borderRadius: '6px', padding: '8px 16px', color: toastType === 'success' ? '#66FF88' : '#ff6b6b', 
          fontSize: '13px', fontWeight: '500', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', animation: 'fadeIn 0.2s ease-out'
        }}>
          <span style={{ display: 'inline-block', width: '6px', height: '6px', background: toastType === 'success' ? '#66FF88' : '#ff6b6b', borderRadius: '50%' }}></span>
          {toastMsg}
        </div>
      )}
        {/* 顶部全局导航栏 (满宽贴边) */}
        <div className="top-bar" style={{ margin: 0, width: '100%', flexShrink: 0, borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', boxSizing: 'border-box', display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '1440px', padding: '0 24px' }}>
            <div className="nameplate">[ ABBEL -01 / 筑达每次沟通 ]</div>
            <div className="nav-pills">
              {['首页', '工作台', '模板库', '我的', '设置'].map((item) => (
                <div
                  key={item}
                  className={`nav-pill ${activeMenu === item ? 'active' : ''}`}
                  onClick={() => handleMenuClick(item)}
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="nameplate">V4.0 // TRANSLUCENT</div>
          </div>
        </div>

        {/* 工作区：恢复内边距与居中限宽 */}
        <div style={{ flex: 1, padding: '24px', boxSizing: 'border-box', display: 'flex', justifyContent: 'center', overflow: 'hidden', width: '100%' }}>
          <div style={{ display: 'flex', gap: '24px', width: '100%', maxWidth: '1440px', height: '100%' }}>
          {/* 左侧筛选侧边栏 */}
          <div className="glass-module" style={{ width: '260px', flexShrink: 0, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '1px', marginBottom: '8px' }}>[ TEMPLATE_FILTER ]</div>
            {filterGroups.map((group, idx) => (
              <details key={group.key} className="sidebar-group" open={idx === 0}>
                <summary>{group.label}</summary>
                <div className="sidebar-content">
                  {group.options.map((option) => (
                    <div
                      key={option.name}
                      className={`filter-item ${activeFilters[group.key] === option.name ? 'active' : ''}`}
                      onClick={() => toggleFilter(group.key, option.name)}
                    >
                      <span>{option.name}</span>
                      <span className="filter-count">{option.count}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>

          {/* 右侧模板网格区 */}
          <div className="main-content" style={{ flex: 1, padding: '0 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {/* 搜索与控制条 */}
            <div className="toolbar">
              <div className="search-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px', opacity: 0.5, flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  className="search-input"
                  placeholder="搜索模板名称或描述..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select className="sort-select" value={sortType} onChange={(e) => setSortType(e.target.value)}>
                <option value="hot">热门优先</option>
                <option value="new">最新发布</option>
                <option value="name">名称排序</option>
              </select>
            </div>

            <div className="result-count">找到 <span>{filteredTemplates.length}</span> 个模板</div>

            {/* 模板卡片网格 */}
            <div className="template-grid">
              {filteredTemplates.map((template) => (
                <div key={template.id} className="template-card">
                  <div className="card-cover">
                    {template.icon}
                  </div>
                  <h3 className="card-title">{template.title}</h3>
                  <p className="card-desc">{template.desc}</p>
                  <div className="card-tags">
                    {template.tags.map((tag) => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                  <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', height: '32px' }}>
                    {/* 左侧：保留社交证明 */}
                    <div className="usage-count" style={{ opacity: 0.5, margin: 0, fontSize: '12px' }}>
                      {formatUsage(template.usageCount)}次使用
                    </div>

                    {/* 右侧：操作图标组 */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        className="btn-tool"
                        title="复制调参指纹 (暗码)"
                        style={{ padding: '0', height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '4px' }}
                        onClick={() => handleCopyFingerprint(template)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      </button>

                      <button
                        className="btn-tool"
                        title="收藏至我的记忆槽"
                        style={{ padding: '0', height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: 'rgba(255,107,61,0.3)', color: 'var(--color-accent-primary)', borderRadius: '4px', transition: 'all 0.2s' }}
                        onClick={() => handleCollectTemplate(template)}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,107,61,0.15)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredTemplates.length === 0 && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'var(--color-text-secondary)' }}>
                  <svg viewBox="0 0 24 24" style={{ width: '48px', height: '48px', stroke: 'currentColor', fill: 'none', strokeWidth: 1.5, marginBottom: '16px', opacity: 0.5 }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
                  </svg>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>未匹配到任何模板</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>尝试调整侧边栏筛选条件或更换搜索词</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemplateLibrary;
