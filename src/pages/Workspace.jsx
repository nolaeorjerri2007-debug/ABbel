import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

// 原生防抖辅助函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const SLIDER_CONFIG = [
  {
    group: '人际',
    groupSub: '我跟你是什么关系',
    items: [
      { key: 'intimacy', title: '亲近感', leftLabel: '陌生官方', rightLabel: '亲密熟络', defaultValue: 0.85, desc: '控制社交距离感。越低越像官方通告，越高越像朋友间的私密对话。' }
    ]
  },
  {
    group: '认知',
    groupSub: '你读起来费不费脑',
    items: [
      { key: 'info_density', title: '干货密度', leftLabel: '抒情留白', rightLabel: '参数硬核', defaultValue: 0.60, desc: '控制专业名词与数据的占比。越低越易读，越高越硬核。' }
    ]
  },
  {
    group: '情动',
    groupSub: '我想让你感受什么',
    items: [
      { key: 'arousal', title: '情绪浓度', leftLabel: '冷静克制', rightLabel: '狂热宣泄', defaultValue: 0.75, desc: '控制情绪的起伏度。越低越客观，越高越容易引起受众共鸣。' },
      { key: 'urgency', title: '催促力度', leftLabel: '纯陈述', rightLabel: '强促动', defaultValue: 0.40, desc: '控制行动促发力。越低越偏向展示，越高越具有压迫感和催促感。' }
    ]
  }
]

const ADVANCED_SLIDERS = [
  { key: 'jargon_density', title: '黑话浓度', leftLabel: '大白话', rightLabel: '垂类黑话', defaultValue: 0.62, desc: '控制行业术语的浓度。越低越通俗易懂，越高越显得专业垂直。' },
  { key: 'directness', title: '含蓄度', leftLabel: '开门见山', rightLabel: '懂的都懂', defaultValue: 0.35, desc: '控制表达的直白程度。越低越开门见山，越高越懂得留白和隐喻。' }
]

