import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logo from '../assets/logo2.0.png'
import PublicFooter from '../components/PublicFooter'
import './Landing.css'

const TARGET_FREQ = 98.7
const FREQ_STEP = 0.05
const LOCK_EPSILON = FREQ_STEP / 2
const TARGET_TEXT = '> ACCESS GRANTED // WELCOME OPERATOR'
const GARBAGE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@!?/<>+=*'

function scramble(ratio) {
  let out = ''
  for (let i = 0; i < TARGET_TEXT.length; i++) {
    const ch = TARGET_TEXT[i]
    if (ch === ' ') { out += ' '; continue }
    out += Math.random() < ratio
      ? GARBAGE[Math.floor(Math.random() * GARBAGE.length)]
      : ch
  }
  return out
}

function Landing() {
  const navigate = useNavigate()
  const freqRef = useRef(88.0)
  const [freq, setFreq] = useState(88.0)
  const [decoded, setDecoded] = useState(() => scramble(1))
  const [locked, setLocked] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (locked) return
    const id = setInterval(() => {
      const dist = Math.abs(freqRef.current - TARGET_FREQ)
      if (dist < LOCK_EPSILON) {
        setLocked(true)
        setDecoded(TARGET_TEXT)
        clearInterval(id)
        return
      }
      const ratio = Math.min(1, dist / 5)
      setDecoded(scramble(ratio))
    }, 40)
    return () => clearInterval(id)
  }, [locked])

  const handleFreq = (e) => {
    const v = Number(e.target.value)
    freqRef.current = v
    setFreq(v)
  }

  const handleEnter = () => {
    setLeaving(true)
    setTimeout(() => navigate('/login'), 620)
  }

  return (
    <div className="landing-page">
      <Link to="/pricing" className="landing-ghost">[ PUBLIC_TARIFFS / 公开定价 ]</Link>

      <div className="landing-scene">
        <img src={logo} alt="Abbel Logo" className="landing-logo" />

        <div className={`landing-console ${leaving ? 'leaving' : ''}`}>
          <div className={`landing-lcd ${locked ? 'locked' : ''}`}>
            <div className="landing-lcd-header">
              <span className="landing-lcd-title">ABBEL-01 / DECRYPT_CHANNEL</span>
              <span className={`landing-lcd-status ${locked ? 'locked' : ''}`}>
                <span className={`landing-led ${locked ? 'locked' : ''}`} />
                {locked ? 'SIGNAL_LOCKED' : 'SCANNING...'}
              </span>
            </div>
            <div className="landing-lcd-body">
              <div className="landing-lcd-dim">&gt; TUNE TO {TARGET_FREQ.toFixed(1)} MHz TO UNLOCK CHANNEL</div>
              <div className={`landing-lcd-text ${locked ? 'locked' : ''}`}>{decoded}</div>
            </div>
          </div>

          <div className="landing-tuner">
            <div className="landing-tuner-meta">
              <span>FREQ {freq.toFixed(2)} MHz</span>
              <span>TARGET {TARGET_FREQ.toFixed(2)} MHz</span>
            </div>
            <input
              type="range"
              className="landing-slider"
              min="87.0"
              max="108.0"
              step={FREQ_STEP}
              value={freq}
              onChange={handleFreq}
            />
          </div>

          {locked && (
            <button className="landing-enter" onClick={handleEnter}>
              进入系统 // ENTER SYSTEM
            </button>
          )}
        </div>
      </div>

      <PublicFooter />
    </div>
  )
}

export default Landing
