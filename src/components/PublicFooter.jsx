import { Link } from 'react-router-dom'

const LINKS = [
  { to: '/pricing', label: 'Pricing' },
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/refunds', label: 'Refunds' },
]

export default function PublicFooter() {
  return (
    <footer className="site-footer">
      <nav className="site-footer-links">
        {LINKS.map((item, i) => (
          <span key={item.to} className="site-footer-item">
            {i > 0 && <span className="site-footer-sep">|</span>}
            <Link to={item.to} className="legal-link">{item.label}</Link>
          </span>
        ))}
      </nav>
      <span className="site-footer-copyright">2026 ABBEL / STRICTLY CONFIDENTIAL</span>
    </footer>
  )
}
