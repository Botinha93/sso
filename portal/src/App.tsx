import { Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { usePortalMe, usePortalUpdateProfile } from './hooks'
import { type Language, useI18n } from './i18n'
import Launcher from './pages/Launcher'
import Login from './pages/Login'
import Profile from './pages/Profile'

export default function App() {
  const { language, setLanguage } = useI18n()
  const { data: user, isLoading, error } = usePortalMe()
  const { mutateAsync: updateProfile } = usePortalUpdateProfile()
  const lastSyncedLanguage = useRef<string | null>(null)

  useEffect(() => {
    if (!user) return
    const preferred = user.customAttributes?.preferredLanguage
    if (!preferred) return
    if (preferred === language) return

    const supported = new Set<Language>(['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh', 'ko', 'ru'])
    if (supported.has(preferred as Language)) {
      setLanguage(preferred as Language)
    }
  }, [language, setLanguage, user])

  useEffect(() => {
    if (!user) return
    if (user.customAttributes?.preferredLanguage === language) {
      lastSyncedLanguage.current = language
      return
    }
    if (lastSyncedLanguage.current === language) return

    void updateProfile({
      customAttributes: {
        ...user.customAttributes,
        preferredLanguage: language
      }
    }).then(() => {
      lastSyncedLanguage.current = language
    }).catch(() => {
      // Keep local selection even if profile sync fails.
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

  return (
    <Routes>
      <Route path="/" element={<Launcher user={user} />} />
      <Route path="/profile" element={<Profile user={user} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
