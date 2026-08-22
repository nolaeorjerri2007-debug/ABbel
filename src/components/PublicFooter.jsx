import { Link } from 'react-router-dom'

const LINKS = [
  { to: '/pricing', label: 'Pricing' },
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/refunds', label: 'Refunds' },
]

export default function PublicFooter() {
  return (
    <div className="public-footer-links">
      {LINKS.map((item, i) => (
        <span key={item.to} className="public-footer-item">
          {i > 0 && <span className="public-footer-sep">|</span>}
          <Link to={item.to} className="legal-link">{item.label}</Link>
        </span>
      ))}
    </div>
  )
}
