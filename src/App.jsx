import { Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import Home from './pages/Home'
import Workspace from './pages/Workspace'
import TemplateLibrary from './pages/TemplateLibrary'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Login from './pages/Login'

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