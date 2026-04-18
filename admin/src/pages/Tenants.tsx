import { Plus, RefreshCw, Building2 } from 'lucide-react'
import { useState } from 'react'
import Modal from '../components/Modal'

const Tenants = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Multi-Tenancy</p>
          <h2 className="text-2xl font-semibold">Organizations</h2>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2"
        >
          <Plus size={16} />
          New Tenant
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h4 className="font-medium">All Tenants</h4>
          <button className="text-sm text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors">
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <Building2 size={16} />
                </div>
                <div>
                  <h5 className="font-medium">default</h5>
                  <p className="text-sm text-muted-foreground mt-0.5">System Default Tenant</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="text-xs px-2.5 py-1 rounded-md bg-muted">System Tenant</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New Tenant">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-2">Tenant Name</label>
            <input
              type="text"
              className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm"
              placeholder="Organization name"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Identifier Slug</label>
            <input
              type="text"
              className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm"
              placeholder="tenant-slug"
            />
          </div>
          <div className="flex gap-2 justify-end mt-6">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="h-9 px-4 rounded-md text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium">
              Create Tenant
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Tenants