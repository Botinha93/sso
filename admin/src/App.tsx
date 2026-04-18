import { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Users from './pages/Users'
import Groups from './pages/Groups'
import Roles from './pages/Roles'
import Sessions from './pages/Sessions'
import AuditLog from './pages/AuditLog'
import Consents from './pages/Consents'
import Tenants from './pages/Tenants'
import FederationProviders from './pages/FederationProviders'
import AuthenticationFlows from './pages/AuthenticationFlows'
import UserAttributes from './pages/UserAttributes'
import Policies from './pages/Policies'
import EventHooks from './pages/EventHooks'
import Login from './pages/Login'
import Consent from './pages/Consent'
import Setup from './pages/Setup'
import { useAdminMe, useSetupStatus } from './hooks/useApi'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}

function AppContent() {
  const location = useLocation()
  const { data: setupStatus, isLoading: setupLoading } = useSetupStatus()
  const { data: adminMe, isLoading: meLoading, error: meError } = useAdminMe()

  const permissions: string[] = (adminMe as any)?.permissions ?? []
  const hasPermission = (perm: string) => permissions.includes('*:*') || permissions.includes(perm)

  if (setupLoading) {
    return <div className="h-screen grid place-items-center text-slate-500">Loading setup…</div>
  }

  if ((setupStatus as any)?.requiresSetup) {
    return (
      <Routes>
        <Route path="*" element={<Setup />} />
      </Routes>
    )
  }

  if (meLoading && !location.pathname.startsWith('/login') && !location.pathname.startsWith('/consent')) {
    return <div className="h-screen grid place-items-center text-slate-500">Loading session…</div>
  }

  const require = (perm: string, element: ReactElement) => hasPermission(perm)
    ? element
    : <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">You do not have permission to access this section.</div>

  const isAuthed = !meError && !!adminMe

  return (
    <div className="flex h-screen overflow-hidden">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />
        <Route path="/consent" element={<Consent />} />
        <Route
          path="*"
          element={
            isAuthed ? (
              <div className="flex h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] text-slate-700 font-sans">
                <Sidebar permissions={permissions} />
                <main className="flex-1 overflow-auto p-7">
                  <div className="max-w-7xl mx-auto">
                    <Routes location={location} key={location.pathname}>
                      <Route path="/" element={require('users:view', <Dashboard />)} />
                      <Route path="/dashboard" element={require('users:view', <Dashboard />)} />
                      <Route path="/clients" element={require('clients:view', <Clients />)} />
                      <Route path="/users" element={require('users:view', <Users />)} />
                      <Route path="/groups" element={require('groups:view', <Groups />)} />
                      <Route path="/roles" element={require('roles:view', <Roles />)} />
                      <Route path="/sessions" element={require('sessions:view', <Sessions />)} />
                      <Route path="/audit" element={require('audit_log:view', <AuditLog />)} />
                      <Route path="/consents" element={require('consents:view', <Consents />)} />
                      <Route path="/tenants" element={require('tenants:view', <Tenants />)} />
                      <Route path="/federation" element={require('federation_providers:view', <FederationProviders />)} />
                      <Route path="/authentication" element={require('authentication_flows:view', <AuthenticationFlows />)} />
                      <Route path="/user-attributes" element={require('user_attributes:view', <UserAttributes />)} />
                      <Route path="/policies" element={require('policies:view', <Policies />)} />
                      <Route path="/events" element={require('events:view', <EventHooks />)} />
                    </Routes>
                  </div>
                </main>
              </div>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </div>
  )
}

export default App