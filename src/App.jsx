import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react'
import Home from './pages/Home'
import Workspace from './pages/Workspace'
import TemplateLibrary from './pages/TemplateLibrary'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Login from './pages/Login'
import { useAuthedSupabase } from './lib/supabase'
import { syncMyProfile } from './lib/data'

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

function App() {
  return (
    <div className="App">
      <Routes>
        {/* 登录页保持公开访问[cite: 4] */}
        <Route path="/login" element={<Login />} />

        {/* 核心业务路由：通过 Clerk 守卫保护，未登录则自动重定向至登录页[cite: 4] */}
        <Route
          path="/*"
          element={
            <>
              <SignedIn>
                <ProfileSync />
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/workspace" element={<Workspace />} />
                  <Route path="/templates" element={<TemplateLibrary />} />
                  <Route path="/my" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
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