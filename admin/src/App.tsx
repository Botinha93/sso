import { ReactElement, useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
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
import Apps from './pages/Apps'
import FederationProviders from './pages/FederationProviders'
import AuthenticationFlows from './pages/AuthenticationFlows'
import Devices from './pages/Devices'
import InteractionViews from './pages/InteractionViews'
import UiCustomizations from './pages/UiCustomizations'
import UserAttributes from './pages/UserAttributes'
import Policies from './pages/Policies'
import EventHooks from './pages/EventHooks'
import Administration from './pages/Administration'
import AccessGovernance from './pages/AccessGovernance'
import Elevations from './pages/Elevations'
import ElevationSessions from './pages/ElevationSessions'
import ServiceIdentities from './pages/ServiceIdentities'
import Connectors from './pages/Connectors'
import Plugins from './pages/Plugins'
import ConnectorDetail from './pages/ConnectorDetail'
import Metrics from './pages/Metrics'
import Documentation from './pages/Documentation'
import Login from './pages/Login'
import Consent from './pages/Consent'
import DeviceVerification from './pages/DeviceVerification'
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { data: setupStatus, isLoading: setupLoading } = useSetupStatus()
  const { data: adminMe, isLoading: meLoading, error: meError } = useAdminMe()

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

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

  if (
    meLoading &&
    !location.pathname.startsWith('/login') &&
    !location.pathname.startsWith('/consent') &&
    !location.pathname.startsWith('/oauth/device/verify')
  ) {
    return <div className="h-screen grid place-items-center text-slate-500">Loading session…</div>
  }

  const require = (perm: string, element: ReactElement) => hasPermission(perm)
    ? element
    : <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">You do not have permission to access this section.</div>

  const isAuthed = !meError && !!adminMe

  return (
    <div className="flex h-screen overflow-hidden">
      <Routes location={location}>
        <Route path="/login" element={<Login />} />
        <Route path="/consent" element={<Consent />} />
        <Route path="/oauth/device/verify" element={<DeviceVerification />} />
        <Route
          path="*"
          element={
            isAuthed ? (
              <div className="flex min-h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] text-slate-700 font-sans">
                <div className="hidden md:flex">
                  <Sidebar permissions={permissions} />
                </div>

                <div className={`fixed inset-0 z-40 md:hidden ${mobileNavOpen ? '' : 'pointer-events-none'}`}>
                  <button
                    type="button"
                    aria-label="Close navigation menu"
                    onClick={() => setMobileNavOpen(false)}
                    className={`absolute inset-0 bg-slate-900/45 transition-opacity ${mobileNavOpen ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <div className={`relative h-full w-[88%] max-w-[320px] transition-transform ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <Sidebar permissions={permissions} onNavigate={() => setMobileNavOpen(false)} />
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                  <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur md:hidden">
                    <button
                      type="button"
                      aria-label="Open navigation menu"
                      onClick={() => setMobileNavOpen(true)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700"
                    >
                      <Menu size={18} />
                    </button>
                    <p className="text-sm font-semibold text-slate-900">NexusID Admin</p>
                    <div className="h-9 w-9" />
                  </header>

                <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-5 lg:p-7">
                  <div className="mx-auto max-w-7xl">
                    <Routes location={location}>
                      <Route path="/" element={require('users:view', <Dashboard />)} />
                      <Route path="/dashboard" element={require('users:view', <Dashboard />)} />
                      <Route path="/clients" element={require('clients:view', <Clients />)} />
                      <Route path="/users" element={require('users:view', <Users />)} />
                      <Route path="/groups" element={require('groups:view', <Groups />)} />
                      <Route path="/roles" element={require('roles:view', <Roles />)} />
                      <Route path="/sessions" element={require('sessions:view', <Sessions />)} />
                      <Route path="/devices" element={require('sessions:view', <Devices />)} />
                      <Route path="/audit" element={require('audit_log:view', <AuditLog />)} />
                      <Route path="/consents" element={require('consents:view', <Consents />)} />
                      <Route path="/tenants" element={require('tenants:view', <Tenants />)} />
                      <Route path="/apps" element={require('apps:view', <Apps />)} />
                      <Route path="/federation" element={require('federation_providers:view', <FederationProviders />)} />
                      <Route path="/authentication" element={require('authentication_flows:view', <AuthenticationFlows />)} />
                      <Route path="/interaction-views" element={require('authentication_flows:view', <InteractionViews />)} />
                      <Route path="/experience-customization" element={require('administration:view', <UiCustomizations />)} />
                      <Route path="/user-attributes" element={require('user_attributes:view', <UserAttributes />)} />
                      <Route path="/policies" element={require('policies:view', <Policies />)} />
                      <Route path="/access-governance" element={require('administration:view', <AccessGovernance />)} />
                      <Route path="/elevations" element={require('administration:view', <Elevations />)} />
                      <Route path="/elevation-sessions" element={require('administration:view', <ElevationSessions />)} />
                      <Route path="/events" element={require('events:view', <EventHooks />)} />
                      <Route path="/administration" element={require('administration:view', <Administration />)} />
                      <Route path="/service-identities" element={require('service_identities:view', <ServiceIdentities />)} />
                      <Route path="/connectors" element={require('connectors:view', <Connectors />)} />
                      <Route path="/plugins" element={require('administration:view', <Plugins />)} />
                      <Route path="/connectors/:id" element={require('connectors:view', <ConnectorDetail />)} />
                      <Route path="/metrics" element={require('connectors:view', <Metrics />)} />
                      <Route path="/documentation" element={require('users:view', <Documentation />)} />
                    </Routes>
                  </div>
                </main>
                </div>
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
