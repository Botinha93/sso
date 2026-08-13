import { ReactElement, Suspense, lazy, useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './components/Sidebar'
import ChangePasswordModal from './components/ChangePasswordModal'
import { useAdminMe, useSetupStatus } from './hooks/useApi'
import { useI18n } from './i18n'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Clients = lazy(() => import('./pages/Clients'))
const Users = lazy(() => import('./pages/Users'))
const Groups = lazy(() => import('./pages/Groups'))
const Roles = lazy(() => import('./pages/Roles'))
const Sessions = lazy(() => import('./pages/Sessions'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const Consents = lazy(() => import('./pages/Consents'))
const Tenants = lazy(() => import('./pages/Tenants'))
const Apps = lazy(() => import('./pages/Apps'))
const FederationProviders = lazy(() => import('./pages/FederationProviders'))
const AuthenticationFlows = lazy(() => import('./pages/AuthenticationFlows'))
const Devices = lazy(() => import('./pages/Devices'))
const InteractionViews = lazy(() => import('./pages/InteractionViews'))
const UiCustomizations = lazy(() => import('./pages/UiCustomizations'))
const UserAttributes = lazy(() => import('./pages/UserAttributes'))
const Policies = lazy(() => import('./pages/Policies'))
const EventHooks = lazy(() => import('./pages/EventHooks'))
const Administration = lazy(() => import('./pages/Administration'))
const AccessGovernance = lazy(() => import('./pages/AccessGovernance'))
const Elevations = lazy(() => import('./pages/Elevations'))
const ElevationSessions = lazy(() => import('./pages/ElevationSessions'))
const ServiceIdentities = lazy(() => import('./pages/ServiceIdentities'))
const Connectors = lazy(() => import('./pages/Connectors'))
const Plugins = lazy(() => import('./pages/Plugins'))
const ConnectorDetail = lazy(() => import('./pages/ConnectorDetail'))
const Metrics = lazy(() => import('./pages/Metrics'))
const Documentation = lazy(() => import('./pages/Documentation'))
const Login = lazy(() => import('./pages/Login'))
const Consent = lazy(() => import('./pages/Consent'))
const PasswordExpiration = lazy(() => import('./pages/PasswordExpiration'))
const DeviceVerification = lazy(() => import('./pages/DeviceVerification'))
const Setup = lazy(() => import('./pages/Setup'))

const queryClient = new QueryClient()

function FullScreenLoader({ label }: { label: string }) {
  return <div className="h-screen grid place-items-center text-slate-500">{label}</div>
}

function SectionLoader() {
  return <div className="h-[50vh] grid place-items-center text-slate-500">Loading page…</div>
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}

function AppContent() {
  const location = useLocation()
  const { t } = useI18n()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [passwordExpirationWarning, setPasswordExpirationWarning] = useState<string | null>(null)
  const [warningDismissed, setWarningDismissed] = useState(() => sessionStorage.getItem('passwordExpirationWarningDismissed') === '1')
  const { data: setupStatus, isLoading: setupLoading } = useSetupStatus()
  const { data: adminMe, isLoading: meLoading, error: meError } = useAdminMe()

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const fromMe = (adminMe as { passwordExpirationWarning?: { message?: string } } | undefined)?.passwordExpirationWarning?.message
    const fromLogin = sessionStorage.getItem('passwordExpirationWarning')
    setPasswordExpirationWarning(fromMe || fromLogin || null)
  }, [adminMe])

  const permissions: string[] = (adminMe as any)?.permissions ?? []
  const hasPermission = (perm: string) => permissions.includes('*:*') || permissions.includes(perm)

  if (setupLoading) {
    return <FullScreenLoader label="Loading setup…" />
  }

  if ((setupStatus as any)?.requiresSetup) {
    return (
      <Suspense fallback={<FullScreenLoader label="Loading setup…" />}>
        <Routes>
          <Route path="*" element={<Setup />} />
        </Routes>
      </Suspense>
    )
  }

  if (
    meLoading &&
    !location.pathname.startsWith('/login') &&
    !location.pathname.startsWith('/consent') &&
    !location.pathname.startsWith('/password-expiration') &&
    !location.pathname.startsWith('/oauth/device/verify')
  ) {
    return <FullScreenLoader label="Loading session…" />
  }

  const require = (perm: string, element: ReactElement) => hasPermission(perm)
    ? element
    : <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">You do not have permission to access this section.</div>

  const isAuthed = !meError && !!adminMe

  return (
    <div className="flex h-screen overflow-hidden">
      <Suspense fallback={<FullScreenLoader label="Loading page…" />}>
      <Routes location={location}>
        <Route path="/login" element={<Login />} />
        <Route path="/consent" element={<Consent />} />
        <Route path="/password-expiration" element={<PasswordExpiration />} />
        <Route path="/oauth/device/verify" element={<DeviceVerification />} />
        <Route
          path="*"
          element={
            isAuthed ? (
              <div className="flex min-h-screen w-full overflow-hidden bg-[image:var(--semantic-bg-page)] text-slate-700 font-sans">
                <div className="hidden md:flex">
                  <Sidebar permissions={permissions} onChangePassword={() => setChangePasswordOpen(true)} />
                </div>

                <div className={`fixed inset-0 z-40 md:hidden ${mobileNavOpen ? '' : 'pointer-events-none'}`}>
                  <button
                    type="button"
                    aria-label="Close navigation menu"
                    onClick={() => setMobileNavOpen(false)}
                    className={`absolute inset-0 bg-slate-900/45 transition-opacity ${mobileNavOpen ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <div className={`relative h-full w-[88%] max-w-[320px] transition-transform ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <Sidebar permissions={permissions} onNavigate={() => setMobileNavOpen(false)} onChangePassword={() => setChangePasswordOpen(true)} />
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex h-12 items-center border-b border-slate-200/60 px-4 md:hidden">
                    <button
                      type="button"
                      aria-label="Open navigation menu"
                      onClick={() => setMobileNavOpen(true)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700"
                    >
                      <Menu size={18} />
                    </button>
                    <p className="ml-3 text-sm font-semibold text-slate-900">NexusID Admin</p>
                  </div>

                <main className="admin-shell-main min-w-0 flex-1 overflow-auto">
                  <div className="admin-shell-content admin-page-stack">
                    {passwordExpirationWarning && !warningDismissed ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <span>{passwordExpirationWarning}</span>
                        <div className="flex shrink-0 items-center gap-3">
                          <button
                            type="button"
                            className="font-medium text-amber-900 underline"
                            onClick={() => setChangePasswordOpen(true)}
                          >
                            {t('password.change')}
                          </button>
                          <button
                            type="button"
                            className="text-amber-800 underline"
                            onClick={() => {
                              sessionStorage.removeItem('passwordExpirationWarning')
                              sessionStorage.setItem('passwordExpirationWarningDismissed', '1')
                              setWarningDismissed(true)
                              setPasswordExpirationWarning(null)
                            }}
                          >
                            {t('password.dismiss')}
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <Suspense fallback={<SectionLoader />}>
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
                    </Suspense>
                  </div>
                </main>
                </div>
                <ChangePasswordModal isOpen={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
              </div>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
      </Suspense>
    </div>
  )
}

export default App
