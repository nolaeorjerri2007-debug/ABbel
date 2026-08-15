import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import './ExportModal.css';

export default function ExportModal({ isOpen, onClose, rawText, parameters }) {
  const [activeTab, setActiveTab] = useState('POSTER'); // 'TEXT' | 'POSTER'
  const [aspectRatio, setAspectRatio] = useState('3:4'); // '3:4' | '1:1'
  const [theme, setTheme] = useState('LIGHT'); // 'LIGHT' | 'DARK'
  const [showWatermark, setShowWatermark] = useState(true);
  const [uploadedImage, setUploadedImage] = useState(null);
  
  const fileInputRef = useRef(null);
  const posterRef = useRef(null);

  if (!isOpen) return null;

  // 纯净文本提取逻辑：移除 <del> 内容，保留 <ins> 文本但去掉标签
  const getCleanText = (text) => {
    if (!text) return '';
    return text
      .replace(/<del>[\s\S]*?<\/del>/g, '') // 删除 <del> 及其包裹的内容
      .replace(/<\/?ins>/g, '') // 移除 <ins> 和 </ins> 标签，保留内容
      .trim();
  };

  const cleanText = getCleanText(rawText);

  // 处理图片上传
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setUploadedImage(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  // 生成并下载海报
  const handleDownloadPoster = async () => {
    if (!posterRef.current) return;
    try {
      const canvas = await html2canvas(posterRef.current, {
        scale: 2, // 提高导出图片的清晰度
        useCORS: true,
        backgroundColor: theme === 'LIGHT' ? '#ffffff' : '#111111'
      });
      const link = document.createElement('a');
      link.download = `Abbel_Export_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('海报生成失败', error);
      alert('海报生成失败，请重试');
    }
  };

  // 复制纯文本
  const handleCopyText = () => {
    navigator.clipboard.writeText(cleanText);
    alert('纯文本已复制到剪贴板');
  };

  // 生成水印字符串
  const getWatermarkString = () => {
    if (!parameters) return 'POWERED BY ABBEL ENGINE';
    const paramsList = Object.entries(parameters).map(([key, value]) => {
      const shortKey = key.replace('_density', '').replace('_force', '').toUpperCase();
      const num = Number(value);
      const formatted = Number.isFinite(num) ? num.toFixed(2) : value;
      return `${shortKey}: ${formatted}`;
    });
    return `${paramsList.join(' | ')} | POWERED BY ABBEL ENGINE`;
  };

  return (
    <div className="abbel-modal-overlay">
      <div className="abbel-modal-container">
        
        {/* 左侧：实时预览区 */}
        <div className="abbel-modal-preview">
          {activeTab === 'TEXT' ? (
            <div className="preview-text-only">
              <p>{cleanText}</p>
            </div>
          ) : (
            <div className="poster-workspace">
              {/* 海报实际渲染节点 */}
              <div 
                ref={posterRef}
                className={`poster-canvas ratio-${aspectRatio.replace(':', '-')} theme-${theme.toLowerCase()}`}
              >
                <div className="poster-image-area" onClick={() => !uploadedImage && fileInputRef.current.click()}>
                  {uploadedImage ? (
                    <>
                      <img src={uploadedImage} alt="Uploaded" className="poster-img" />
                      <div className="poster-img-gradient"></div>
                    </>
                  ) : (
                    <div className="poster-placeholder">
                      <span>点击或拖拽上传产品图片</span>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                  />
                </div>
                <div className="poster-text-area">
                  <p className="poster-copy">{cleanText}</p>
                  {showWatermark && (
                    <div className="poster-watermark">
                      {getWatermarkString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 右侧：控制台区 */}
        <div className="abbel-modal-sidebar">
          <div className="sidebar-header">
            <h3>导出控制台</h3>
            <button className="btn-close" onClick={onClose}>关闭</button>
          </div>

          <div className="sidebar-tabs">
            <button 
              className={activeTab === 'TEXT' ? 'tab-active' : ''} 
              onClick={() => setActiveTab('TEXT')}
            >
              文本模式
            </button>
            <button 
              className={activeTab === 'POSTER' ? 'tab-active' : ''} 
              onClick={() => setActiveTab('POSTER')}
            >
              海报模式
            </button>
          </div>

          {activeTab === 'POSTER' && (
            <div className="sidebar-controls">
              <div className="control-group">
                <label>画布比例 (Aspect Ratio)</label>
                <div className="radio-group">
                  <button className={aspectRatio === '3:4' ? 'active' : ''} onClick={() => setAspectRatio('3:4')}>3:4 (社交笔记)</button>
                  <button className={aspectRatio === '1:1' ? 'active' : ''} onClick={() => setAspectRatio('1:1')}>1:1 (商品主图)</button>
                </div>
              </div>

              <div className="control-group">
                <label>美学主题 (Theme)</label>
                <div className="radio-group">
                  <button className={theme === 'LIGHT' ? 'active' : ''} onClick={() => setTheme('LIGHT')}>宣纸白</button>
                  <button className={theme === 'DARK' ? 'active' : ''} onClick={() => setTheme('DARK')}>终端黑</button>
                </div>
              </div>

              <div className="control-group checkbox-group">
                <label>
                  <input 
                    type="checkbox" 
                    checked={showWatermark} 
                    onChange={(e) => setShowWatermark(e.target.checked)}
                  />
                  附加当前仲裁参数水印
                </label>
              </div>

              {uploadedImage && (
                <button className="btn-secondary btn-sm" onClick={() => setUploadedImage(null)}>
                  重新上传图片
                </button>
              )}
            </div>
          )}

          <div className="sidebar-footer">
            {activeTab === 'TEXT' ? (
              <button className="btn-primary btn-block" onClick={handleCopyText}>
                一键复制文本
              </button>
            ) : (
              <button className="btn-primary btn-block" onClick={handleDownloadPoster}>
                保存为高清图片
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}