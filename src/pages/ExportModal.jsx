import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import './ExportModal.css';

export default function ExportModal({ isOpen, onClose, rawText, parameters }) {
  // 状态机直接从 UPLOAD 开始：'INIT' | 'UPLOAD' | 'DEAL' 
  const [step, setStep] = useState('INIT');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [exportingIndex, setExportingIndex] = useState(null);
  
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
      setStep('UPLOAD'); // 👈 打开直接就是扫描仪
    } else {
      setStep('INIT');
      setUploadedImage(null);
      setExportingIndex(null);
    }
  }, [isOpen]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target.result);
        setStep('DEAL');
      };
      reader.readAsDataURL(file);
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

      {step === 'UPLOAD' && (
        <div className="scanner-container">
          <div className="scanner-slot" onClick={() => fileInputRef.current.click()}>
            <div className="scanner-laser"></div>
            <div className="scanner-brackets">[ INSERT MEDIA ]</div>
            <div className="scanner-hint">投入或点击上传产品影像，以渲染高阶海报</div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />
          </div>
        </div>
      )}

      {step === 'DEAL' && (
        <div className="poker-desk">
          <div className="poker-hint-text">
            <span>CHOOSE YOUR ASSET</span>
            <p>向两侧抽出检视卡牌 · 点击打出完成渲染</p>
          </div>

          <div className="poker-hand">
            {/* 左侧牌 */}
            <div className={`poker-card card-0 ${exportingIndex === 0 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 0 ? 'fade-out' : ''}`} onClick={() => handlePlayCard(0)}>
              <div className="poster-canvas tpl-social" ref={cardRefs[0]}>
                <div className="poster-image-area"><img src={uploadedImage} alt="media" /></div>
                <div className="poster-text-area">
                  <div className="deco-line"></div>
                  <p className="poster-copy">{cleanText}</p>
                  <div className="poster-watermark">{getWatermarkString()}</div>
                </div>
              </div>
            </div>

            {/* 中间牌 */}
            <div className={`poker-card card-1 ${exportingIndex === 1 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 1 ? 'fade-out' : ''}`} onClick={() => handlePlayCard(1)}>
              <div className="poster-canvas tpl-minimal" ref={cardRefs[1]}>
                <div className="poster-image-area square"><img src={uploadedImage} alt="media" /></div>
                <div className="poster-text-area">
                  <p className="poster-copy">{cleanText}</p>
                  <div className="poster-watermark">{getWatermarkString()}</div>
                </div>
              </div>
            </div>

            {/* 右侧牌 */}
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
