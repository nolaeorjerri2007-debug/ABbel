import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { removeBackground } from '@imgly/background-removal';
import './ExportModal.css';

export default function ExportModal({ isOpen, onClose, rawText, parameters }) {
  // 状态机：INIT -> UPLOAD -> PROCESSING (AI抠图&取色) -> DEAL
  const [step, setStep] = useState('INIT');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [extractedBg, setExtractedBg] = useState('#f5f5f7'); // 智能背景色
  const [exportingIndex, setExportingIndex] = useState(null);
  const [aiProgress, setAiProgress] = useState('初始化视觉神经网络...');
  
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
    } else {
      setStep('INIT');
      setUploadedImage(null);
      setExtractedBg('#f5f5f7');
      setExportingIndex(null);
    }
  }, [isOpen]);

  // 核心视觉引擎：AI 抠图 + Canvas 智能取色
  const processImage = async (file) => {
    setStep('PROCESSING');
    try {
      setAiProgress('正在分离主体结构 (首次加载模型需耗时 5-10 秒)...');
      
      // 1. WASM AI 抠图
      const imageBlob = await removeBackground(file);
      const transparentUrl = URL.createObjectURL(imageBlob);
      setUploadedImage(transparentUrl);

      setAiProgress('正在解析图像色彩空间...');

      // 2. Canvas 智能取色算法
      const img = new Image();
      img.src = URL.createObjectURL(file); // 使用原图取色更准确
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        // 将图片压缩到 100px 级别进行像素采样，极大提升性能
        canvas.width = 100; 
        canvas.height = (img.height / img.width) * 100;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let r = 0, g = 0, b = 0, count = 0;
        
        // 步长设为 16 (每隔 4 个像素采样一次)
        for (let i = 0; i < data.length; i += 16) { 
          if (data[i + 3] > 200) { // 过滤掉太透明的像素
            r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
          }
        }
        
        if (count > 0) {
          r = Math.floor(r / count); g = Math.floor(g / count); b = Math.floor(b / count);
          
          // 色彩魔法：算法生成高级“莫兰迪色”
          // 逻辑：将提取的主题色与纯白色按 25% : 75% 的比例混合，强制降低饱和度并提高明度
          const finalR = Math.floor(r * 0.25 + 255 * 0.75);
          const finalG = Math.floor(g * 0.25 + 255 * 0.75);
          const finalB = Math.floor(b * 0.25 + 255 * 0.75);
          
          setExtractedBg(`rgb(${finalR}, ${finalG}, ${finalB})`);
        }
        
        setStep('DEAL'); // 解析完成，开始发牌
      };
    } catch (error) {
      console.error('AI 视觉引擎异常:', error);
      alert("环境不支持前端 AI 加速，已自动降级为原图直出。");
      setUploadedImage(URL.createObjectURL(file));
      setExtractedBg('#f5f5f7');
      setStep('DEAL');
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      processImage(file);
    }
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
          backgroundColor: index === 2 ? '#111111' : '#ffffff' 
        });
        const link = document.createElement('a');
        link.download = `Abbel_Poster_${Date.now()}.png`;
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

      {/* 第二幕：复古扫描卡槽 */}
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

      {/* 新增幕剧：视觉神经网络运算中 */}
      {step === 'PROCESSING' && (
        <div className="ai-processing-container">
          <div className="cube-loader">
            <div className="cube"></div><div className="cube"></div>
            <div className="cube"></div><div className="cube"></div>
          </div>
          <div className="ai-progress-text">{aiProgress}</div>
        </div>
      )}

      {/* 第三幕：牌局展开 (注入了动态生成的 extractedBg) */}
      {step === 'DEAL' && (
        <div className="poker-desk">
          <div className="poker-hint-text">
            <span>CHOOSE YOUR ASSET</span>
            <p>向两侧抽出检视卡牌 · 点击打出完成渲染</p>
          </div>

          <div className="poker-hand">
            {/* 卡牌 1：纯色底叠加风 */}
            <div className={`poker-card card-0 ${exportingIndex === 0 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 0 ? 'fade-out' : ''}`} onClick={() => handlePlayCard(0)}>
              {/* 👈 注意：这里将计算出的高级灰动态注入了背景 */}
              <div className="poster-canvas tpl-social" ref={cardRefs[0]} style={{ backgroundColor: extractedBg }}>
                <div className="poster-image-area"><img src={uploadedImage} alt="media" /></div>
                <div className="poster-text-area">
                  <div className="deco-line"></div>
                  <p className="poster-copy">{cleanText}</p>
                  <div className="poster-watermark">{getWatermarkString()}</div>
                </div>
              </div>
            </div>

            {/* 卡牌 2：极简留白排版 */}
            <div className={`poker-card card-1 ${exportingIndex === 1 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 1 ? 'fade-out' : ''}`} onClick={() => handlePlayCard(1)}>
              <div className="poster-canvas tpl-minimal" ref={cardRefs[1]}>
                {/* 👈 在图片区域注入背景色，营造高级感 */}
                <div className="poster-image-area square" style={{ backgroundColor: extractedBg }}><img src={uploadedImage} alt="media" /></div>
                <div className="poster-text-area">
                  <p className="poster-copy">{cleanText}</p>
                  <div className="poster-watermark">{getWatermarkString()}</div>
                </div>
              </div>
            </div>

            {/* 卡牌 3：赛博终端排版 (保留暗黑属性) */}
            <div className={`poker-card card-2 ${exportingIndex === 2 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 2 ? 'fade-out' : ''}`} onClick={() => handlePlayCard(2)}>
              <div className="poster-canvas tpl-cyber" ref={cardRefs[2]}>
                <div className="poster-image-area"><img src={uploadedImage} alt="media" /></div>
                <div className="poster-text-area">
                  <p className="poster-copy">{'>'} {cleanText}</p>
                  <div className="poster-watermark terminal-font">{getWatermarkString()}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}