import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Workspace from './pages/Workspace'
import TemplateLibrary from './pages/TemplateLibrary'
import Profile from './pages/Profile'
import Settings from './pages/Settings'

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/workspace" element={<Workspace />} />
        <Route path="/templates" element={<TemplateLibrary />} />
        <Route path="/my" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </div>
  )
}

export default App