function Workspace() {
  const navigate = useNavigate()

  const [draft, setDraft] = useState('')
  const [scores, setScores] = useState({})
  const [loading, setLoading] = useState(false)
  const [sysError, setSysError] = useState(null)
  const [diagnosis, setDiagnosis] = useState('')
  const [isEntering, setIsEntering] = useState(true)
  const [activeNav, setActiveNav] = useState('工作台')
  const [autoApply, setAutoApply] = useState(() => {
    const settings = JSON.parse(localStorage.getItem('abbel_settings') || '{}');
    return settings.autoEngine || false;
  })
  const [skeletonDots, setSkeletonDots] = useState([0, 1, 2])
  const [glowPosition, setGlowPosition] = useState(0)
  const [terminalTextIndex, setTerminalTextIndex] = useState(0)
  const [terminalOpacity, setTerminalOpacity] = useState(1)
  const [diffDraft, setDiffDraft] = useState(null)
  const [isDiffLoading, setIsDiffLoading] = useState(false)
  const [showAppendInput, setShowAppendInput] = useState(false);
  const [appendQuery, setAppendQuery] = useState('');
  const [history, setHistory] = useState([]);

  // ⚠️ 新增悬浮菜单相关状态
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [showSlotMenu, setShowSlotMenu] = useState(false);
  const slotMenuRef = useRef(null);

  useEffect(() => {
    // 读取本地记忆槽
    const localData = localStorage.getItem('abbel_templates');
    if (localData) {
      try { setSavedTemplates(JSON.parse(localData)); } catch(e){}
    }
    // 点击外部关闭悬浮菜单
    const handleClickOutside = (e) => {
      if (slotMenuRef.current && !slotMenuRef.current.contains(e.target)) {
        setShowSlotMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleApplySlot = (template) => {
    setScores(prev => {
       const updated = { ...prev, ...template.scores };
       if (autoApply) autoDebounceRef.current(updated, baseScoresRef.current);
       return updated;
    });
    setShowSlotMenu(false);
    showToast(`已应用记忆槽：${template.name}`, 'success');
  };

  // ================= 工业级防线：Toast 状态 =================
  const [toastMsg, setToastMsg] = useState(null);
  const [toastType, setToastType] = useState('error'); // 'error' | 'success'

  // 全局轻提示触发器 (3秒后自动消失)
  const showToast = (msg, type = 'error') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMsg(null);
    }, 3000);
  };
  // =========================================================

  // 用于 AUTO 引擎对比的基准分数和文案缓存
  const baseScoresRef = useRef({});
  const currentDraftRef = useRef('');
  const diffAbortControllerRef = useRef(null); // 追踪微调引擎的最新请求

  const [hoveredDesc, setHoveredDesc] = useState('');

  // 抽离的独立发包引擎：AUTO 和 Manual 共用
  const triggerDiffEngine = async (changedParams, changedCount) => {
    if (changedCount === 0) return null;
    // 前端最后一道物理防线：如果底稿为空，说明前置流程异常，直接拒绝发包
    if (!currentDraftRef.current || currentDraftRef.current.trim() === '') {
      console.warn('>>> [AUTO 引擎拦截] 当前无有效底稿，拒绝重写请求');
      return null;
    }

    if (diffAbortControllerRef.current) {
      diffAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    diffAbortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    setIsDiffLoading(true);
    setSysError(null);

    try {
      const response = await fetch('/dify-api/v1/workflows/run', {
        method: 'POST',
        signal: controller.signal,
        headers: { 
          'Authorization': 'Bearer app-u8Pp7SixS7L5JraFPEhBYrfK',
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          inputs: {
            original_text: currentDraftRef.current,
            target_params: JSON.stringify(changedParams),
            changed_count: changedCount,
            baseline_scores: JSON.stringify(baseScoresRef.current),
            is_valid_input: "true",
            priority_order: "[]"
          },
          response_mode: 'blocking',
          user: 'web-user'
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      // 兼容后端可能变更的字段名 (text 或 diff_text)
      const rawText = data?.data?.outputs?.diff_text || data?.data?.outputs?.text || data?.answer || '';

      if (!rawText) {
        throw new Error('未提取到有效的重写文本');
      }

      // 第一道防线：粗粒度清洗思考过程和代码块标记
      let cleanedText = rawText
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```json/gi, '')
        .replace(/```html/gi, '')
        .replace(/```/gi, '')
        .trim();

      let finalDiffText = cleanedText;

      // 第二道防线：尝试深度解析 JSON 对象
      try {
        const parsed = JSON.parse(cleanedText);

        if (parsed.draft && typeof parsed.draft === 'string' && parsed.draft.trim().length > 0) {
          finalDiffText = parsed.draft;
        } else if (parsed.text && typeof parsed.text === 'string') {
          finalDiffText = parsed.text;
        } else if (parsed.content && typeof parsed.content === 'string') {
          finalDiffText = parsed.content;
        } else {
          throw new Error('JSON 结构中缺少预期的文本字段');
        }
      } catch (e) {
        console.log('>>> [AUTO 引擎] 数据以纯文本模式渲染');
      }

      if (finalDiffText) {
        const melted = meltDiffToDraft(finalDiffText);

        setDiffDraft(finalDiffText);
        setDraft(melted);
        currentDraftRef.current = melted;
        baseScoresRef.current = { ...baseScoresRef.current, ...changedParams };

        setHistory(prev => [
          ...prev,
          {
            id: `V${prev.length + 1}`,
            draft: melted,
            scores: { ...baseScoresRef.current }
          }
        ]);

        return finalDiffText;
      } else {
        throw new Error('多级提取后文本仍为空');
      }
    } catch (err) {
      console.error('>>> [引擎微调] 请求拦截:', err);

      if (err.name === 'AbortError' && diffAbortControllerRef.current !== controller) {
        return null;
      }

      if (err.name === 'AbortError') {
        showToast('网络波动推演超时 (60s)，已取消本次重构');
      } else {
        showToast('引擎暂时开小差了，请稍后再试');
      }
      setDiffDraft(null);
      setScores({ ...baseScoresRef.current });
      return null;
    } finally {
      clearTimeout(timeoutId);
      if (diffAbortControllerRef.current === controller) {
        setIsDiffLoading(false);
        diffAbortControllerRef.current = null;
      }
    }
  };

  // 核心跳跃：标签熔炼转化器
  const meltDiffToDraft = (diffHtml) => {
    if (!diffHtml) return '';
    return diffHtml
      .replace(/<del>[\s\S]*?<\/del>/gi, '') // 彻底丢弃 <del> 及其内部内容
      .replace(/<\/?ins>/gi, '');            // 仅剥离 <ins> 标签外壳，保留内部新增文本
  };

  // 轻量防抖钩子：只负责计算偏移并调用引擎
  const autoDebounceRef = useRef(
    debounce((currentScores, base) => {
      const changedParams = {};
      let count = 0;
      for (const key in currentScores) {
        if (currentScores[key] !== base[key]) {
          changedParams[key] = currentScores[key];
          count++;
        }
      }
      if (count > 0) {
        triggerDiffEngine(changedParams, count);
      }
    }, 1500)
  );

  const TERMINAL_TEXTS = [
    '> 正在解析你的意图...',
    '> 载入 [亲近感: 0.85]',
    '> 优化 [干货密度: 0.60]',
    '> 调整 [情绪浓度: 0.75]',
    '> 校验 [催促力度: 0.40]',
    '> 注入语义参数中...',
    '> 推演文案结构...',
    '> 生成最优输出...'
  ]

  useEffect(() => {
    const timer = setTimeout(() => setIsEntering(false), 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!loading && !isDiffLoading) return
    let current = 0
    const interval = setInterval(() => {
      const active = []
      for (let i = 0; i < 10; i++) {
        if (i >= current && i < current + 3) active.push(i)
      }
      setSkeletonDots(active)
      setGlowPosition(current)
      current = (current + 1) % 10
    }, 150)
    return () => clearInterval(interval)
  }, [loading, isDiffLoading])

  useEffect(() => {
    if (!loading && !isDiffLoading) return
    const textInterval = setInterval(() => {
      setTerminalOpacity(0)
      setTimeout(() => {
        setTerminalTextIndex((prev) => (prev + 1) % TERMINAL_TEXTS.length)
        setTerminalOpacity(1)
      }, 200)
    }, 1500)
    return () => clearInterval(textInterval)
  }, [loading, isDiffLoading])

  const mapScoresToSliders = (scoresObj) => {
    if (!scoresObj || typeof scoresObj !== 'object') return {}
    const mapped = {}
    const allSliders = [
      ...SLIDER_CONFIG.flatMap(g => g.items),
      ...ADVANCED_SLIDERS
    ]

    // 辅助函数：清洗数值为 0-1 之间的浮点数
    const normalizeValue = (value) => {
      if (value === undefined || value === null) return undefined
      const num = Number(value)
      if (isNaN(num)) return undefined
      // 如果是 0-100 的百分制，转换为 0-1
      if (num > 1) return num / 100
      return num
    }

    for (const slider of allSliders) {
      if (scoresObj[slider.key] !== undefined) {
        mapped[slider.key] = normalizeValue(scoresObj[slider.key])
      } else if (scoresObj[slider.title] !== undefined) {
        mapped[slider.key] = normalizeValue(scoresObj[slider.title])
      }
    }
    for (const key of Object.keys(scoresObj)) {
      if (mapped[key] === undefined) {
        mapped[key] = normalizeValue(scoresObj[key])
      }
    }
    return mapped
  }

  useEffect(() => {
    const userQuery = sessionStorage.getItem('userInput')
    if (!userQuery || userQuery.trim() === '') {
      // 允许停留，展示空状态提示
      return
    }
    setSysError(null)
    fetchData(userQuery)
  }, [])

  const fetchData = async (query, isAppend = false) => {
    if (isAppend) {
      setIsDiffLoading(true);
    } else {
      setLoading(true);
      setDraft('');
      setScores({});
    }
    setSysError(null);
    setDiffDraft(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch('/dify-api/v1/workflows/run', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': 'Bearer app-ohequ4QpaSvQGIcYx7zGcOyc',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: { input_text: query },
          response_mode: 'blocking',
          user: 'web-user'
        })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      const answerStr = data?.data?.outputs?.text || ''

      if (!answerStr || !answerStr.trim()) {
        throw new Error('返回数据为空')
      }

      let cleanedText = answerStr
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```json/gi, '')
        .replace(/```/gi, '')
        .trim()

      const parsed = JSON.parse(cleanedText)
      const finalDraft = parsed.draft || ''

      if (finalDraft.trim().length < 5) {
        setSysError('> SYS_ERR: 引擎未能推演出有效文案')
      } else {
        setDraft(finalDraft);
        currentDraftRef.current = finalDraft;

        const diagText = parsed.diagnosis || '> 诊断：已提取核心诉求，并自动套用 [平衡沟通] 预设。你可以随时拖动右侧滑块打破预设。';
        setDiagnosis(diagText);

        const scoresData = parsed.scores || parsed;
        const mappedScores = mapScoresToSliders(scoresData);
        setScores(mappedScores);
        baseScoresRef.current = mappedScores;

        setHistory(prev => [
          ...prev,
          {
            id: `V${prev.length + 1}`,
            draft: finalDraft,
            scores: mappedScores
          }
        ]);
      }
    } catch (err) {
      console.error('Fetch Error:', err);
      if (isAppend) {
        if (err.name === 'AbortError') {
          showToast('网络波动推演超时 (45s)，已取消追加');
        } else {
          showToast('引擎暂时开小差了，请稍后再试');
        }
      } else {
        if (err.name === 'AbortError') {
          setSysError('> SYS_ERR: 引擎推演超时 (45s)，请检查网络或稍后重试');
        } else {
          setSysError('> SYS_ERR: 引擎连接失败或解析异常');
        }
      }
    } finally {
      clearTimeout(timeoutId);
      if (isAppend) {
        setIsDiffLoading(false);
      } else {
        setLoading(false);
      }
    }
  }

  const handleAppendSubmit = () => {
    if (!appendQuery.trim()) return;

    const combinedQuery = `【当前文案】\n${currentDraftRef.current}\n\n【用户追加修改指令】\n${appendQuery}`;

    setShowAppendInput(false);
    setAppendQuery('');

    fetchData(combinedQuery, true);
  };

  const handleNavClick = (item) => {
    setActiveNav(item)
    if (item === '首页') navigate('/')
    else if (item === '模板库') navigate('/templates')
    else if (item === '我的') navigate('/my')
    else if (item === '设置') navigate('/settings')
  }

  const getSliderValue = (key) => {
    if (scores[key] !== undefined) return scores[key]
    const allSliders = [...SLIDER_CONFIG.flatMap(g => g.items), ...ADVANCED_SLIDERS]
    const slider = allSliders.find(s => s.key === key)
    return slider ? slider.defaultValue : 0.5
  }

  const getPolarityValue = () => {
    // 尝试多种可能的键名
    const keys = ['emotion_polarity', 'emotionPolarity', '情感倾向', 'polarity', 'sentiment']
    for (const key of keys) {
      if (scores[key] !== undefined) {
        const val = Number(scores[key])
        // 离散化为三个等级：< 0.33 = 0 (避雷), 0.33-0.66 = 0.5 (中性), > 0.66 = 1 (种草)
        if (val < 0.33) return '0'
        if (val > 0.66) return '1'
        return '0.5'
      }
    }
    return '1'
  }

  const handleSliderChange = (key, newValue) => {
    const val = Number(newValue);

    setScores(prev => {
      // 确保拿到 100% 最新的状态集合
      const updatedScores = { ...prev, [key]: val };

      // 在拿到最新状态的瞬间，触发防抖引擎
      if (autoApply) {
        autoDebounceRef.current(updatedScores, baseScoresRef.current);
      }

      return updatedScores;
    });
  };

  const getStagedInfo = () => {
    const base = baseScoresRef.current;
    const changed = {};
    let count = 0;
    for (const key in scores) {
      if (scores[key] !== base[key]) { changed[key] = scores[key]; count++; }
    }
    return { changed, count };
  };
  const { changed: stagedParams, count: stagedCount } = getStagedInfo();

  const handleCancel = () => setScores({ ...baseScoresRef.current });
  const handleManualApply = async () => {
    const result = await triggerDiffEngine(stagedParams, stagedCount);
    if (result) {
      setDiffDraft(null);
    }
  };

  // ================= 暗码指纹嗅探引擎 =================
  const applyFingerprint = (text) => {
    if (text && text.startsWith('ABBEL_PRESET:')) {
      try {
        const parsedScores = JSON.parse(text.replace('ABBEL_PRESET:', ''));
        setScores(prev => {
          const updatedScores = { ...prev, ...parsedScores };
          // 触发防抖重构引擎（如果 AUTO 开启）
          if (autoApply) {
            autoDebounceRef.current(updatedScores, baseScoresRef.current);
          }
          return updatedScores;
        });
        showToast('指纹解析成功，调音台参数已就位！', 'success');
      } catch (e) {
        showToast('指纹格式已损坏，解析失败', 'error');
      }
      return true;
    }
    return false;
  };

  useEffect(() => {
    const handlePaste = (e) => {
      const pasteText = e.clipboardData.getData('text');
      if (pasteText && pasteText.startsWith('ABBEL_PRESET:')) {
        e.preventDefault(); // 拦截粘贴行为，防止暗码被输入到文本框中
        applyFingerprint(pasteText);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [autoApply]); // 依赖 autoApply 确保触发引擎

  const handleReadClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!applyFingerprint(text)) {
        showToast('剪贴板中未检测到有效的 ABBEL_PRESET 指纹', 'error');
      }
    } catch (err) {
      showToast('读取剪贴板被拒绝，请使用 Ctrl+V / Cmd+V 手动粘贴', 'error');
    }
  };
  // ===================================================

  // ================= 记忆槽：存入模板 =================
  const handleSaveTemplate = () => {
    const tplName = window.prompt('请输入专属模板名称 (例如：硬核说理风)：');
    if (!tplName || !tplName.trim()) return;

    const newTemplate = {
      id: Date.now().toString(),
      name: tplName.trim(),
      scores: { ...scores } // 深度克隆当前所有维度的参数
    };

    // 读取旧数据并追加新数据
    const existingData = localStorage.getItem('abbel_templates');
    const templates = existingData ? JSON.parse(existingData) : [];
    templates.push(newTemplate);

    localStorage.setItem('abbel_templates', JSON.stringify(templates));
    showToast(`已保存专属模板: ${tplName.trim()}`, 'success'); // ⚠️ 标记为成功
    
    // 保存后自动复制指纹，方便分享
    const fingerprint = `ABBEL_PRESET:${JSON.stringify(newTemplate.scores)}`;
    navigator.clipboard.writeText(fingerprint).catch(() => {});
  };
  // ===================================================

  // ================= 闭环：一键复制并结束 =================
  const handleCopyAndEnd = () => {
    if (!draft) return;
    navigator.clipboard.writeText(draft).then(() => {
      showToast('文案已复制到剪贴板！', 'success'); // ⚠️ 标记为成功，且移除 setTimeout 跳转
    }).catch(() => {
      showToast('剪贴板调用失败，请手动选取文本复制', 'error');
    });
  };
  // =======================================================

  // 时空穿梭：切换历史版本
  const handleVersionSwitch = (targetIndex) => {
    const targetVersion = history[targetIndex];
    if (!targetVersion) return;

    // 1. 恢复 React 视图状态
    setDraft(targetVersion.draft);
    setScores(targetVersion.scores);
    setDiffDraft(null);
    setDiagnosis(`> 时空穿梭：已强制回滚至 ${targetVersion.id} 版本`);

    // 2. 同步重置底层核心 Refs (极其重要，否则下次发包会错乱)
    currentDraftRef.current = targetVersion.draft;
    baseScoresRef.current = { ...targetVersion.scores };

    // 3. 截断时间线（像 Git reset --hard 一样，丢弃该版本之后的未来版本）
    setHistory(prev => prev.slice(0, targetIndex + 1));
  };

  const renderSlider = (slider) => {
    const value = getSliderValue(slider.key)
    const percent = Math.max(0, Math.min(1, value)) * 100
    return (
      <div className="slider-item" key={slider.key} data-param={slider.key}
        onMouseEnter={() => setHoveredDesc(`> [${slider.title}] ${slider.desc}`)}
        onMouseLeave={() => setHoveredDesc('')}
      >
        <div className="slider-header">
          <div>
            <span className="slider-title">{slider.title}</span>
            <span className="slider-name">{slider.key}</span>
          </div>
          <span className="slider-val">{Number(value).toFixed(2)}</span>
        </div>
        <div className="slider-track" style={{ position: 'relative' }}>
          {/* 原有的视觉表现层 */}
          <div className="slider-fill" style={{ width: percent + '%' }}></div>
          <div className="slider-thumb" style={{ left: percent + '%' }}></div>

          {/* 新增的透明交互层 */}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={value}
            onChange={(e) => handleSliderChange(slider.key, e.target.value)}
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              opacity: 0, cursor: 'pointer', margin: 0, zIndex: 5
            }}
          />
        </div>
        <div className="slider-labels">
          <span>{slider.leftLabel}</span>
          <span>{slider.rightLabel}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`workspace-page page-enter ${!isEntering ? 'page-enter-active' : ''}`} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, padding: 0, margin: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100vw', maxWidth: 'none' }}>
      {/* 全局 Toast 提示 */}
      {toastMsg && (
        <div style={{
          position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(30, 30, 30, 0.85)', backdropFilter: 'blur(8px)',
          border: `1px solid ${toastType === 'success' ? 'rgba(102,255,136,0.4)' : 'rgba(255,100,100,0.4)'}`, 
          borderRadius: '6px',
          padding: '8px 16px', 
          color: toastType === 'success' ? '#66FF88' : '#ff6b6b', 
          fontSize: '13px', fontWeight: '500',
          zIndex: 9999, display: 'flex', alignItems: 'center', gap: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', animation: 'fadeIn 0.2s ease-out'
        }}>
          <span style={{ 
            display: 'inline-block', width: '6px', height: '6px', 
            background: toastType === 'success' ? '#66FF88' : '#ff6b6b', 
            borderRadius: '50%' 
          }}></span>
          {toastMsg}
        </div>
      )}
        {/* 顶部全局导航栏 (满宽贴边) */}
        <div className="top-bar" style={{ margin: 0, width: '100%', flexShrink: 0, borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', boxSizing: 'border-box', display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '1440px', padding: '0 24px' }}>
            <div className="nameplate">[ ABBEL -01 / 筑达每次沟通 ]</div>
            <div className="nav-pills">
              <div
                className={`nav-pill ${activeNav === '首页' ? 'active' : ''}`}
                onClick={() => handleNavClick('首页')}
              >
                首页
              </div>
              <div
                className={`nav-pill ${activeNav === '工作台' ? 'active' : ''}`}
                onClick={() => handleNavClick('工作台')}
              >
                工作台
              </div>
              <div
                className={`nav-pill ${activeNav === '模板库' ? 'active' : ''}`}
                onClick={() => handleNavClick('模板库')}
              >
                模板库
              </div>
              <div
                className={`nav-pill ${activeNav === '我的' ? 'active' : ''}`}
                onClick={() => handleNavClick('我的')}
              >
                我的
              </div>
              <div
                className={`nav-pill ${activeNav === '设置' ? 'active' : ''}`}
                onClick={() => handleNavClick('设置')}
              >
                设置
              </div>
            </div>
            <div className="nameplate">V4.0 // TRANSLUCENT</div>
          </div>
        </div>

      <div className="workspace-container" style={{ flex: 1, padding: '24px', boxSizing: 'border-box', overflow: 'hidden', margin: '0 auto', maxWidth: '1440px', width: '100%' }}>
        <div className="glass-module render-pane">
          <div className="render-header">
            <div className="task-title">
              语义解压输出
              <span className="version-tag">v1.0</span>
            </div>
            <div className={`status-indicator ${sysError ? 'error' : ''}`}>
              <div className="led-pulse"></div>
              {sysError ? 'SYS_ERROR' : loading ? 'DECODING_IN_PROGRESS' : 'OUTPUT_READY'}
            </div>
          </div>

          <div className="render-content">
            <div className="progress-indicator">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={`dot ${loading || isDiffLoading ? (skeletonDots.includes(i) ? 'active' : '') : (i === 0 ? 'active' : '')} ${(loading || isDiffLoading) && glowPosition === i ? 'glow-flow' : ''}`}
                ></div>
              ))}
            </div>

            {loading || isDiffLoading ? (
              <>
                <div className="terminal-text" style={{ color: isDiffLoading ? 'var(--color-accent-primary)' : 'inherit', opacity: terminalOpacity }}>
                  {isDiffLoading ? '> 接收到多维参数偏移，正在执行底层语义重构 (Diffing)...' : TERMINAL_TEXTS[terminalTextIndex]}
                </div>
                <div className="skeleton-text">
                  <div className="skeleton-line w-80"></div>
                  <div className="skeleton-line w-100"></div>
                  <div className="skeleton-line w-90"></div>
                  <div className="skeleton-line w-70"></div>
                  <div className="skeleton-line w-95"></div>
                  <div className="skeleton-line w-60"></div>
                  <div className="skeleton-line w-85"></div>
                  <div className="skeleton-line w-75"></div>
                </div>
              </>
            ) : sysError ? (
              <div className="terminal-text error">
                {sysError}
              </div>
            ) : diffDraft ? (
              <div className="fade-in-diff">
                <div className="terminal-text success" style={{ marginBottom: '4px', color: 'var(--color-accent-primary)' }}>
                  > 语义重构完成：已生成参数对比视图
                </div>
                <div className="terminal-text diagnosis" style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginBottom: '16px', opacity: 0.8 }}>
                  {diagnosis}
                </div>
                <div 
                  className="draft-text-output ghost-diff-layer" 
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', position: 'relative' }}
                  dangerouslySetInnerHTML={{ __html: diffDraft }}
                />
              </div>
            ) : draft && draft.trim().length >= 5 ? (
              <div className="fade-in-diff">
                <div className="terminal-text success" style={{ marginBottom: '4px' }}>
                  > 解析成功：已生成最优文案
                </div>
                <div className="terminal-text diagnosis" style={{ 
                  color: 'var(--color-text-secondary)', 
                  fontSize: '12px', 
                  marginBottom: '16px',
                  opacity: 0.8
                }}>
                  {diagnosis}
                </div>
                <div className="draft-text-output" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {draft}
                </div>
              </div>
            ) : (
              <div className="terminal-text warning">
                > 等待输入有效需求后自动生成...
              </div>
            )}

            <div className="version-timeline-vertical">
              {history.map((version, index) => (
                <div key={version.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div
                    className={`v-node ${index === history.length - 1 ? 'active' : ''}`}
                    onClick={() => handleVersionSwitch(index)}
                    style={{ cursor: 'pointer' }}
                  >
                    {version.id}
                  </div>
                  {index !== history.length - 1 && (
                    <div className="v-line-vertical"></div>
                  )}
                </div>
              ))}
            </div>

            <div className={`apply-action-bar ${!autoApply && stagedCount > 0 && !isDiffLoading ? 'visible' : ''}`}>
              <div className="apply-text">
                <span>{stagedCount} 个参数已偏移</span>
                <span className="token-badge">≈ 消耗 {10 + stagedCount * 15} Tokens</span>
              </div>
              <button className="btn-primary" style={{ padding: '6px 16px', fontSize: '12px' }} onClick={handleManualApply}>✓ 应用重构</button>
              <button className="btn-tool" style={{ padding: '6px 12px', fontSize: '12px', color: 'white', borderColor: 'rgba(255,255,255,0.3)' }} onClick={handleCancel}>取消</button>
            </div>
          </div>

          {/* 追加上下文输入面板 */}
          {showAppendInput && (
            <div style={{ padding: '0 24px 16px', display: 'flex', gap: '8px', animation: 'fadeIn 0.2s ease-out', alignItems: 'flex-end' }}>
              <textarea
                value={appendQuery}
                onChange={(e) => {
                  setAppendQuery(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                placeholder="例如：加上限时折扣信息... (回车发送，Shift+Enter换行)"
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.25)',
                  color: 'var(--color-text-primary)', fontSize: '13px', outline: 'none',
                  resize: 'none', overflowY: 'auto', minHeight: '39px', maxHeight: '150px',
                  boxSizing: 'border-box', lineHeight: '1.5', fontFamily: 'inherit',
                  transition: 'border-color 0.2s'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (appendQuery.trim() && !loading) {
                      handleAppendSubmit();
                    }
                  }
                }}
                autoFocus
                rows={1}
              />
              <button
                className="btn-primary"
                style={{ padding: '0 20px', height: '39px', fontSize: '13px', opacity: appendQuery.trim() ? 1 : 0.5 }}
                onClick={handleAppendSubmit}
                disabled={!appendQuery.trim() || loading}
              >
                发送
              </button>
            </div>
          )}

          <div className="render-footer">
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn-tool" 
                onClick={() => fetchData(sessionStorage.getItem('userInput'))}
                disabled={loading || isDiffLoading}
              >
                重新生成
              </button>
              <button className="btn-amber" onClick={() => setShowAppendInput(!showAppendInput)}>追加上下文</button>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>当前配置已达预期？</span>
              <button className="btn-tool" onClick={handleSaveTemplate}>保存为专属模板</button>
              <button 
                className="btn-primary" 
                onClick={handleCopyAndEnd}
                disabled={!draft || loading || isDiffLoading}
              >
                一键复制全文
              </button>
            </div>
          </div>
        </div>

        <div className="resizer"></div>

        <div className="glass-module control-pane">
          <div className="control-header">
            <span className="nameplate">[PARAMETERS / 调音台]</span>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              {/* 悬浮记忆槽组块 */}
              <div style={{ position: 'relative' }} ref={slotMenuRef}>
                <button 
                  className="btn-tool" 
                  title="调取记忆槽或输入指纹"
                  style={{ 
                    padding: '4px 10px', fontSize: '11px', 
                    borderColor: showSlotMenu ? 'var(--color-accent-primary)' : '', 
                    color: showSlotMenu ? 'var(--color-accent-primary)' : '' 
                  }}
                  onClick={() => setShowSlotMenu(!showSlotMenu)}
                  disabled={loading || isDiffLoading}
                >
                  记忆与指纹
                </button>

                {showSlotMenu && (
                  <div className="glass-module" style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: '8px', width: '260px', 
                    padding: '16px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)'
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', letterSpacing: '1px' }}>[ LOCAL_SLOTS / 本地记忆 ]</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                      {savedTemplates.length === 0 ? (
                        <div style={{ fontSize: '12px', opacity: 0.5, padding: '8px 0', textAlign: 'center' }}>暂无保存的记忆模板</div>
                      ) : (
                        savedTemplates.map(tpl => (
                          <div 
                            key={tpl.id} 
                            style={{ 
                              padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', 
                              fontSize: '12px', cursor: 'pointer', border: '1px solid transparent',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                            onClick={() => handleApplySlot(tpl)}
                          >
                            {tpl.name}
                          </div>
                        ))
                      )}
                    </div>
                    
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }}></div>
                    
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', letterSpacing: '1px' }}>[ FINGERPRINT / 指纹解析 ]</div>
                    <button 
                      className="btn-primary" 
                      style={{ padding: '8px', fontSize: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', width: '100%', boxSizing: 'border-box' }}
                      onClick={() => {
                        handleReadClipboard();
                        setShowSlotMenu(false);
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      从剪贴板读取暗码
                    </button>
                    <div style={{ fontSize: '10px', opacity: 0.5, textAlign: 'center' }}>* 在工作台任何位置按 Ctrl+V 均可静默解析</div>
                  </div>
                )}
              </div>

              <label 
                title="开启后，松开滑块1.5秒自动应用更改"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}
              >
                <input
                  type="checkbox"
                  style={{ display: 'none' }}
                  checked={autoApply}
                  onChange={(e) => setAutoApply(e.target.checked)}
                />
                <div style={{
                  width: '32px', height: '18px',
                  background: autoApply ? 'var(--color-accent-primary)' : 'rgba(0,0,0,0.15)',
                  borderRadius: '9px',
                  position: 'relative', transition: 'background 0.3s ease',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <div style={{
                    width: '14px', height: '14px',
                    background: '#FFFFFF',
                    borderRadius: '50%', position: 'absolute',
                    left: autoApply ? '16px' : '2px', top: '2px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                    transition: 'left 0.3s ease'
                  }}></div>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-primary)' }}>AUTO 引擎</span>
              </label>
              <button 
                className="btn-tool" 
                title="恢复滑块至当前文案的基准参数（仅重置未应用的偏移）"
                style={{ padding: '4px 10px', fontSize: '11px' }}
                onClick={() => {
                  setScores(baseScoresRef.current);
                  showToast('已重置为引擎基准参数', 'success'); // ⚠️ 顺手标记为成功
                }}
                disabled={loading || isDiffLoading}
              >
                重置
              </button>
            </div>
          </div>

          <div className="control-content">
            {loading ? (
              <div className="skeleton-sliders">
                <div className="skeleton-group">
                  <div className="skeleton-group-label"></div>
                  <div className="skeleton-slider-item">
                    <div className="skeleton-slider-header"></div>
                    <div className="skeleton-slider-track"></div>
                    <div className="skeleton-slider-labels"></div>
                  </div>
                </div>
                <div className="skeleton-group">
                  <div className="skeleton-group-label"></div>
                  <div className="skeleton-slider-item">
                    <div className="skeleton-slider-header"></div>
                    <div className="skeleton-slider-track"></div>
                    <div className="skeleton-slider-labels"></div>
                  </div>
                </div>
                <div className="skeleton-group">
                  <div className="skeleton-group-label"></div>
                  <div className="skeleton-slider-item">
                    <div className="skeleton-slider-header"></div>
                    <div className="skeleton-slider-track"></div>
                    <div className="skeleton-slider-labels"></div>
                  </div>
                  <div className="skeleton-slider-item">
                    <div className="skeleton-slider-header"></div>
                    <div className="skeleton-slider-track"></div>
                    <div className="skeleton-slider-labels"></div>
                  </div>
                </div>
                <div className="skeleton-drawer"></div>
              </div>
            ) : (
              <>
                {SLIDER_CONFIG.map((group) => (
                  <div key={group.group}>
                    <div className="group-divider">
                      <span className="group-label">{group.group}</span>
                      <span className="group-sub">{group.groupSub}</span>
                      <div className="ruler-line"></div>
                    </div>
                    {group.items.map((slider) => renderSlider(slider))}
                  </div>
                ))}

                <details className="drawer-details" open={JSON.parse(localStorage.getItem('abbel_settings') || '{}').expandAdvanced || false}>
                  <summary>
                    <span className="summary-text-closed">▾ 展开高阶微调 (3 项)</span>
                    <span className="summary-text-open">▴ 收起高阶微调</span>
                  </summary>
                  <div className="drawer-content-inner">
                    {renderSlider(ADVANCED_SLIDERS[0])}

                    <div className="slider-item"
                      onMouseEnter={() => setHoveredDesc('> [褒贬倾向] 控制文案的情感色彩。避雷偏向客观风险提示，种草偏向积极感性推荐。')}
                      onMouseLeave={() => setHoveredDesc('')}
                    >
                      <div className="slider-header">
                        <div>
                          <span className="slider-title">褒贬倾向</span>
                          <span className="slider-name">emotion_polarity</span>
                        </div>
                      </div>
                      <div className="tristate-selector">
                        <label className="tristate-option">
                          <input
                            type="radio"
                            name="polarity"
                            value="0"
                            checked={getPolarityValue() === '0'}
                            onChange={(e) => handleSliderChange('emotion_polarity', e.target.value)}
                          />
                          <div className="tristate-label">
                            <div className="tristate-indicator"></div>
                            避雷
                          </div>
                        </label>
                        <label className="tristate-option">
                          <input
                            type="radio"
                            name="polarity"
                            value="0.5"
                            checked={getPolarityValue() === '0.5'}
                            onChange={(e) => handleSliderChange('emotion_polarity', e.target.value)}
                          />
                          <div className="tristate-label">
                            <div className="tristate-indicator"></div>
                            中性
                          </div>
                        </label>
                        <label className="tristate-option">
                          <input
                            type="radio"
                            name="polarity"
                            value="1"
                            checked={getPolarityValue() === '1'}
                            onChange={(e) => handleSliderChange('emotion_polarity', e.target.value)}
                          />
                          <div className="tristate-label">
                            <div className="tristate-indicator"></div>
                            种草
                          </div>
                        </label>
                      </div>
                    </div>

                    {renderSlider(ADVANCED_SLIDERS[1])}
                  </div>
                </details>
              </>
            )}
          </div>

          {/* 底部固钉信息屏 */}
          <div style={{
            marginTop: 'auto', padding: '12px 16px', background: 'rgba(0,0,0,0.2)',
            borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '11px',
            color: 'var(--color-text-secondary)', minHeight: '38px',
            display: 'flex', alignItems: 'center', transition: 'color 0.2s',
            letterSpacing: '0.5px'
          }}>
            <span style={{ color: hoveredDesc ? 'var(--color-accent-primary)' : 'inherit', opacity: hoveredDesc ? 1 : 0.5, transition: 'all 0.2s' }}>
              {hoveredDesc || '> SYSTEM_READY: 调音台待命中...'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Workspace
