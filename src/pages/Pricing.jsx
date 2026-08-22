import { Link } from 'react-router-dom'
import { PACKAGES } from '../lib/plans'
import PublicFooter from '../components/PublicFooter'

function Pricing() {
  return (
    <div className="pricing-page">
      <div className="pricing-content">
        <h1 className="pricing-title">定价方案</h1>
        <p className="pricing-subtitle">Pricing</p>

        <div className="pricing-grid">
          {PACKAGES.map((pkg) => (
            <div key={pkg.id} className={`pricing-card ${pkg.isPopular ? 'popular' : ''}`}>
              {pkg.isPopular && <span className="pricing-badge">推荐</span>}
              <div className="pricing-name">{pkg.name}</div>
              <div className="pricing-credits">{pkg.credits}<span> 次</span></div>
              <div className="pricing-price">{pkg.price}{pkg.period ? '/月' : ''}</div>
            </div>
          ))}
        </div>

        <p className="pricing-note">* 支付由 Paddle 收银台原地完成，支付成功自动到账。</p>

        <div style={{ textAlign: 'center', marginTop: '28px' }}>
          <Link
            to="/login"
            className="btn-primary"
            style={{ display: 'inline-block', textDecoration: 'none', padding: '12px 40px' }}
          >
            登录后购买
          </Link>
        </div>

        <PublicFooter />
      </div>
    </div>
  )
}

export default Pricing
