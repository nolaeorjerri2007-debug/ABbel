import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { removeBackground } from '@imgly/background-removal';
import './ExportModal.css';

// AI 抠图模型资源地址：已本地化到 public/background-removal/（同源加载，不依赖外网 CDN）
const IMGLY_PUBLIC_PATH = `${window.location.origin}/background-removal/`;
const AI_TIMEOUT_MS = 15000;

// 本地 Canvas 纯色背景过滤：当 WASM AI 抠图失败时，把白/纯色背景洗成透明
function removeSolidBackground(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(objectUrl);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 采样四条边像素，估算纯色背景的 RGB 基准
        let br = 0, bg = 0, bb = 0, count = 0;
        const sample = (x, y) => {
          const i = (y * canvas.width + x) * 4;
          br += data[i]; bg += data[i + 1]; bb += data[i + 2]; count += 1;
        };
        for (let x = 0; x < canvas.width; x += 1) { sample(x, 0); sample(x, canvas.height - 1); }
        for (let y = 0; y < canvas.height; y += 1) { sample(0, y); sample(canvas.width - 1, y); }
        br = Math.round(br / count);
        bg = Math.round(bg / count);
        bb = Math.round(bb / count);

        // 软阈值：距离背景色越近越透明，保留主体边缘过渡
        const LOW = 28;
        const HIGH = 64;
        for (let i = 0; i < data.length; i += 4) {
          const dr = data[i] - br;
          const dg = data[i + 1] - bg;
          const db = data[i + 2] - bb;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);
          if (dist <= LOW) {
            data[i + 3] = 0;
          } else if (dist < HIGH) {
            data[i + 3] = Math.round((data[i + 3] * (dist - LOW)) / (HIGH - LOW));
          }
        }
        ctx.putImageData(imageData, 0, 0);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas 兜底抠图输出为空'))), 'image/png');
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('图片解码失败')); };
    img.src = objectUrl;
  });
}

