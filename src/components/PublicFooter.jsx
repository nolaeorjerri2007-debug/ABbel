import { Link } from 'react-router-dom'

const LINKS = [
  { to: '/pricing', label: '定价' },
  { to: '/terms', label: '服务条款' },
  { to: '/privacy', label: '隐私政策' },
  { to: '/refunds', label: '退款政策' },
]

export default function PublicFooter() {
  return (
    <div className="public-footer">
      {LINKS.map((item, i) => (
        <span key={item.to}>
          <Link to={item.to} className="legal-link">{item.label}</Link>
          {i < LINKS.length - 1 && <span className="public-footer-sep">|</span>}
        </span>
      ))}
    </div>
  )
}
