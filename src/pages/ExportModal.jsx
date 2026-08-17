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
  
  const fileInputRef = useRef(null);
  const cardRefs = [useRef(null), useRef(null), useRef(null)];

  // 1. 清洗纯净文本
  const cleanText = (() => {
    if (!rawText) return '';
    return rawText.replace(/<del>[\s\S]*?<\/del>/g, '').replace(/<\/?ins>/g, '').trim();
  })();

  // 2. 🧠 核心：智能商业排版与文案切分引擎
  const copyData = (() => {
    let text = cleanText || '设计之美，重塑生活核心';
    
    // 按所有可能的标点符号切分
    let segments = text.split(/[,，。！!？?\n|:：]+/).map(s => s.trim()).filter(Boolean);
    
    // 如果AI吐出的是一整句没有标点的话，强行按字数智能切断
    if (segments.length === 1) {
      if (text.includes(' ')) {
        segments = text.split(' ').map(s => s.trim()).filter(Boolean);
      } else if (text.length >= 6) {
        // 前2-4个字做极简大标题，后面做副标题说明
        const splitIndex = text.length > 8 ? 4 : 2;
        segments = [text.substring(0, splitIndex), text.substring(splitIndex)];
      }
    }

    let title = segments[0] || 'ABBEL';
    let subtitle = segments.length > 1 ? segments.slice(1).join(' ') : 'REDEFINE YOUR LIFESTYLE';

    // 东方排版特性：标题长于4个字时，优美地从中间折行
    let orientalTitle = title;
    if (title.length > 4) {
      const mid = Math.ceil(title.length / 2);
      orientalTitle = title.substring(0, mid) + '<br/>' + title.substring(mid);
    }

    // 杂志排版特性：提取最核心词汇作为巨大背景字
    let magBgText = title.length > 6 ? title.substring(0, 6) : title;

    return { title, subtitle, orientalTitle, magBgText };
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
          
          // 生成高级灰与深灰点缀色
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
                  <h1 className="oriental-title" dangerouslySetInnerHTML={{ __html: copyData.orientalTitle }}></h1>
                  <h2 className="oriental-subtitle">○ {copyData.subtitle}</h2>
                </div>
                <div className="poster-image-wrap oriental-image-wrap"><img src={uploadedImage} alt="media" /></div>
              </div>
            </div>

            {/* 模板 2：现代极简 (珑纳红酒复刻) */}
            <div className={`poker-card card-1 ${exportingIndex === 1 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 1 ? 'fade-out' : ''}`} onClick={() => handlePlayCard(1)}>
              <div className="poster-canvas tpl-wine" ref={cardRefs[1]} style={{ '--poster-bg': palette.bg, '--poster-text': palette.text }}>
                <div className="wine-text-wrap">
                  <h1 className="wine-title">{copyData.title.toUpperCase()}</h1>
                  <h2 className="wine-subtitle">{copyData.subtitle.toUpperCase()}</h2>
                </div>
                <div className="poster-image-wrap wine-image-wrap"><img src={uploadedImage} alt="media" /></div>
              </div>
            </div>

            {/* 模板 3：先锋杂志 (VISIONA床品复刻) */}
            <div className={`poker-card card-2 ${exportingIndex === 2 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 2 ? 'fade-out' : ''}`} onClick={() => handlePlayCard(2)}>
              <div className="poster-canvas tpl-magazine" ref={cardRefs[2]} style={{ '--poster-bg': palette.bg, '--poster-text': palette.text }}>
                <div className="magazine-top-bar">
                  <span>{copyData.subtitle.substring(0, 20)}</span>
                  <span>ABBEL DESIGN</span>
                </div>
                <div className="magazine-bg-text">{copyData.magBgText.toUpperCase()}</div>
                <div className="poster-image-wrap magazine-image-wrap"><img src={uploadedImage} alt="media" /></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}