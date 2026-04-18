import { Navigate, Route, Routes } from 'react-router-dom'
import { usePortalMe } from './hooks'
import Launcher from './pages/Launcher'
import Login from './pages/Login'
import Profile from './pages/Profile'

export default function App() {
  const { data: user, isLoading, error } = usePortalMe()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    )
  }

  // Not authenticated — show login
  if (error || !user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Launcher user={user} />} />
      <Route path="/profile" element={<Profile user={user} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
