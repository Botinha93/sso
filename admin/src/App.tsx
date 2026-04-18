import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Routes, Route, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Users from './pages/Users'
import Roles from './pages/Roles'
import Sessions from './pages/Sessions'
import AuditLog from './pages/AuditLog'
import Consents from './pages/Consents'
import Tenants from './pages/Tenants'

const queryClient = new QueryClient()

function App() {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-7 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/users" element={<Users />} />
              <Route path="/roles" element={<Roles />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/audit" element={<AuditLog />} />
              <Route path="/consents" element={<Consents />} />
              <Route path="/tenants" element={<Tenants />} />
            </Routes>
          </div>
        </main>
      </div>
    </QueryClientProvider>
  )
}

export default App