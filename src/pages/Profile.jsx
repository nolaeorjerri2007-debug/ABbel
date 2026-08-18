import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useAuthedSupabase } from '../lib/supabase';
import { listTemplates, deleteTemplate, listGenerations } from '../lib/data';

function Profile() {
  const navigate = useNavigate();
  const { ready } = useAuthedSupabase();
  const { user } = useUser();
  const [activeMenu, setActiveMenu] = useState('我的');
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [generations, setGenerations] = useState([]);
  const [usageCount, setUsageCount] = useState(127);
  const [toastMsg, setToastMsg] = useState(null);
  const [toastType, setToastType] = useState('success');
  const [viewGen, setViewGen] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToastMsg(msg); setToastType(type);
    setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    if (!ready) return
    listTemplates()
      .then(setSavedTemplates)
      .catch((e) => console.error('模板加载失败', e))
    listGenerations()
      .then((rows) => {
        setGenerations(rows)
        setUsageCount(rows.length)
      })
      .catch((e) => console.error('历史加载失败', e))
  }, [ready]);

  const handleDeleteTemplate = async (id) => {
    try {
      await deleteTemplate(id);
      setSavedTemplates(prev => prev.filter(t => t.id !== id));
      showToast('已删除该专属模板');
    } catch (e) {
      console.error('删除模板失败', e);
      showToast('删除失败，请稍后重试', 'error');
    }
  };

  const handleReuseTemplate = (template) => {
    const fingerprint = `ABBEL_PRESET:${JSON.stringify(template.scores)}`;
    navigator.clipboard.writeText(fingerprint).then(() => {
      showToast(`已复制 [${template.name}] 的调参指纹，请前往工作台粘贴！`);
    }).catch(() => showToast('复制失败', 'error'));
  };

  const handleRegenerate = (gen) => {
    sessionStorage.setItem('userInput', gen.input_text || gen.output_draft || '');
    navigate('/workspace');
  };

  const handleMenuClick = (item) => {
    setActiveMenu(item);
    if (item === '首页') navigate('/');
    if (item === '工作台') navigate('/workspace');
    if (item === '模板库') navigate('/templates');
    if (item === '我的') navigate('/my');
    if (item === '设置') navigate('/settings');
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
        {/* 顶部全局导航栏 */}
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

        {/* 核心内容装载区：恢复内边距与居中限宽 */}
        <div style={{ flex: 1, padding: '24px', boxSizing: 'border-box', display: 'flex', justifyContent: 'center', overflow: 'hidden', width: '100%' }}>
          <div style={{ display: 'flex', gap: '24px', width: '100%', maxWidth: '1440px', height: '100%' }}>
          {/* === 原型代码注入区 === */}
          
          {/* 左侧：用户状态控制台 */}
          <div className="glass-module" style={{ width: '260px', flexShrink: 0, padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px dashed rgba(0,0,0,0.15)' }}>
              <div style={{
                width: '64px', height: '64px', background: 'rgba(26, 29, 26, 0.9)',
                border: '2px solid #222', borderRadius: '8px',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5), 0 2px 0 rgba(255,255,255,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px'
              }}>
                <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px', stroke: '#66FF88', strokeWidth: 1.5, fill: 'none' }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--color-text-title)', letterSpacing: '1px' }}>{user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'OPERATOR'}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{user?.primaryEmailAddress?.emailAddress || ''}</div>
            </div>

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '0.1em', marginBottom: '16px' }}>[QUOTA / 资源配额]</div>
            
            <div style={{
              background: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.5)',
              borderRadius: '8px', padding: '16px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 10px rgba(0,0,0,0.03)',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>当月解压次数</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{usageCount.toLocaleString()} / 5,000</span>
              </div>
              <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.05)', padding: '2px', borderRadius: '2px', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)' }}>
                {Array.from({ length: 10 }).map((_, i) => {
                  const filled = Math.round((usageCount / 5000) * 10);
                  const on = i < filled;
                  return (
                    <div key={i} style={{ height: '6px', flex: 1, background: on ? 'var(--color-accent-primary)' : 'rgba(0,0,0,0.1)', borderRadius: '1px', boxShadow: on ? '0 0 2px var(--color-accent-primary)' : 'none' }}></div>
                  );
                })}
              </div>
            </div>
            
            <div style={{
              background: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.5)',
              borderRadius: '8px', padding: '16px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 10px rgba(0,0,0,0.03)'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>专属记忆槽位</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{savedTemplates.length} / 4</span>
              </div>
              <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.05)', padding: '2px', borderRadius: '2px', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)' }}>
                {Array.from({ length: 4 }).map((_, i) => {
                  const on = i < Math.min(savedTemplates.length, 4);
                  return (
                    <div key={i} style={{ height: '6px', flex: 1, background: on ? 'var(--color-accent-primary)' : 'rgba(0,0,0,0.1)', borderRadius: '1px', boxShadow: on ? '0 0 2px var(--color-accent-primary)' : 'none' }}></div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 右侧：台账数据列表区 */}
          <div className="glass-module" style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            
            {/* 专属模板区块 */}
            <div style={{ marginBottom: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid rgba(0,0,0,0.15)' }}>
                <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--color-text-title)', display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', paddingLeft: '16px' }}>
                  <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', display: 'block', width: '4px', height: '18px', background: 'var(--color-accent-primary)', borderRadius: '2px' }}></span>
                  [MY TEMPLATES / 专属模板]
                </div>
                <button onClick={() => navigate('/')} style={{
                  background: 'var(--color-accent-primary)', color: 'white', border: 'none',
                  padding: '6px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: 700,
                  cursor: 'pointer', boxShadow: '0 2px 6px rgba(209, 62, 20, 0.3)', transition: 'all 0.2s'
                }}>
                  + 新建模板
                </button>
              </div>

              {/* 列表头部 */}
              <div style={{ display: 'grid', gridTemplateColumns: '40px 2.5fr 1fr 1.5fr 2fr', padding: '0 16px 8px 16px', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <div></div>
                <div>模板名称</div>
                <div>创建时间</div>
                <div>10 维指纹</div>
                <div style={{ textAlign: 'right' }}>操作</div>
              </div>

              {/* 动态模板列表行 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {savedTemplates.length === 0 ? (
                  <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>暂无保存的专属模板</div>
                ) : (
                  savedTemplates.map((tpl) => (
                    <div key={tpl.id} style={{
                      display: 'grid', gridTemplateColumns: '40px 2.5fr 1fr 1.5fr 2fr', alignItems: 'center',
                      background: 'var(--glass-module)', border: '1px solid rgba(255,255,255,0.4)',
                      padding: '12px 16px', borderRadius: '8px',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 10px rgba(0,0,0,0.03)',
                      transition: 'all 0.2s'
                    }}>
                      <div style={{ width: '16px', height: '16px', background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.2)', borderRadius: '3px', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)' }}></div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px', stroke: 'var(--color-accent-primary)', fill: 'none', strokeWidth: 2 }}>
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                        {tpl.name}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        {new Date(tpl.created_at).toLocaleDateString()}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '1px', background: 'rgba(0,0,0,0.05)', padding: '2px', borderRadius: '2px' }}>
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} style={{ width: '3px', height: '10px', background: i % 2 === 0 ? 'var(--color-accent-primary)' : 'rgba(0,0,0,0.15)' }}></div>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button onClick={() => handleReuseTemplate(tpl)} style={{ whiteSpace: 'nowrap', background: 'transparent', border: 'none', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg viewBox="0 0 24 24" style={{ width: '14px', height: '14px', stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}><path d="M5 12h14M12 5l7 7-7 7"/></svg> 复用
                        </button>
                        <button onClick={() => showToast('请复制指纹后前往工作台编辑')} style={{ whiteSpace: 'nowrap', background: 'transparent', border: 'none', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg viewBox="0 0 24 24" style={{ width: '14px', height: '14px', stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> 编辑
                        </button>
                        <button onClick={() => handleDeleteTemplate(tpl.id)} style={{ whiteSpace: 'nowrap', background: 'transparent', border: 'none', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg viewBox="0 0 24 24" style={{ width: '14px', height: '14px', stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> 删除
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 生成历史区块 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid rgba(0,0,0,0.15)' }}>
                <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--color-text-title)', display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', paddingLeft: '16px' }}>
                  <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', display: 'block', width: '4px', height: '18px', background: 'var(--color-accent-primary)', borderRadius: '2px' }}></span>
                  [HISTORY LOG / 生成历史]
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>仅保留最近 30 天记录</div>
              </div>

              {/* 列表头部 */}
              <div style={{ display: 'grid', gridTemplateColumns: '40px 2.5fr 1fr 1.5fr 2fr', padding: '0 16px 8px 16px', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <div></div>
                <div>输入指令 / 任务摘要</div>
                <div>生成时间</div>
                <div>应用模板</div>
                <div style={{ textAlign: 'right' }}>操作</div>
              </div>

              {/* 历史记录列表 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {generations.length === 0 ? (
                  <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>暂无生成历史</div>
                ) : (
                  generations.map((gen) => (
                    <div key={gen.id} style={{
                      display: 'grid', gridTemplateColumns: '40px 2.5fr 1fr 1.5fr 2fr', alignItems: 'center',
                      background: 'var(--glass-module)', border: '1px solid rgba(255,255,255,0.4)',
                      padding: '12px 16px', borderRadius: '8px',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 10px rgba(0,0,0,0.03)',
                      transition: 'all 0.2s'
                    }}>
                      <div style={{
                        width: '16px', height: '16px', background: 'rgba(0,0,0,0.05)',
                        border: '1px solid rgba(0,0,0,0.2)', borderRadius: '3px',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)', cursor: 'pointer'
                      }}></div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px', stroke: 'var(--color-text-secondary)', fill: 'none', strokeWidth: 2 }}>
                          <polyline points="4 7 4 4 20 4 20 7"/>
                          <line x1="9" y1="20" x2="15" y2="20"/>
                          <line x1="12" y1="4" x2="12" y2="20"/>
                        </svg>
                        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px', fontWeight: 400 }}>{gen.input_text || gen.output_draft || ''}</span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>{new Date(gen.created_at).toLocaleString('zh-CN')}</div>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{gen.template_id ? '[ 专属模板 ]' : '[ 无 / 自定义微调 ]'}</div>
                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setViewGen(gen)} style={{
                          whiteSpace: 'nowrap',
                          background: 'transparent', border: 'none', fontSize: '13px', fontWeight: 600,
                          color: 'var(--color-text-secondary)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s'
                        }}>
                          <svg viewBox="0 0 24 24" style={{ width: '14px', height: '14px', stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                          查看
                        </button>
                        <button onClick={() => handleRegenerate(gen)} style={{
                          whiteSpace: 'nowrap',
                          background: 'transparent', border: 'none', fontSize: '13px', fontWeight: 600,
                          color: 'var(--color-text-secondary)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s'
                        }}>
                          <svg viewBox="0 0 24 24" style={{ width: '14px', height: '14px', stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}>
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                          </svg>
                          再来一次
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
          {/* === 原型代码注入区 === */}
        </div>

      </div>

      {viewGen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setViewGen(null)}>
          <div className="glass-module" style={{ width: '720px', maxWidth: '90vw', maxHeight: '80vh', padding: '24px', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--color-text-title)' }}>生成详情</div>
              <button onClick={() => setViewGen(null)} style={{ background: 'transparent', border: 'none', fontSize: '24px', lineHeight: 1, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>×</button>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>{new Date(viewGen.created_at).toLocaleString('zh-CN')}</div>

            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>输入指令</div>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '13px', color: 'var(--color-text-secondary)', background: 'rgba(0,0,0,0.08)', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>{viewGen.input_text || '（无）'}</div>

            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>输出文案</div>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '14px', color: 'var(--color-text-primary)', background: 'rgba(0,0,0,0.08)', padding: '16px', borderRadius: '6px', lineHeight: '1.7' }}>{viewGen.output_draft || '（无）'}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
