import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { removeBackground } from '@imgly/background-removal';
import './ExportModal.css';

export default function ExportModal({ isOpen, onClose, rawText, parameters }) {
  const [step, setStep] = useState('INIT');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [exportingIndex, setExportingIndex] = useState(null);
  const [aiProgress, setAiProgress] = useState('初始化视觉神经网络...');
  
  // 核心：动态生成的同色系高级灰调色盘
  const [palette, setPalette] = useState({ bg: '#f2f0eb', text: '#3d3935' });
  
  const fileInputRef = useRef(null);
  const cardRefs = [useRef(null), useRef(null), useRef(null)];

  // 1. 纯净文本提取
  const cleanText = (() => {
    if (!rawText) return '';
    return rawText.replace(/<del>[\s\S]*?<\/del>/g, '').replace(/<\/?ins>/g, '').trim();
  })();

  // 2. 智能文案断句算法（切分出主标题和副标题）
  const copyData = (() => {
    if (!cleanText) return { title: 'ABBEL', subtitle: 'REDEFINE YOUR COPY' };
    // 按常见标点符号切分句子
    const segments = cleanText.split(/[,，。！!？?\n|]+/).map(s => s.trim()).filter(s => s.length > 0);
    
    let title = segments[0] || 'ABBEL';
    let subtitle = segments.length > 1 ? segments[1] : 'DESIGNED BY ABBEL ENGINE';
    
    // 如果主标题过长（超过10个字），强制截断以保证海报排版的美观性
    if (title.length > 10) {
      subtitle = title.substring(8) + (segments.length > 1 ? ' ' + segments[1] : '');
      title = title.substring(0, 8);
    }
    return { title, subtitle };
  })();

  useEffect(() => {
    if (isOpen) {
      setStep('UPLOAD');
    } else {
      setStep('INIT');
      setUploadedImage(null);
      setPalette({ bg: '#f2f0eb', text: '#3d3935' });
      setExportingIndex(null);
    }
  }, [isOpen]);

  // 3. AI 抠图与智能取色引擎
  const processImage = async (file) => {
    setStep('PROCESSING');
    try {
      setAiProgress('正在分离主体结构 (首次加载模型需耗时 5-10 秒)...');
      
      // WASM AI 抠图
      const imageBlob = await removeBackground(file);
      const transparentUrl = URL.createObjectURL(imageBlob);
      setUploadedImage(transparentUrl);

      setAiProgress('正在解析图像色彩空间...');

      // Canvas 智能取色与莫兰迪色域转换
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 100; 
        canvas.height = (img.height / img.width) * 100;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let i = 0; i < data.length; i += 16) { 
          if (data[i + 3] > 200) { 
            r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
          }
        }
        
        if (count > 0) {
          r = Math.floor(r / count); g = Math.floor(g / count); b = Math.floor(b / count);
          
          // 色彩魔法 1：生成柔和的莫兰迪背景色 (与大量白色混合)
          const bgR = Math.floor(r * 0.25 + 242 * 0.75);
          const bgG = Math.floor(g * 0.25 + 240 * 0.75);
          const bgB = Math.floor(b * 0.25 + 235 * 0.75);
          
          // 色彩魔法 2：生成同色系的极深文本色 (与大量深灰混合，确保可读性)
          const textR = Math.floor(r * 0.35 + 40 * 0.65);
          const textG = Math.floor(g * 0.35 + 40 * 0.65);
          const textB = Math.floor(b * 0.35 + 40 * 0.65);
          
          setPalette({
            bg: `rgb(${bgR}, ${bgG}, ${bgB})`,
            text: `rgb(${textR}, ${textG}, ${textB})`
          });
        }
        setStep('DEAL'); 
      };
    } catch (error) {
      console.error('AI 视觉引擎异常:', error);
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
        const canvas = await html2canvas(targetRef, {
          scale: 2,
          useCORS: true,
          backgroundColor: palette.bg // 动态使用计算出的底色
        });
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
            <div className="cube"></div><div className="cube"></div>
            <div className="cube"></div><div className="cube"></div>
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
            {/* 卡牌 1：东方雅致/草本风 (参考人参茶) */}
            <div className={`poker-card card-0 ${exportingIndex === 0 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 0 ? 'fade-out' : ''}`} onClick={() => handlePlayCard(0)}>
              <div className="poster-canvas tpl-oriental" ref={cardRefs[0]} style={{ '--poster-bg': palette.bg, '--poster-text': palette.text }}>
                <div className="oriental-text-wrap">
                  {/* 将主标题强制拆分为两行显示，增加设计感 */}
                  <h1 className="oriental-title" dangerouslySetInnerHTML={{ __html: copyData.title.replace(/(.{4})/g, '$1<br/>') }}></h1>
                  <h2 className="oriental-subtitle">○ {copyData.subtitle}</h2>
                </div>
                <div className="oriental-image-wrap"><img src={uploadedImage} alt="media" crossOrigin="anonymous" /></div>
              </div>
            </div>

            {/* 卡牌 2：现代极简/红酒风 (参考珑纳红酒) */}
            <div className={`poker-card card-1 ${exportingIndex === 1 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 1 ? 'fade-out' : ''}`} onClick={() => handlePlayCard(1)}>
              <div className="poster-canvas tpl-wine" ref={cardRefs[1]} style={{ '--poster-bg': palette.bg, '--poster-text': palette.text }}>
                <div className="wine-text-wrap">
                  <h1 className="wine-title">{copyData.title.toUpperCase()}</h1>
                  <h2 className="wine-subtitle">{copyData.subtitle.toUpperCase()}</h2>
                </div>
                <div className="wine-image-wrap"><img src={uploadedImage} alt="media" crossOrigin="anonymous" /></div>
              </div>
            </div>

            {/* 卡牌 3：先锋杂志/床品风 (参考 VISIONA 床单) */}
            <div className={`poker-card card-2 ${exportingIndex === 2 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 2 ? 'fade-out' : ''}`} onClick={() => handlePlayCard(2)}>
              <div className="poster-canvas tpl-magazine" ref={cardRefs[2]} style={{ '--poster-bg': palette.bg, '--poster-text': palette.text }}>
                <div className="magazine-top-bar">
                  <span>{copyData.subtitle.substring(0, 15)}</span>
                  <span>ABBEL DESIGN</span>
                </div>
                {/* 巨大的背景漂浮文字 */}
                <div className="magazine-bg-text">{copyData.title.toUpperCase()}</div>
                <div className="magazine-image-wrap"><img src={uploadedImage} alt="media" crossOrigin="anonymous" /></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}