import React, { useState } from 'react';
import { useSignIn } from '@clerk/clerk-react';
import { SignUpButton } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo2.0.png'; 
import './Login.css';

export default function Login() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isPwdVisible, setIsPwdVisible] = useState(false);
  const [lcdStatus, setLcdStatus] = useState('locked'); 
  const [lcdText, setLcdText] = useState('WAITING FOR OPERATOR CREDENTIALS');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const getLcdStyle = () => {
    if (lcdStatus === 'error') return { color: 'var(--lcd-text-amber)' };
    if (lcdStatus === 'success') return { color: 'var(--lcd-text-bright)' };
    return { color: 'var(--lcd-text-danger)' };
  };

  // 🚀 彩蛋 1：用户名输入的动态监控
  const handleIdentifierChange = (e) => {
    const val = e.target.value;
    setIdentifier(val);
    setLcdStatus('locked');
    
    if (val.length === 0) {
      setLcdText('WAITING FOR OPERATOR CREDENTIALS');
    } else if (val.includes('@')) {
      setLcdText('EMAIL_FORMAT_DETECTED // VALIDATING...');
    } else {
      setLcdText('DECODING_IDENTITY_MATRIX...');
    }
  };

  // 🚀 彩蛋 2：密码输入的加密注入模拟
  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    setLcdStatus('locked');
    
    if (val.length === 0) {
      setLcdText('AWAITING_SECURITY_KEY...');
    } else if (val.length < 4) {
      setLcdText('INJECTING_ENTROPY...');
    } else if (val.length < 8) {
      setLcdText('HASHING_CREDENTIALS...');
    } else {
      setLcdText('MAXIMUM_ENTROPY_REACHED // READY.');
    }
  };

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!isLoaded || isAuthenticating) return;

    if (!identifier || !password) {
      setLcdStatus('error');
      setLcdText('ERR: CREDENTIALS_MISSING');
      return;
    }

    setIsAuthenticating(true);
    setLcdStatus('locked');
    setLcdText('VERIFYING_WITH_CLERK_SERVER...');

    try {
      const result = await signIn.create({
        identifier,
        password,
      });

      if (result.status === 'complete') {
        setLcdStatus('success');
        setLcdText('AUTH_SUCCESS. WELCOME TO ABBEL.');
        
        setTimeout(async () => {
          await setActive({ session: result.createdSessionId });
          navigate('/');
        }, 1500);
      } else {
        setLcdStatus('error');
        setLcdText('ERR: MULTI_FACTOR_REQUIRED');
        setIsAuthenticating(false);
      }
    } catch (err) {
      setLcdStatus('error');
      setLcdText('ERR: ' + (err.errors?.[0]?.message || 'AUTH_FAILED').toUpperCase());
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="abbel-login-wrapper">
      {/* ✅ 修复 1：删去多余黑体文字，将 Logo 设为 100% 宽度并绝对居中对齐 */}
      <div className="brand-backdrop" style={{ position: 'relative', top: '0', marginBottom: '32px', width: '100%', display: 'flex', justifyContent: 'center' }}>
        <img 
          src={logo} 
          alt="Abbel Logo" 
          style={{ height: '48px', objectFit: 'contain', display: 'block' }} 
        />
      </div>

      <div className="auth-panel">
        <div className="screw"></div><div className="screw"></div>
        <div className="screw"></div><div className="screw"></div>

        <div className="lcd-display">
          <div className="lcd-header">
            <span className="lcd-title">ABBEL-01 / AUTH_MODULE</span>
            <div className="lcd-status" style={getLcdStyle()}>
              <div 
                className="led-pulse" 
                style={{ 
                  background: getLcdStyle().color, 
                  boxShadow: `0 0 6px ${getLcdStyle().color}`,
                  animation: lcdStatus === 'success' ? 'none' : 'pulse 1s infinite'
                }}
              ></div> 
              {lcdStatus === 'error' ? 'SYS_ERR' : (lcdStatus === 'success' ? 'SYS_ONLINE' : 'SYS_LOCKED')}
            </div>
          </div>
          <div className="lcd-body">
            <span className="lcd-dim">{'>'} INITIATING SECURE HANDSHAKE... OK</span><br />
            {/* ✅ 修复 2：这里的文本现在会随着键盘敲击实时变幻彩蛋 */}
            {'>'} {lcdText}<span className="cursor"></span>
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">用户名或邮箱</label>
            <div className="input-wrapper">
              <svg className="input-icon" viewBox="0 0 24 24">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <input 
                type="text" 
                className="form-input" 
                placeholder="请输入用户名或邮箱" 
                value={identifier}
                onChange={handleIdentifierChange}
                onFocus={() => { if(!identifier) setLcdText('AWAITING_INPUT...'); }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">密码</label>
            <div className="input-wrapper">
              <svg className="input-icon" viewBox="0 0 24 24">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input 
                type={isPwdVisible ? "text" : "password"} 
                className="form-input" 
                placeholder="请输入密码" 
                value={password}
                onChange={handlePasswordChange}
                onFocus={() => { if(!password) setLcdText('AWAITING_SECURITY_KEY...'); }}
              />
              <button 
                className="btn-visibility" 
                type="button" 
                onClick={() => setIsPwdVisible(!isPwdVisible)}
              >
                {isPwdVisible ? (
                  <svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          {/* ✅ 修复 3：强制清理该区域所有元素的底层虚线边框 */}
          <div className="auth-actions" style={{ border: 'none' }}>
            <div className="pref-row" style={{ border: 'none' }}>
              <input type="checkbox" id="toggle-remember" className="toggle-checkbox" defaultChecked />
              <label htmlFor="toggle-remember" className="toggle-label"><div className="toggle-thumb"></div></label>
              <div className="pref-info">记住我</div>
            </div>
            
            <a href="#" className="text-link">忘记密码？</a>
          </div>

          <button 
            type="submit" 
            className="btn-exec" 
            disabled={isAuthenticating}
            style={{
               background: lcdStatus === 'success' ? 'var(--lcd-text-dim)' : '',
               pointerEvents: isAuthenticating ? 'none' : 'auto',
               opacity: isAuthenticating ? 0.8 : 1
            }}
          >
            {isAuthenticating ? '终端验证中...' : (lcdStatus === 'success' ? '登入成功' : '登录')}
          </button>
        </form>

        {/* ✅ 修复 3：强制去除此处的顶部虚线 (borderTop: 'none') */}
        <div className="auth-footer" style={{ borderTop: 'none' }}>
          <span className="register-text">还没有帐户？</span>
          <SignUpButton mode="modal" fallbackRedirectUrl="/">
            <span className="register-link" style={{ cursor: 'pointer' }}>立即注册</span>
          </SignUpButton>
        </div>
      </div>

      {/* ✅ 修复 4：更新页面底部说明文本 */}
      <div className="system-footer-text">
        2026 ABBEL / STRICTLY CONFIDENTIAL
      </div>
    </div>
  );
}