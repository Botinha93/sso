import { Plus, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import Modal from '../components/Modal'
import { useClients, useCreateClient } from '../hooks/useApi'

const Clients = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const { data: clients, isLoading, refetch } = useClients()
  const createClient = useCreateClient()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    redirect_uris: ''
  })
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">OAuth Clients</p>
          <h2 className="text-2xl font-semibold">Registered Applications</h2>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2"
        >
          <Plus size={16} />
          New Client
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h4 className="font-medium">All Clients</h4>
          <button className="text-sm text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors">
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        <div id="clients-list" className="p-4 space-y-3">
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium">sso-admin-ui</h5>
                <p className="text-sm text-muted-foreground mt-0.5">Admin Console Client</p>
              </div>
              <div className="flex gap-2">
                <span className="text-xs px-2.5 py-1 rounded-md bg-muted">Confidential</span>
                <span className="text-xs px-2.5 py-1 rounded-md bg-muted">PKCE Required</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create OAuth Client">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-2">Client Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm"
              placeholder="Application name"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm"
              placeholder="Short description"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Redirect URIs</label>
            <textarea
              value={formData.redirect_uris}
              onChange={e => setFormData({ ...formData, redirect_uris: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm min-h-[80px]"
              placeholder="https://app.example.com/callback"
            />
          </div>
          <div className="flex gap-2 justify-end mt-6">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="h-9 px-4 rounded-md text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                createClient.mutate(formData)
                setCreateModalOpen(false)
              }}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium"
            >
              Create Client
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Clients
