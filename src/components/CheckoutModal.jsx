import { PACKAGES } from '../lib/plans'
import { useQuota } from '../lib/quota-context'

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 10000,
  background: 'rgba(20, 18, 16, 0.55)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: 'checkoutFadeIn 0.25s ease-out',
}

const panelStyle = {
  width: '640px',
  maxWidth: '92vw',
  maxHeight: '88vh',
  overflowY: 'auto',
  background: 'var(--glass-panel)',
  border: '1px solid var(--glass-border)',
  borderRadius: '12px',
  boxShadow: 'var(--shadow-panel)',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  backdropFilter: 'var(--blur-intensity)',
  WebkitBackdropFilter: 'var(--blur-intensity)',
}

export default function CheckoutModal() {
  const {
    upgradeOpen,
    highlightId,
    successCredits,
    checkoutError,
    closeUpgrade,
    purchase,
    dismissSuccess,
  } = useQuota()

  if (!upgradeOpen && successCredits === null) return null

  return (
    <>
      <style>{`
        @keyframes checkoutFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes checkoutPop { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
      `}</style>

      {upgradeOpen && (
        <div style={overlayStyle} onClick={closeUpgrade}>
          <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="nameplate" style={{ width: 'auto', borderBottom: 'none', paddingBottom: 0 }}>[ UPGRADE / 补充算力 ]</span>
              <button className="btn-tool" style={{ padding: '4px 10px', fontSize: '14px' }} onClick={closeUpgrade}>×</button>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>算力已耗尽，选择一个点数包继续创作</div>

            {checkoutError && (
              <div style={{ fontSize: '12px', color: 'var(--color-accent-primary)', background: 'var(--color-accent-ghost)', padding: '8px 12px', borderRadius: '6px' }}>
                {checkoutError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {PACKAGES.map((pkg) => {
                const highlighted = highlightId === pkg.id
                return (
                  <div key={pkg.id} style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    background: pkg.isPopular ? 'rgba(209, 62, 20, 0.06)' : 'var(--glass-module)',
                    border: `1px solid ${pkg.isPopular || highlighted ? 'var(--color-accent-primary)' : 'rgba(255,255,255,0.4)'}`,
                    borderRadius: '10px',
                    padding: '16px',
                    boxShadow: 'var(--shadow-emboss)',
                  }}>
                    {pkg.isPopular && (
                      <span style={{ position: 'absolute', top: '-8px', left: '12px', background: 'var(--color-accent-primary)', color: 'white', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>推荐</span>
                    )}
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-title)' }}>{pkg.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 900, color: 'var(--color-accent-primary)' }}>
                      {pkg.credits}<span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}> 次</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      {pkg.price}{pkg.period ? '/月' : ''}
                    </div>
                    <button className="btn-primary" style={{ width: '100%', padding: '8px', fontSize: '13px' }} onClick={() => purchase(pkg.id)}>
                      立即购买
                    </button>
                  </div>
                )
              })}
            </div>

            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', opacity: 0.7 }}>
              * 支付由 Lemon Squeezy 收银台原地完成，无需跳转；支付成功自动到账。
            </div>
          </div>
        </div>
      )}

      {successCredits !== null && (
        <div style={overlayStyle}>
          <div style={{ ...panelStyle, width: '360px', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--lcd-text-bright)', color: 'var(--lcd-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 900, boxShadow: '0 0 24px rgba(102,255,136,0.5)', animation: 'checkoutPop 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>✓</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--color-text-title)' }}>支付成功</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>已到账 {successCredits} 次算力，额度已自动刷新</div>
            <button className="btn-primary" style={{ marginTop: '8px' }} onClick={dismissSuccess}>继续创作</button>
          </div>
        </div>
      )}
    </>
  )
}
