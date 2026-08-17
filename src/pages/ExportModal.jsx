import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { removeBackground } from '@imgly/background-removal';
import './ExportModal.css';

export default function ExportModal({ isOpen, onClose, rawText, parameters }) {
  const [step, setStep] = useState('INIT');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [exportingIndex, setExportingIndex] = useState(null);
  const [aiProgress, setAiProgress] = useState('初始化视觉神经网络...');
  const [palette, setPalette] = useState({ bg: '#f2f0eb', text: '#3d3935' });
  
  // 🌟 核心新增：开放给用户的文案控制权
  const [customTitle, setCustomTitle] = useState('产品名称');
  const [customSubtitle, setCustomSubtitle] = useState('产品核心描述文案');
  
  const fileInputRef = useRef(null);
  const cardRefs = [useRef(null), useRef(null), useRef(null)];

  const cleanText = (() => {
    if (!rawText) return '';
    return rawText.replace(/<del>[\s\S]*?<\/del>/g, '').replace(/<\/?ins>/g, '').trim();
  })();

  const getWatermarkString = () => {
    if (!parameters) return 'POWERED BY ABBEL ENGINE';
    const paramsList = Object.entries(parameters).map(([key, value]) => {
      const shortKey = key.replace('_density', '').replace('_force', '').toUpperCase();
      const num = Number(value);
      return `${shortKey}: ${Number.isFinite(num) ? num.toFixed(2) : value}`;
    });
    return `${paramsList.join(' | ')} | POWERED BY ABBEL ENGINE`;
  };

  useEffect(() => {
    if (isOpen) {
      setStep('UPLOAD');
      
      // 🧠 智能推测：从用户的原始输入中提取产品名
      const rawInput = sessionStorage.getItem('userInput') || '';
      // 剔除常见的指令废话，提取核心名词
      let guessedTitle = rawInput
        .replace(/帮我|写.*文案|小红书|海报|推荐|关于|的|一段/g, '')
        .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ') // 把标点变空格
        .trim()
        .split(' ')[0]; // 取第一个核心词
        
      if (!guessedTitle || guessedTitle.length > 12) {
        guessedTitle = '产品名称/品牌';
      }

      // 提取 AI 生成文案的第一句作为副标题
      let guessedSub = cleanText.split(/[。！!？?\n|]+/)[0] || '这里是产品描述性文字';

      setCustomTitle(guessedTitle);
      setCustomSubtitle(guessedSub);

    } else {
      setStep('INIT');
      setUploadedImage(null);
      setPalette({ bg: '#f2f0eb', text: '#3d3935' });
      setExportingIndex(null);
    }
  }, [isOpen, cleanText]);

  const processImage = async (file) => {
    setStep('PROCESSING');
    try {
      setAiProgress('正在分离主体结构 (首次加载模型需耗时 5-10 秒)...');
      const imageBlob = await removeBackground(file);
      const transparentUrl = URL.createObjectURL(imageBlob);
      setUploadedImage(transparentUrl);

      setAiProgress('正在解析图像色彩空间...');
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 100; canvas.height = (img.height / img.width) * 100;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let i = 0; i < data.length; i += 16) { 
          if (data[i + 3] > 200) { r += data[i]; g += data[i + 1]; b += data[i + 2]; count++; }
        }
        
        if (count > 0) {
          r = Math.floor(r / count); g = Math.floor(g / count); b = Math.floor(b / count);
          const bgR = Math.floor(r * 0.15 + 245 * 0.85);
          const bgG = Math.floor(g * 0.15 + 242 * 0.85);
          const bgB = Math.floor(b * 0.15 + 238 * 0.85);
          const textR = Math.floor(r * 0.3 + 40 * 0.7);
          const textG = Math.floor(g * 0.3 + 40 * 0.7);
          const textB = Math.floor(b * 0.3 + 40 * 0.7);
          setPalette({ bg: `rgb(${bgR}, ${bgG}, ${bgB})`, text: `rgb(${textR}, ${textG}, ${textB})` });
        }
        setStep('DEAL'); 
      };
    } catch (error) {
      console.error('AI 引擎异常:', error);
      alert("环境不支持前端 AI 加速，已自动降级为原图直出。");
      setUploadedImage(URL.createObjectURL(file));
      setStep('DEAL');
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) processImage(file);
  };

  const handlePlayCard = async (index) => {
    if (exportingIndex !== null) return;
    setExportingIndex(index); 
    const targetRef = cardRefs[index].current;
    if (!targetRef) return;
    try {
      setTimeout(async () => {
        const canvas = await html2canvas(targetRef, { scale: 2, useCORS: true, backgroundColor: palette.bg });
        const link = document.createElement('a');
        link.download = `Abbel_Commercial_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        setTimeout(() => onClose(), 600);
      }, 300);
    } catch (error) {
      alert('导出失败，请重试');
      setExportingIndex(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="abbel-modal-overlay">
      <button className="btn-close-global" onClick={onClose}>[ ESC ] ABORT</button>

      {/* 左侧工作区 (包含扫描仪、Loader、牌桌) */}
      <div className="abbel-modal-preview">
        {step === 'UPLOAD' && (
          <div className="scanner-container">
            <div className="scanner-slot" onClick={() => fileInputRef.current.click()}>
              <div className="scanner-laser"></div>
              <div className="scanner-brackets">[ INSERT MEDIA ]</div>
              <div className="scanner-hint">投入影像，AI 将自动剥离背景并推演色域</div>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />
            </div>
          </div>
        )}

        {step === 'PROCESSING' && (
          <div className="ai-processing-container">
            <div className="cube-loader">
              <div className="cube"></div><div className="cube"></div><div className="cube"></div><div className="cube"></div>
            </div>
            <div className="ai-progress-text">{aiProgress}</div>
          </div>
        )}

        {step === 'DEAL' && (
          <div className="poker-desk">
            <div className="poker-hint-text">
              <span>CHOOSE YOUR LAYOUT</span>
              <p>向两侧抽出检视构图 · 点击打出完成渲染</p>
            </div>

            <div className="poker-hand">
              {/* 模板 1：东方雅致 (人参茶复刻) */}
              <div className={`poker-card card-0 ${exportingIndex === 0 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 0 ? 'fade-out' : ''}`} onClick={() => handlePlayCard(0)}>
                <div className="poster-canvas tpl-oriental" ref={cardRefs[0]} style={{ '--poster-bg': palette.bg, '--poster-text': palette.text }}>
                  <div className="oriental-text-wrap">
                    <h1 className="oriental-title" dangerouslySetInnerHTML={{ 
                      __html: customTitle.length > 3 && customTitle.length <= 8 
                        ? customTitle.substring(0, Math.ceil(customTitle.length/2)) + '<br/>' + customTitle.substring(Math.ceil(customTitle.length/2)) 
                        : customTitle 
                    }}></h1>
                    <h2 className="oriental-subtitle">○ {customSubtitle}</h2>
                  </div>
                  <div className="poster-image-wrap oriental-image-wrap"><img src={uploadedImage} alt="media" /></div>
                </div>
              </div>

              {/* 模板 2：现代极简 (珑纳红酒复刻) */}
              <div className={`poker-card card-1 ${exportingIndex === 1 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 1 ? 'fade-out' : ''}`} onClick={() => handlePlayCard(1)}>
                <div className="poster-canvas tpl-wine" ref={cardRefs[1]} style={{ '--poster-bg': palette.bg, '--poster-text': palette.text }}>
                  <div className="wine-text-wrap">
                    <h1 className="wine-title">{customTitle.toUpperCase()}</h1>
                    <h2 className="wine-subtitle">{customSubtitle.toUpperCase()}</h2>
                  </div>
                  <div className="poster-image-wrap wine-image-wrap"><img src={uploadedImage} alt="media" /></div>
                </div>
              </div>

              {/* 模板 3：先锋杂志 (VISIONA床品复刻) */}
              <div className={`poker-card card-2 ${exportingIndex === 2 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 2 ? 'fade-out' : ''}`} onClick={() => handlePlayCard(2)}>
                <div className="poster-canvas tpl-magazine" ref={cardRefs[2]} style={{ '--poster-bg': palette.bg, '--poster-text': palette.text }}>
                  <div className="magazine-top-bar">
                    <span>{customSubtitle}</span>
                    <span>ABBEL DESIGN</span>
                  </div>
                  <div className="magazine-bg-text">
                    {customTitle.length > 5 ? customTitle.substring(0, 5).toUpperCase() : customTitle.toUpperCase()}
                  </div>
                  <div className="poster-image-wrap magazine-image-wrap"><img src={uploadedImage} alt="media" /></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 右侧：排版控制台 */}
      <div className="abbel-modal-sidebar">
        <div className="sidebar-header">
          <h3>海报排版引擎</h3>
        </div>
        <div className="sidebar-controls">
          <div className="control-group">
            <label>视觉焦点 (主标题)</label>
            <input 
              type="text" 
              className="abbel-input" 
              value={customTitle} 
              onChange={e => setCustomTitle(e.target.value)} 
              placeholder="例如：猎人保暖衣" 
            />
          </div>
          <div className="control-group">
            <label>辅助说明 (副标题)</label>
            <textarea 
              className="abbel-textarea" 
              value={customSubtitle} 
              onChange={e => setCustomSubtitle(e.target.value)} 
              placeholder="例如：锁温黑科技，无惧寒冬。"
              rows={3}
            />
          </div>
          <div className="control-group">
             <label>色彩推演状态</label>
             <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: palette.bg, border: '1px solid #eee' }} title="莫兰迪背景色"></div>
                <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: palette.text, border: '1px solid #eee' }} title="深邃点缀色"></div>
             </div>
             <div className="scanner-hint" style={{marginTop: '8px'}}>基于产品图像智能提取</div>
          </div>
        </div>
      </div>
    </div>
  );
}