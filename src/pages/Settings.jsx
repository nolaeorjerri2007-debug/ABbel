import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Settings.css';

function Settings() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState('设置');
  const [activeSection, setActiveSection] = useState('section-account');
  const [toastMsg, setToastMsg] = useState(null);
  const [toastType, setToastType] = useState('success');
  const [usageCount, setUsageCount] = useState(127);

  const mainContentRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToastMsg(msg); setToastType(type);
    setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    const localCount = localStorage.getItem('abbel_usage_count');
    if (localCount) setUsageCount(parseInt(localCount, 10));
  }, []);

  const handleMenuClick = (item) => {
    setActiveMenu(item);
    if (item === '首页') navigate('/');
    if (item === '工作台') navigate('/workspace');
    if (item === '模板库') navigate('/templates');
    if (item === '我的') navigate('/my');
    if (item === '设置') navigate('/settings');
  };

  const handleSectionClick = (sectionId) => {
    setActiveSection(sectionId);
    if (mainContentRef.current) {
      const target = mainContentRef.current.querySelector(`#${sectionId}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleScroll = () => {
    if (!mainContentRef.current) return;
    const container = mainContentRef.current;
    const sections = container.querySelectorAll('.section-block');
    let currentId = '';
    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      if (container.scrollTop >= sectionTop - 100) {
        currentId = section.getAttribute('id');
      }
    });
    if (container.scrollHeight - container.scrollTop <= container.clientHeight + 10) {
      currentId = 'section-security';
    }
    if (currentId) setActiveSection(currentId);
  };

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText('sk-babel-***********************H8x2').then(() => {
      showToast('终端密钥已复制到剪贴板！');
    }).catch(() => showToast('复制失败', 'error'));
  };

  const handleSaveConfig = () => {
    showToast('配置已写入系统寄存器！');
  };

  const handleResetConfig = () => {
    showToast('已恢复至上一次保存的配置状态。');
  };

  const handleUpdatePassword = () => {
    showToast('[SYS_ERR] 安全校验失败：请填写完整的密码字段。', 'error');
  };

  const handleLogout = () => {
    if (window.confirm('[SYS_WARN] 确认断开当前终端的安全连接？')) {
      showToast('连接已断开，即将返回验证网关...');
    }
  };

  const handleDeleteAccount = () => {
    if (window.confirm('[CRITICAL_WARN] 极度危险操作！\n\n您正在尝试抹除操作员 [OPERATOR_01] 的所有数据及专属记忆槽位。此操作不可逆！\n\n是否强制执行？')) {
      showToast('[SYS_LOG] 账户擦除序列已启动...', 'error');
    }
  };

  const menuItems = [
    { id: 'section-account', label: '账户信息', icon: <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px', stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
    { id: 'section-api', label: 'API 配额', icon: <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px', stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> },
    { id: 'section-prefs', label: '系统偏好', icon: <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px', stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
    { id: 'section-security', label: '安全设置', icon: <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px', stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
  ];

  const [toggles, setToggles] = useState(() => {
    const saved = localStorage.getItem('abbel_settings');
    return saved ? JSON.parse(saved) : {
      autoEngine: false,
      expandAdvanced: false,
      shortcut: true,
      email: false,
      quota: true,
    };
  });

  const handleToggle = (key) => {
    setToggles(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('abbel_settings', JSON.stringify(next));
      return next;
    });
  };

  const quotaCells = 20;
  const quotaFilled = Math.min(Math.round((usageCount / 5000) * quotaCells), quotaCells);

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

      <div style={{ flex: 1, padding: '24px', boxSizing: 'border-box', display: 'flex', justifyContent: 'center', overflow: 'hidden', width: '100%' }}>
        <div style={{ display: 'flex', gap: '24px', width: '100%', maxWidth: '1440px', height: '100%' }}>
          
          {/* 左侧：设置分类菜单 */}
          <div className="glass-module sidebar" style={{ width: '240px', flexShrink: 0, padding: '24px 0', borderRight: '1px solid var(--color-border-dark)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div className="sidebar-header" style={{ padding: '0 24px 16px 24px', borderBottom: '1px solid var(--color-border-dark)', marginBottom: '16px' }}>
              <div className="nameplate">[SETTINGS_CONFIG]</div>
            </div>

            {menuItems.map((item) => (
              <div
                key={item.id}
                className={`menu-item ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => handleSectionClick(item.id)}
              >
                {item.icon}
                {item.label}
              </div>
            ))}

            <div
              className="menu-item logout-btn"
              onClick={handleLogout}
            >
              <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px', stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              退出终端
            </div>
          </div>

          {/* 右侧：设置表单与详情区 */}
          <div
            ref={mainContentRef}
            className="glass-module main-content"
            style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', scrollbarWidth: 'none', position: 'relative' }}
            onScroll={handleScroll}
          >
            {/* 账户信息 */}
            <div id="section-account" className="section-block" style={{ maxWidth: '800px', marginBottom: '56px' }}>
              <h2 className="section-title" style={{ fontSize: '18px', fontWeight: 900, color: 'var(--color-text-title)', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '12px', borderBottom: '2px solid var(--color-border-dark)' }}>账户信息</h2>

              <div className="avatar-upload-group" style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
                <div className="avatar-lcd" style={{ width: '80px', height: '80px', background: 'var(--lcd-bg)', border: '2px solid #222', borderRadius: '8px', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5), 0 2px 0 rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" style={{ width: '40px', height: '40px', stroke: 'var(--lcd-text-bright)', strokeWidth: 1.5, fill: 'none' }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div className="avatar-info">
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'var(--color-text-primary)' }}>OPERATOR_01</h3>
                  <p style={{ margin: '0 0 12px 0', fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>ID: 88A4-9B2C-773X</p>
                  <button className="btn-tool" onClick={() => showToast('[SYS_CMD] 唤醒本地文件接口...')}>
                    <svg viewBox="0 0 24 24" style={{ width: '14px', height: '14px', stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    更新操作员图像
                  </button>
                </div>
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>操作员代号 (Username)</label>
                  <input type="text" className="form-input" defaultValue="OPERATOR_01" />
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>通讯节点 (Email)</label>
                  <input type="email" className="form-input" defaultValue="operator.01@babel.sys" disabled />
                </div>
              </div>
            </div>

            {/* API 与资源配额 */}
            <div id="section-api" className="section-block" style={{ maxWidth: '800px', marginBottom: '56px' }}>
              <h2 className="section-title" style={{ fontSize: '18px', fontWeight: 900, color: 'var(--color-text-title)', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '12px', borderBottom: '2px solid var(--color-border-dark)' }}>API 与资源配额</h2>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>主干网络接入密钥 (Secret API Key)</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input type="text" className="form-input lcd-field" style={{ flex: 1, background: 'var(--lcd-bg)', border: '2px solid #222', color: 'var(--lcd-text-amber)', fontFamily: 'var(--font-mono)', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6)', letterSpacing: '1px' }} defaultValue="sk-babel-***********************H8x2" readOnly />
                  <button className="btn-tool" onClick={handleCopyApiKey}>
                    <svg viewBox="0 0 24 24" style={{ width: '14px', height: '14px', stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    复制
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>请妥善保管您的终端密钥，不要在公共网络泄露。</p>
              </div>

              <div className="quota-display" style={{ background: 'var(--glass-module)', border: '1px solid var(--color-border-light)', padding: '24px', borderRadius: '8px', boxShadow: 'var(--shadow-emboss)', marginTop: '16px' }}>
                <div className="quota-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="quota-title" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>当月解压阵列使用量 (Requests)</span>
                  <span className="quota-val" style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 900, color: 'var(--color-text-primary)' }}>{usageCount.toLocaleString()} / 5,000</span>
                </div>
                <div className="progress-bar-large" style={{ display: 'flex', gap: '3px', background: 'rgba(0,0,0,0.06)', padding: '3px', borderRadius: '4px', boxShadow: 'var(--shadow-recess)' }}>
                  {Array.from({ length: quotaCells }).map((_, i) => (
                    <div
                      key={i}
                      className={`progress-cell-lg ${i < quotaFilled ? (i >= quotaCells - 2 ? 'warn' : 'on') : ''}`}
                      style={{ height: '10px', flex: 1, background: i < quotaFilled ? (i >= quotaCells - 2 ? 'var(--lcd-text-amber)' : 'var(--color-accent-primary)') : 'rgba(0,0,0,0.08)', borderRadius: '2px', boxShadow: i < quotaFilled ? `0 0 4px ${i >= quotaCells - 2 ? 'var(--lcd-text-amber)' : 'var(--color-accent-primary)'}` : 'none' }}
                    />
                  ))}
                </div>
                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>当前层级：工业版 (Industrial Tier)</span>
                  <button className="btn-tool" style={{ color: 'var(--color-accent-primary)', borderColor: 'rgba(209, 62, 20, 0.3)' }} onClick={() => showToast('[QUOTA_SYS] 正在连接计费终端，获取最新升级方案...')}>升级配额限制</button>
                </div>
              </div>
            </div>

            {/* 系统偏好 */}
            <div id="section-prefs" className="section-block" style={{ maxWidth: '800px', marginBottom: '56px' }}>
              <h2 className="section-title" style={{ fontSize: '18px', fontWeight: 900, color: 'var(--color-text-title)', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '12px', borderBottom: '2px solid var(--color-border-dark)' }}>系统偏好</h2>

              <h3 className="sub-section-title" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-title)', margin: '24px 0 16px 0' }}>基础设置</h3>
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>默认输出格式</label>
                  <select className="form-input" defaultValue="md">
                    <option value="md">Markdown (富文本)</option>
                    <option value="txt">Plain Text (纯文本)</option>
                  </select>
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>界面语言</label>
                  <select className="form-input" defaultValue="zh">
                    <option value="zh">简体中文 (系统默认)</option>
                    <option value="en">English (US)</option>
                  </select>
                </div>
              </div>

              <h3 className="sub-section-title" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-title)', margin: '24px 0 16px 0' }}>界面偏好</h3>
              <div className="pref-group-box" style={{ background: 'rgba(255,255,255,0.3)', borderRadius: '8px', padding: '0 20px', marginBottom: '24px', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-emboss)' }}>
                {[
                  { key: 'autoEngine', title: '默认开启 AUTO 引擎', desc: '进入工作台时，自动开启滑块防抖重构功能' },
                  { key: 'expandAdvanced', title: '默认展开高阶微调', desc: '在调音台默认展示黑话浓度、含蓄度等高级参数' },
                  { key: 'shortcut', title: '启用键盘快捷键', desc: '在追加上下文时支持按 Enter 键快速发送指令' },
                ].map((item, idx) => (
                  <div key={item.key} className="pref-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: idx < 2 ? '1px dashed var(--color-border-dark)' : 'none' }}>
                    <div className="pref-info">
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{item.title}</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>{item.desc}</p>
                    </div>
                    <div
                      style={{
                        width: '52px', height: '28px',
                        background: toggles[item.key] ? 'rgba(209, 62, 20, 0.15)' : 'rgba(0,0,0,0.1)',
                        borderRadius: '14px',
                        border: `1px solid ${toggles[item.key] ? 'rgba(209, 62, 20, 0.3)' : 'rgba(0,0,0,0.15)'}`,
                        boxShadow: `inset 0 2px 5px ${toggles[item.key] ? 'rgba(209, 62, 20, 0.2)' : 'rgba(0,0,0,0.2)'}`,
                        cursor: 'pointer', position: 'relative', transition: 'all 0.3s',
                      }}
                      onClick={() => handleToggle(item.key)}
                    >
                      <div
                        style={{
                          width: '22px', height: '22px',
                          background: 'linear-gradient(180deg, #FFFFFF 0%, #DCD8CE 100%)',
                          borderRadius: '50%',
                          position: 'absolute',
                          left: toggles[item.key] ? '26px' : '2px',
                          top: '2px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8)',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          display: 'flex', justifyContent: 'center', alignItems: 'center',
                        }}
                      >
                        <div style={{ width: '2px', height: '10px', background: 'rgba(0,0,0,0.1)', boxShadow: '4px 0 0 rgba(0,0,0,0.1), -4px 0 0 rgba(0,0,0,0.1)' }}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <h3 className="sub-section-title" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-title)', margin: '24px 0 16px 0' }}>通知偏好</h3>
              <div className="pref-group-box" style={{ background: 'rgba(255,255,255,0.3)', borderRadius: '8px', padding: '0 20px', marginBottom: '24px', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-emboss)' }}>
                {[
                  { key: 'email', title: '邮件通知', desc: '接收产品更新和重要通知' },
                  { key: 'quota', title: '配额预警', desc: 'API 配额低于 20% 时发送提醒' },
                ].map((item, idx) => (
                  <div key={item.key} className="pref-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: idx < 1 ? '1px dashed var(--color-border-dark)' : 'none' }}>
                    <div className="pref-info">
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{item.title}</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>{item.desc}</p>
                    </div>
                    <div
                      style={{
                        width: '52px', height: '28px',
                        background: toggles[item.key] ? 'rgba(209, 62, 20, 0.15)' : 'rgba(0,0,0,0.1)',
                        borderRadius: '14px',
                        border: `1px solid ${toggles[item.key] ? 'rgba(209, 62, 20, 0.3)' : 'rgba(0,0,0,0.15)'}`,
                        boxShadow: `inset 0 2px 5px ${toggles[item.key] ? 'rgba(209, 62, 20, 0.2)' : 'rgba(0,0,0,0.2)'}`,
                        cursor: 'pointer', position: 'relative', transition: 'all 0.3s',
                      }}
                      onClick={() => handleToggle(item.key)}
                    >
                      <div
                        style={{
                          width: '22px', height: '22px',
                          background: 'linear-gradient(180deg, #FFFFFF 0%, #DCD8CE 100%)',
                          borderRadius: '50%',
                          position: 'absolute',
                          left: toggles[item.key] ? '26px' : '2px',
                          top: '2px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8)',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          display: 'flex', justifyContent: 'center', alignItems: 'center',
                        }}
                      >
                        <div style={{ width: '2px', height: '10px', background: 'rgba(0,0,0,0.1)', boxShadow: '4px 0 0 rgba(0,0,0,0.1), -4px 0 0 rgba(0,0,0,0.1)' }}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 安全设置 */}
            <div id="section-security" className="section-block" style={{ maxWidth: '800px', marginBottom: '56px' }}>
              <h2 className="section-title" style={{ fontSize: '18px', fontWeight: 900, color: 'var(--color-text-title)', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '12px', borderBottom: '2px solid var(--color-border-dark)' }}>安全设置</h2>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>保护你的账户安全</p>

              <h3 className="sub-section-title" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-title)', margin: '24px 0 16px 0' }}>修改密码</h3>
              <div className="pref-group-box" style={{ background: 'rgba(255,255,255,0.3)', borderRadius: '8px', padding: '24px', marginBottom: '24px', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-emboss)' }}>
                {[
                  { label: '当前密码', placeholder: '请输入当前密码', type: 'password' },
                  { label: '新密码', placeholder: '至少 8 位，包含字母和数字', type: 'password' },
                  { label: '确认新密码', placeholder: '再次输入新密码', type: 'password' },
                ].map((field) => (
                  <div key={field.label} className="form-row-single" style={{ marginBottom: '24px' }}>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{field.label}</label>
                      <input type={field.type} className="form-input" placeholder={field.placeholder} />
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button className="btn-primary" onClick={handleUpdatePassword}>更新密码</button>
                  <button className="btn-tool" onClick={() => showToast('已取消密码修改')}>取消</button>
                </div>
              </div>

              <h3 className="sub-section-title" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-title)', margin: '24px 0 16px 0' }}>账户操作</h3>
              <div className="pref-group-box" style={{ background: 'rgba(255,255,255,0.3)', borderRadius: '8px', padding: '24px', marginBottom: '24px', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-emboss)' }}>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 24px 0' }}>谨慎操作，此操作不可逆</p>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <button className="btn-tool" onClick={handleLogout}>退出登录</button>
                  <button className="btn-danger" onClick={handleDeleteAccount}>删除账户</button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginTop: '64px', paddingTop: '24px', borderTop: '1px solid var(--color-border-dark)' }}>
              <button className="btn-primary" onClick={handleSaveConfig}>保存系统配置</button>
              <button className="btn-tool" onClick={handleResetConfig}>撤销更改</button>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}

export default Settings;
