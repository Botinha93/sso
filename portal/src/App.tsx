import { Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { usePortalMe, usePortalUpdateProfile } from './hooks'
import { useI18n } from './i18n'
import Launcher from './pages/Launcher'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Users from './pages/Users'
import Suggestions from './pages/Suggestions'

export default function App() {
  const { language } = useI18n()
  const { data: user, isLoading, error } = usePortalMe()
  const { mutateAsync: updateProfile } = usePortalUpdateProfile()
  const inFlightSyncKey = useRef<string | null>(null)
  const lastSyncedKey = useRef<string | null>(null)

  useEffect(() => {
    if (!user) return
    const syncKey = `${user.id}:${language}`

    if (user.customAttributes?.preferredLanguage === language) {
      lastSyncedKey.current = syncKey
      return
    }

    if (lastSyncedKey.current === syncKey) return
    if (inFlightSyncKey.current === syncKey) return

    inFlightSyncKey.current = syncKey

    void updateProfile({
      customAttributes: {
        preferredLanguage: language
      }
    }).then(() => {
      lastSyncedKey.current = syncKey
    }).catch(() => {
      // Keep local selection even if profile sync fails.
    }).finally(() => {
      if (inFlightSyncKey.current === syncKey) {
        inFlightSyncKey.current = null
      }
    })
  }, [language, updateProfile, user])

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

  const canManageUsers =
    Array.isArray(user.permissions) &&
    (user.permissions.includes('*:*') || user.permissions.includes('users:view'))

  return (
    <Routes>
      <Route path="/" element={<Launcher user={user} />} />
      <Route path="/profile" element={<Profile user={user} />} />
      <Route path="/suggestions" element={<Suggestions user={user} />} />
      <Route path="/users" element={canManageUsers ? <Users currentUser={user} /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