export default function ExportModal({ isOpen, onClose, rawText, title, subtitle }) {
  const [step, setStep] = useState('INIT');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [exportingIndex, setExportingIndex] = useState(null);
  const [aiProgress, setAiProgress] = useState('初始化视觉神经网络...');
  const [palette, setPalette] = useState({ bg: '#f2f0eb', text: '#3d3935' });
  const [closing, setClosing] = useState(false);
  const [imageMeta, setImageMeta] = useState(null); // 主体图自然尺寸，用于导出时精确等比缩放
  
  // 初始化提取的文案，直接填充进 DOM
  const [textData, setTextData] = useState({ title: '产品名称', sub: '产品核心描述文案' });
  
  const fileInputRef = useRef(null);
  const cardRefs = [useRef(null), useRef(null), useRef(null)];

  const cleanText = (() => {
    if (!rawText) return '';
    return rawText.replace(/<del>[\s\S]*?<\/del>/g, '').replace(/<\/?ins>/g, '').trim();
  })();

  // 淡出关闭：先播放 300ms 淡出动画，再真正卸载，避免跳转突兀
  const handleClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => onClose(), 300);
  };

  // 按容器尺寸等比缩放主体图，显式计算 left/top 居中，避免 html2canvas 忽略 object-fit/flex 导致变形
  const fitImage = (cw, ch) => {
    if (!imageMeta || !imageMeta.w || !imageMeta.h) return null;
    const scale = Math.min(cw / imageMeta.w, ch / imageMeta.h);
    const width = Math.round(imageMeta.w * scale);
    const height = Math.round(imageMeta.h * scale);
    return { width, height, left: Math.round((cw - width) / 2), top: Math.round((ch - height) / 2) };
  };

  useEffect(() => {
    if (isOpen) {
      setStep('UPLOAD');
      setClosing(false);

      // 精准提取：优先用 AI 结构化输出的 title/subtitle；没有才从正文启发式兜底（绝不读取用户原始输入）
      const sentences = cleanText.split(/[。！!？?\n|]+/).map(s => s.trim()).filter(Boolean);
      const headline = sentences[0] || '商业精选好物';

      let derivedTitle = title && title.trim() ? title.trim() : '';
      if (!derivedTitle) {
        // 取首句第一个 2-6 字词组作为主标题
        derivedTitle = headline.split(/[,，\s|:：]+/).find(word => word.length >= 2 && word.length <= 6);
        if (!derivedTitle) derivedTitle = headline.replace(/\s/g, '').substring(0, 4) || '旗舰精选';
        if (derivedTitle.includes('文案') || derivedTitle.includes('修改')) derivedTitle = '旗舰精选';
      }

      let derivedSub = subtitle && subtitle.trim() ? subtitle.trim() : '';
      if (!derivedSub) {
        derivedSub = headline.length > 25 ? headline.substring(0, 24) + '...' : headline;
      }

      setTextData({
        title: derivedTitle,
        sub: derivedSub,
      });
    } else {
      setStep('INIT');
      setUploadedImage(null);
      setPalette({ bg: '#f2f0eb', text: '#3d3935' });
      setExportingIndex(null);
    }
  }, [isOpen, cleanText, title, subtitle]);

  const processImage = async (file) => {
    setStep('PROCESSING');

    let processedUrl = null;

    // 第一道保险：WASM AI 抠图（失败则进入本地 Canvas 兜底）
    try {
      setAiProgress('正在通过 AI 神经网络剥离背景...');
      const imageBlob = await Promise.race([
        removeBackground(file, {
          publicPath: IMGLY_PUBLIC_PATH,
          device: 'cpu',
          model: 'isnet_fp16',
          progress: (key, current, total) => {
            if (total) {
              setAiProgress(`正在下载视觉模型 (${Math.round((current / total) * 100)}%)...`);
            }
          },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('AI 抠图超时')), AI_TIMEOUT_MS)),
      ]);
      processedUrl = URL.createObjectURL(imageBlob);
    } catch (error) {
      console.warn('AI 抠图不可用，已启用本地 Canvas 纯色背景过滤:', error);
      setAiProgress('AI 模型不可用，正在用本地像素引擎剥离纯色背景...');
      try {
        const fallbackBlob = await removeSolidBackground(file);
        processedUrl = URL.createObjectURL(fallbackBlob);
      } catch (fallbackError) {
        console.warn('Canvas 兜底也失败，回退原图:', fallbackError);
        processedUrl = URL.createObjectURL(file);
      }
    }

    setUploadedImage(processedUrl);

    setAiProgress('正在解析图像色彩空间与莫兰迪色域...');
    const img = new Image();
    img.src = processedUrl;
    img.onload = () => {
      setImageMeta({ w: img.naturalWidth, h: img.naturalHeight });
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
        const bgR = Math.floor(r * 0.18 + 245 * 0.82);
        const bgG = Math.floor(g * 0.18 + 242 * 0.82);
        const bgB = Math.floor(b * 0.18 + 238 * 0.82);
        const textR = Math.floor(r * 0.35 + 35 * 0.65);
        const textG = Math.floor(g * 0.35 + 35 * 0.65);
        const textB = Math.floor(b * 0.35 + 35 * 0.65);
        setPalette({ bg: `rgb(${bgR}, ${bgG}, ${bgB})`, text: `rgb(${textR}, ${textG}, ${textB})` });
      }
      setStep('DEAL'); 
    };
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
        setTimeout(() => handleClose(), 600);
      }, 300);
    } catch (error) {
      alert('导出失败，请重试');
      setExportingIndex(null);
    }
  };

  if (!isOpen) return null;

  const orientalFit = fitImage(320, 276);
  const wineFit = fitImage(320, 299);
  const magazineFit = fitImage(320, 299);

  return (
    <div className={`abbel-modal-overlay ${closing ? 'closing' : ''}`}>
      <button className="btn-close-global" onClick={handleClose}>[ ESC ] 退出 · ABORT</button>

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
                  <div className="poster-image-wrap oriental-image-wrap"><img src={uploadedImage} alt="media" style={orientalFit} /></div>
                  <div className="oriental-watermark">ABBEL DESIGN</div>
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
                  <div className="poster-image-wrap wine-image-wrap"><img src={uploadedImage} alt="media" style={wineFit} /></div>
                  <div className="wine-watermark">ABBEL DESIGN</div>
                </div>
              </div>

              {/* 卡牌 3 */}
              <div className={`poker-card card-2 ${exportingIndex === 2 ? 'fly-out' : ''} ${exportingIndex !== null && exportingIndex !== 2 ? 'fade-out' : ''}`} onClick={() => handlePlayCard(2)}>
                <div className="poster-canvas tpl-magazine" ref={cardRefs[2]} style={{ '--poster-bg': palette.bg, '--poster-text': palette.text }}>
                  <div className="magazine-top-bar">
                    <span contentEditable suppressContentEditableWarning onClick={e => e.stopPropagation()}>{textData.sub}</span>
                    <span>ABBEL DESIGN</span>
                  </div>
                  <div className="magazine-bg-text">
                    {textData.title.substring(0,6).toUpperCase()}
                  </div>
                  <div className="poster-image-wrap magazine-image-wrap"><img src={uploadedImage} alt="media" style={magazineFit} /></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}