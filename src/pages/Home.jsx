import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/logo2.0.png'
// 👉 新增：引入 Clerk 的 UserButton 组件
import { UserButton } from '@clerk/clerk-react'
import { useAuthedSupabase } from '../lib/supabase'
import { listTemplates, countGenerations } from '../lib/data'
import { useQuota } from '../lib/quota-context'

const SUGGESTION_CHIPS = [
  '💄 变身小红书爆文',
  '💼 职场高情商回复',
  '🔪 提炼核心干货',
  '🔥 增强情绪感染力'
]

// 纵深防御：后端 zod 已对 input_text 设 max(2600)。
// 首页前端预算 = 原始文案 800 + 诉求 200 = 1000（+ 包装词 ≈16 仍在 2600 之内）。
const MAX_ORIGINAL = 800
const MAX_REQUIREMENT = 200

function Home() {
  const navigate = useNavigate()
  const { ready } = useAuthedSupabase()
  const { slotLimit } = useQuota()
  const [originalText, setOriginalText] = useState('')
  const [requirement, setRequirement] = useState('')
  const [activeMenu, setActiveMenu] = useState('首页')
  const [hasError, setHasError] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isReqPanelOpen, setIsReqPanelOpen] = useState(false)
  const intentInputRef = useRef(null)
  const errorTimerRef = useRef(null)
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [usageCount, setUsageCount] = useState(0);
  const [toastMsg, setToastMsg] = useState(null);
  const [toastType, setToastType] = useState('success');

  useEffect(() => {
    if (!ready) return
    listTemplates()
      .then(setSavedTemplates)
      .catch((e) => {
        console.error('模板加载失败', e)
        showToast('云端连接超时，请稍后重试', 'error')
      })
    countGenerations()
      .then(setUsageCount)
      .catch((e) => {
        console.error('生成历史加载失败', e)
        showToast('云端连接超时，请稍后重试', 'error')
      })
  }, [ready])
  useEffect(() => {
    // ================= ⚠️ 新增：双轨智能接站逻辑 =================
    const pendingInstruction = sessionStorage.getItem('pending_instruction');
    if (pendingInstruction) {
      setRequirement(pendingInstruction);
      setIsReqPanelOpen(true); // 自动拉下毛玻璃抽屉
      sessionStorage.removeItem('pending_instruction'); // 用完即焚

      // 利用宏任务等待 DOM 渲染后，自动聚焦并精准选中坑位
      setTimeout(() => {
        if (intentInputRef.current) {
          intentInputRef.current.focus();
          const placeholder = '[在此填入产品名称或主题]';
          const startIndex = pendingInstruction.indexOf(placeholder);
          if (startIndex !== -1) {
            intentInputRef.current.setSelectionRange(startIndex, startIndex + placeholder.length);
          }
        }
      }, 100);
    }
    // ==============================================================

    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current)
      }
    }
  }, [])

  const handleOriginalTextChange = (e) => {
    setOriginalText(e.target.value)
    if (hasError) {
      setHasError(false)
      setErrorMsg('')
    }
  }

  const handleRequirementChange = (e) => {
    setRequirement(e.target.value)
    if (hasError) {
      setHasError(false)
      setErrorMsg('')
    }
  }

  const showError = (msg) => {
    setHasError(true)
    setErrorMsg(msg)
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
    }
    errorTimerRef.current = setTimeout(() => {
      setHasError(false)
      setErrorMsg('')
    }, 3000)
  }

  const showToast = (msg, type = 'error') => {
    setToastMsg(msg); setToastType(type);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleGenerate = () => {
    if (!originalText.trim()) {
      showError('SYS_ERR: 缺少原始文案！')
      return
    }
    if (!requirement.trim()) {
      showError('SYS_ERR: 缺少修改诉求，请手动输入或点击下方标签！')
      return
    }

    const combinedQuery = `【原始文案】\n${originalText.trim()}\n\n【修改诉求】\n${requirement.trim()}`
    sessionStorage.setItem('userInput', combinedQuery)
    navigate('/workspace')
  }

  const handleMenuClick = (item) => {
    setActiveMenu(item)
    if (item === '工作台') navigate('/workspace')
    else if (item === '模板库') navigate('/templates')
    else if (item === '我的') navigate('/my')
    else if (item === '设置') navigate('/settings')
  }

  const handlePresetClick = (title) => {
    // 1. 空状态绝对防御：必须有原始文案才能发车
    if (!originalText.trim()) {
      showError('SYS_ERR: 请先在上方粘贴需要优化的原始文案！');
      return;
    }

    // 2. 映射高质量风格指令 (取代前端硬传参)
    const presets = {
      '种草体': '请将以上文案重写为小红书种草风格。要求：语气亲密熟络、情绪浓度极高、多用Emoji符号，极具催促促动感。',
      '深度文': '请将以上文案重写为深度解析长文。要求：干货密度极高、逻辑严密、专业客观，采用偏向参数硬核的垂类黑话。',
      '视频稿': '请将以上文案重写为短视频口播脚本。要求：开门见山直入主题、情绪起伏强烈、节奏紧凑具有表现力。'
    };

    const instruction = presets[title] || `请应用预设风格：${title} 进行重构。`;
    const combinedQuery = `【原始文案】\n${originalText.trim()}\n\n【风格重构指令】\n${instruction}`;

    // 3. 瞬间存入 session 并飞往工作台
    sessionStorage.setItem('userInput', combinedQuery);
    navigate('/workspace');
  };

  const handleSlotClick = (template) => {
    if (!originalText.trim()) {
      showError('SYS_ERR: 请先粘贴原始文案，再应用专属记忆模板！');
      return;
    }

    // 核心：将本地模板的 10 维参数解包为大模型可读的系统指令
    const paramStr = Object.entries(template.scores || {})
      .map(([key, val]) => `${key}: ${val}`)
      .join(', ');

    const combinedQuery = `【原始文案】\n${originalText.trim()}\n\n【系统指令】\n请严格按照以下我设定的专属调音台参数，对文案进行深度重构（要求严格体现参数倾向）：\n${paramStr}`;

    sessionStorage.setItem('userInput', combinedQuery);
    navigate('/workspace');
  };

  const handleChipClick = (chipText) => {
    setRequirement(chipText)
    if (intentInputRef.current) {
      intentInputRef.current.focus()
    }
  }

  const getStatusText = () => {
    if (hasError) {
      return errorMsg
    }
    const totalLength = originalText.length + requirement.length
    if (totalLength > 0) {
      return `TYPING_ ${String(totalLength).padStart(4, '0')} / ${MAX_ORIGINAL + MAX_REQUIREMENT}`
    }
    return `READY_ 0000 / ${MAX_ORIGINAL + MAX_REQUIREMENT}`
  }

  const getStatusColor = () => {
    if (hasError) return '#FF6B3D'
    return '#66FF88'
  }

  // 逐字段计数：接近上限时变色提醒（≥90% 橙红，其余淡白）
  const counterColor = (current, max) => {
    const ratio = max > 0 ? current / max : 0
    if (ratio >= 0.9) return '#FF6B3D'
    return 'rgba(255,255,255,0.4)'
  }

  return (
    <div className="main-panel">
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
      <div className="screw"></div><div className="screw"></div>
      <div className="screw"></div><div className="screw"></div>

      {/* 替换首页顶部的标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span className="nameplate" style={{ width: 'auto' }}>[ ABBEL -01 / 筑达每次沟通 ]</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className="nameplate" style={{ width: 'auto' }}>V4.0 // TRANSLUCENT_PRECISION</span>
          {/* 👉 新增：Clerk 魔法头像组件 */}
          <UserButton
            afterSignOutUrl="/login"
            appearance={{
              elements: {
                avatarBox: "w-8 h-8 border-2 border-[rgba(255,255,255,0.5)] shadow-lg" // 让头像带点玻璃质感的边框
              }
            }}
          />
        </div>
      </div>

      <div className="bento-grid">
        <div className="module-nav">
          <span className="nameplate">[MENU / 菜单]</span>
          {['首页', '工作台', '模板库', '我的', '设置'].map((item) => (
            <button
              key={item}
              className={`btn-nav ${activeMenu === item ? 'active' : ''}`}
              onClick={() => handleMenuClick(item)}
            >
              <div className={`led ${activeMenu === item ? 'on red' : 'off'}`}></div>
              {item}
            </button>
          ))}
        </div>

        <div className="module-center">
          <div className="slogan-area">
            <img src={logo} alt="Logo" style={{ height: '48px', objectFit: 'contain', display: 'block', margin: '0 auto 12px' }} />
            <div className="slogan-sub">输入模糊指令，让多维参数重构语义</div>
          </div>

          <div className={`lcd-monitor interactive-monitor ${hasError ? 'lcd-error' : ''}`}>
            {/* 1. 底层：原始文案区 */}
            <textarea
              className="lcd-textarea"
              placeholder="在此粘贴你需要优化的原始文案..."
              value={originalText}
              onChange={handleOriginalTextChange}
              maxLength={MAX_ORIGINAL}
              style={{ minHeight: '240px', paddingBottom: '40px' }}
            />
            <div style={{
              position: 'absolute', top: '10px', right: '18px',
              fontSize: '11px', fontFamily: 'monospace', letterSpacing: '0.5px',
              color: counterColor(originalText.length, MAX_ORIGINAL), transition: 'color 0.2s'
            }}>
              原始文案 {String(originalText.length).padStart(3, '0')} / {MAX_ORIGINAL}
            </div>

            {/* 底层滑块：未输入时半透明，输入后高亮并可点击上滑 */}
            <div
              className={`drawer-handle up-handle ${originalText.trim().length > 0 ? 'active' : ''}`}
              onClick={() => originalText.trim().length > 0 && setIsReqPanelOpen(true)}
            >
              <div className="handle-bar"></div>
              <span>向上滑动以输入修改诉求</span>
            </div>

            {/* 2. 顶层：毛玻璃抽屉（修改诉求区） */}
            <div className={`frosted-drawer ${isReqPanelOpen ? 'open' : ''}`}>
              {/* 抽屉顶部滑块：点击下滑隐藏抽屉 */}
              <div className="drawer-handle down-handle" onClick={() => setIsReqPanelOpen(false)}>
                <div className="handle-bar"></div>
                <span>下滑参考原始文本</span>
              </div>

              <textarea
                ref={intentInputRef}
                className="lcd-textarea drawer-textarea"
                placeholder="输入修改诉求，例如：改写得更专业、增加悬念..."
                value={requirement}
                onChange={handleRequirementChange}
                maxLength={MAX_REQUIREMENT}
              />
              <div style={{
                textAlign: 'right', fontSize: '11px', fontFamily: 'monospace',
                letterSpacing: '0.5px', marginTop: '6px',
                color: counterColor(requirement.length, MAX_REQUIREMENT), transition: 'color 0.2s'
              }}>
                修改诉求 {String(requirement.length).padStart(3, '0')} / {MAX_REQUIREMENT}
              </div>

              {/* 灵感药丸紧贴输入区 */}
              <div className="chip-tag-container" style={{ marginTop: '0', marginBottom: '16px' }}>
                {SUGGESTION_CHIPS.map((chip) => (
                  <div key={chip} className="chip-tag drawer-chip" onClick={() => handleChipClick(chip)}>
                    {chip}
                  </div>
                ))}
              </div>

              <div style={{
                textAlign: 'right', color: getStatusColor(),
                opacity: hasError || (originalText.length + requirement.length) > 0 ? 1 : 0.5,
                fontFamily: 'monospace', fontSize: '11px', transition: 'all 0.3s'
              }}>
                {getStatusText()}
              </div>
            </div>
          </div>

          <div className="exec-btn-container">
            <button
              className={`btn-exec ${!requirement.trim() ? 'disabled' : ''}`}
              onClick={handleGenerate}
            >
              解压生成 →
            </button>
          </div>
        </div>

        <div className="module-status">
          <span className="nameplate">[STATUS / 监控]</span>
          <div className="status-box">
            <div style={{ fontSize: '10px', color: '#706D66', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '4px' }}>LOCAL_PROCESSED</div>
            <div className="status-value">
              {String(Math.floor(usageCount / 1000)).padStart(2, '0')},{String(usageCount % 1000).padStart(3, '0')}
            </div>
          </div>
          <div className="status-box">
            <div style={{ fontSize: '10px', color: '#706D66', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '4px' }}>MEM_SLOTS</div>
            <div className="status-value" style={{ color: '#2C2A28', fontSize: '22px' }}>
              {String(savedTemplates.length).padStart(2, '0')} / {String(slotLimit).padStart(2, '0')}
            </div>
          </div>
        </div>

        <div className="bottom-section">
          <div>
            <span className="nameplate">[PRESETS / 快速载入]</span>
            <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
              {[
                { title: '种草体', icon: <path d="M12 2v20M2 12h20"/> },
                { title: '深度文', icon: <path d="M4 6h16M4 12h16M4 18h10"/> },
                { title: '视频稿', icon: <path d="M21 12l-18 12v-24z"/> }
              ].map((preset) => (
                <div
                  key={preset.title}
                  className="dial-card"
                  onClick={() => handlePresetClick(preset.title)}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" pointerEvents="none">
                    {preset.icon}
                  </svg>
                  <span className="dial-title">{preset.title}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="nameplate">[SLOTS / 记忆]</span>
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {savedTemplates.length === 0 ? (
                <div className="slot-item" style={{ opacity: 0.5, cursor: 'default', borderStyle: 'dashed' }}>
                  暂无记忆，请前往工作台保存
                </div>
              ) : (
                savedTemplates.slice(-2).reverse().map(tpl => (
                  <div
                    key={tpl.id}
                    className="slot-item"
                    onClick={() => handleSlotClick(tpl)}
                  >
                    {tpl.name}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
