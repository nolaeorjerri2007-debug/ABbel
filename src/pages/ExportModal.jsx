import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import './ExportModal.css';

export default function ExportModal({ isOpen, onClose, rawText, parameters }) {
  // 状态机：'INIT' | 'COPIED' | 'UPLOAD' | 'DEAL' | 'EXPORTING'
  const [step, setStep] = useState('INIT');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [exportingIndex, setExportingIndex] = useState(null);
  
  const fileInputRef = useRef(null);
  const cardRefs = [useRef(null), useRef(null), useRef(null)]; // 用于绑定三张海报的截图节点

  // 纯净文本提取
  const cleanText = (() => {
    if (!rawText) return '';
    return rawText.replace(/<del>[\s\S]*?<\/del>/g, '').replace(/<\/?ins>/g, '').trim();
  })();

  // 渲染水印
  const getWatermarkString = () => {
    if (!parameters) return 'POWERED BY ABBEL ENGINE';
    const paramsList = Object.entries(parameters).map(([key, value]) => {
      const shortKey = key.replace('_density', '').replace('_force', '').toUpperCase();
      const num = Number(value);
      return `${shortKey}: ${Number.isFinite(num) ? num.toFixed(2) : value}`;
    });
    return `${paramsList.join(' | ')} | POWERED BY ABBEL ENGINE`;
  };

  // 幕剧引擎控制
  useEffect(() => {
    if (isOpen) {
      setStep('COPIED');
      // 第一幕：拔剑出鞘（写入剪贴板）
      if (cleanText) {
        navigator.clipboard.writeText(cleanText).catch(() => {});
      }
      // 1.8秒后自动进入第二幕
      const timer = setTimeout(() => {
        setStep('UPLOAD');
      }, 1800);
      return () => clearTimeout(timer);
    } else {
      // 弹窗关闭时重置所有状态
      setStep('INIT');
      setUploadedImage(null);
      setExportingIndex(null);
    }
  }, [isOpen, cleanText]);

  // 第二幕：上传实体媒介
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target.result);
        setStep('DEAL'); // 第三幕：触发发牌
      };
      reader.readAsDataURL(file);
    }
  };

  // 第四幕：打牌导出 (飞出屏幕)
  const handlePlayCard = async (index) => {
    if (exportingIndex !== null) return;
    setExportingIndex(index); // 触发该卡片的冲天动画

    const targetRef = cardRefs[index].current;
    if (!targetRef) return;

    try {
      // 给动画留出0.4秒飞出时间，同时在后台静默截图
      setTimeout(async () => {
        const canvas = await html2canvas(targetRef, {
          scale: 2,
          useCORS: true,
          backgroundColor: index === 2 ? '#111111' : '#ffffff' // 赛博卡用黑底，其余白底
        });
        const link = document.createElement('a');
        link.download = `Abbel_Masterpiece_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        // 导出完成后关闭弹窗
        setTimeout(() => onClose(), 500);
      }, 300);
    } catch (error) {
      console.error('导出失败', error);
      alert('导出失败，请重试');
      setExportingIndex(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="abbel-modal-overlay">
      <button className="btn-close-global" onClick={onClose}>[ ESC ] ABORT</button>

      {/* 第一幕：机械荧光文字 */}
      {step === 'COPIED' && (
        <div className="cyber-glitch-container">
          <div className="glitch-text" data-text="> SYS_MSG: 文案提取成功，已载入剪贴板_">
            {'>'} SYS_MSG: 文案提取成功，已载入剪贴板_
          </div>
        </div>
      )}

      {/* 第二幕：复古卡槽扫描仪 */}
      {step === 'UPLOAD' && (
        <div className="scanner-container">
          <div className="scanner-slot" onClick={() => fileInputRef.current.click()}>
            <div className="scanner-laser"></div>
            <div className="scanner-brackets">[ INSERT MEDIA ]</div>
            <div className="scanner-hint">请投入或点击上传产品影像</div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              style={{ display: 'none' }} 
            />
          </div>
        </div>
      )}

      {/* 第三幕 & 第四幕：扇形牌局展开 */}
      {step === 'DEAL' && (
        <div className="poker-desk">
          <div className="poker-hint-text">
            <span>CHOOSE YOUR WEAPON</span>
            <p>悬停检视卡牌 · 点击向上打出</p>
          </div>

          <div className="poker-hand">
            {/* 卡牌 1：小红书叠加悬浮风 (Social) */}
            <div 
              className={`poker-card card-0 ${exportingIndex === 0 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 0 ? 'fade-out' : ''}`}
              onClick={() => handlePlayCard(0)}
            >
              <div className="poster-canvas tpl-social" ref={cardRefs[0]}>
                <div className="poster-image-area"><img src={uploadedImage} alt="media" /></div>
                <div className="poster-text-area">
                  <div className="deco-line"></div>
                  <p className="poster-copy">{cleanText}</p>
                  <div className="poster-watermark">{getWatermarkString()}</div>
                </div>
              </div>
            </div>

            {/* 卡牌 2：极简杂志留白风 (Minimal) */}
            <div 
              className={`poker-card card-1 ${exportingIndex === 1 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 1 ? 'fade-out' : ''}`}
              onClick={() => handlePlayCard(1)}
            >
              <div className="poster-canvas tpl-minimal" ref={cardRefs[1]}>
                <div className="poster-image-area square"><img src={uploadedImage} alt="media" /></div>
                <div className="poster-text-area">
                  <p className="poster-copy">{cleanText}</p>
                  <div className="poster-watermark">{getWatermarkString()}</div>
                </div>
              </div>
            </div>

            {/* 卡牌 3：暗黑终端赛博风 (Cyber) */}
            <div 
              className={`poker-card card-2 ${exportingIndex === 2 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 2 ? 'fade-out' : ''}`}
              onClick={() => handlePlayCard(2)}
            >
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