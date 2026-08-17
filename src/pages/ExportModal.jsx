import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { removeBackground } from '@imgly/background-removal';
import './ExportModal.css';

export default function ExportModal({ isOpen, onClose, rawText }) {
  const [step, setStep] = useState('INIT');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [exportingIndex, setExportingIndex] = useState(null);
  const [aiProgress, setAiProgress] = useState('初始化视觉神经网络...');
  const [palette, setPalette] = useState({ bg: '#f2f0eb', text: '#3d3935' });
  
  // 初始化提取的文案，直接填充进 DOM
  const [textData, setTextData] = useState({ title: '产品名称', sub: '产品核心描述文案' });
  
  const fileInputRef = useRef(null);
  const cardRefs = [useRef(null), useRef(null), useRef(null)];

  const cleanText = (() => {
    if (!rawText) return '';
    return rawText.replace(/<del>[\s\S]*?<\/del>/g, '').replace(/<\/?ins>/g, '').trim();
  })();

  useEffect(() => {
    if (isOpen) {
      setStep('UPLOAD');
      
      const rawInput = sessionStorage.getItem('userInput') || '';
      let guessedTitle = rawInput.replace(/帮我|写.*文案|小红书|海报|推荐|关于|的|一段/g, '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ').trim().split(' ')[0];
      if (!guessedTitle || guessedTitle.length > 12) guessedTitle = 'ABBEL DESIGN';

      let guessedSub = cleanText.split(/[。！!？?\n|]+/)[0] || 'REDEFINE YOUR LIFESTYLE';

      setTextData({ title: guessedTitle, sub: guessedSub });
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
      setAiProgress('网络阻断：模型下载超时，已静默降级为原图直出...');
      setTimeout(() => {
        setUploadedImage(URL.createObjectURL(file));
        setStep('DEAL');
      }, 1500);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) processImage(file);
  };

  const handlePlayCard = async (index) => {
    if (exportingIndex !== null) return;
    
    // 🔪 核心细节：打牌前强行剥夺焦点，防止把光标一起截进海报里！
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

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

      {/* 彻底抛弃侧边栏，容器纯粹居中 */}
      <div className="abbel-modal-container-clean">
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
              <p>轻触文字直接修改 · 点击图片或卡牌空白处打出渲染</p>
            </div>

            <div className="poker-hand">
              {/* 卡牌 1 */}
              <div className={`poker-card card-0 ${exportingIndex === 0 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 0 ? 'fade-out' : ''}`} onClick={() => handlePlayCard(0)}>
                <div className="poster-canvas tpl-oriental" ref={cardRefs[0]} style={{ '--poster-bg': palette.bg, '--poster-text': palette.text }}>
                  <div className="oriental-text-wrap">
                    {/* 👇 内联编辑黑魔法 */}
                    <h1 className="oriental-title" contentEditable suppressContentEditableWarning onClick={e => e.stopPropagation()}>
                      {textData.title}
                    </h1>
                    <h2 className="oriental-subtitle" contentEditable suppressContentEditableWarning onClick={e => e.stopPropagation()}>
                      ○ {textData.sub}
                    </h2>
                  </div>
                  <div className="poster-image-wrap oriental-image-wrap"><img src={uploadedImage} alt="media" /></div>
                </div>
              </div>

              {/* 卡牌 2 */}
              <div className={`poker-card card-1 ${exportingIndex === 1 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 1 ? 'fade-out' : ''}`} onClick={() => handlePlayCard(1)}>
                <div className="poster-canvas tpl-wine" ref={cardRefs[1]} style={{ '--poster-bg': palette.bg, '--poster-text': palette.text }}>
                  <div className="wine-text-wrap">
                    <h1 className="wine-title" contentEditable suppressContentEditableWarning onClick={e => e.stopPropagation()}>
                      {textData.title.toUpperCase()}
                    </h1>
                    <h2 className="wine-subtitle" contentEditable suppressContentEditableWarning onClick={e => e.stopPropagation()}>
                      {textData.sub.toUpperCase()}
                    </h2>
                  </div>
                  <div className="poster-image-wrap wine-image-wrap"><img src={uploadedImage} alt="media" /></div>
                </div>
              </div>

              {/* 卡牌 3 */}
              <div className={`poker-card card-2 ${exportingIndex === 2 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 2 ? 'fade-out' : ''}`} onClick={() => handlePlayCard(2)}>
                <div className="poster-canvas tpl-magazine" ref={cardRefs[2]} style={{ '--poster-bg': palette.bg, '--poster-text': palette.text }}>
                  <div className="magazine-top-bar">
                    <span contentEditable suppressContentEditableWarning onClick={e => e.stopPropagation()}>{textData.sub}</span>
                    <span>ABBEL DESIGN</span>
                  </div>
                  <div className="magazine-bg-text" contentEditable suppressContentEditableWarning onClick={e => e.stopPropagation()}>
                    {textData.title.substring(0,6).toUpperCase()}
                  </div>
                  <div className="poster-image-wrap magazine-image-wrap"><img src={uploadedImage} alt="media" /></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}