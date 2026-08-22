import { useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react'
import Home from './pages/Home'
import Workspace from './pages/Workspace'
import TemplateLibrary from './pages/TemplateLibrary'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import Refunds from './pages/Refunds'
import Pricing from './pages/Pricing'
import { useAuthedSupabase } from './lib/supabase'
import { syncMyProfile } from './lib/data'
import { migrateLegacyTemplates } from './lib/migration'
import { QuotaProvider } from './lib/quota-context'
import CheckoutModal from './components/CheckoutModal'

// 登录后把 Clerk 档案同步进 users 表（只写 email/display_name，plan 不动）
function ProfileSync() {
  const { user, isLoaded } = useUser()
  const { ready } = useAuthedSupabase()

  useEffect(() => {
    if (!ready || !isLoaded || !user) return
    syncMyProfile({
      email: user.primaryEmailAddress?.emailAddress || '',
      display_name: user.fullName || user.username || '',
    }).catch((e) => console.error('档案同步失败', e))
  }, [ready, isLoaded, user])

  return null
}

// 首次登录自动同步：把遗留 localStorage 模板静默迁移到云端（同名去重 + 填空槽）
function LegacyMigration() {
  const { user, isLoaded } = useUser()
  const { ready } = useAuthedSupabase()
  const ranRef = useRef(false)
  const [toast, setToast] = useState(null) // { msg, type }

  useEffect(() => {
    if (!ready || !isLoaded || !user || ranRef.current) return
    ranRef.current = true
    migrateLegacyTemplates()
      .then(({ migrated, overflow }) => {
        if (overflow > 0) {
          setToast({ msg: '部分本地模板因云端槽位已满未迁移，已在本地暂存备份。', type: 'error' })
        } else if (migrated > 0) {
          setToast({ msg: `已自动同步 ${migrated} 个本地模板到云端。`, type: 'success' })
        }
      })
      .catch((e) => {
        console.error('遗留模板迁移失败', e)
        setToast({ msg: '云端连接超时，本地模板已保留，稍后自动重试。', type: 'error' })
      })
  }, [ready, isLoaded, user])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  if (!toast) return null
  return (
    <div style={{
      position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(30, 30, 30, 0.85)', backdropFilter: 'blur(8px)',
      border: `1px solid ${toast.type === 'success' ? 'rgba(102,255,136,0.4)' : 'rgba(255,100,100,0.4)'}`,
      borderRadius: '6px', padding: '8px 16px', color: toast.type === 'success' ? '#66FF88' : '#ff6b6b',
      fontSize: '13px', fontWeight: '500', zIndex: 10001, display: 'flex', alignItems: 'center', gap: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)', animation: 'fadeIn 0.2s ease-out'
    }}>
      <span style={{ display: 'inline-block', width: '6px', height: '6px', background: toast.type === 'success' ? '#66FF88' : '#ff6b6b', borderRadius: '50%' }}></span>
      {toast.msg}
    </div>
  )
}

function App() {
  return (
    <div className="App">
      <Routes>
        {/* 登录页保持公开访问[cite: 4] */}
        <Route path="/login" element={<Login />} />

        {/* 法律页面公开访问（Paddle 支付合规审核要求） */}
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/refunds" element={<Refunds />} />

        {/* 定价页公开访问，未登录用户也可查看收费标准 */}
        <Route path="/pricing" element={<Pricing />} />

        {/* 核心业务路由：通过 Clerk 守卫保护，未登录则自动重定向至登录页[cite: 4] */}
        <Route
          path="/*"
          element={
            <>
              <SignedIn>
                <ProfileSync />
                <LegacyMigration />
                <QuotaProvider>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/workspace" element={<Workspace />} />
                    <Route path="/templates" element={<TemplateLibrary />} />
                    <Route path="/my" element={<Profile />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                  <CheckoutModal />
                </QuotaProvider>
              </SignedIn>
              <SignedOut>
                <Navigate to="/login" replace />
              </SignedOut>
            </>
          }
        />
      </Routes>
    </div>
  )
}

export default App