import { Plus, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import Modal from '../components/Modal'

const Users = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: ''
  })
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Identity Directory</p>
          <h2 className="text-2xl font-semibold">User Management</h2>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2"
        >
          <Plus size={16} />
          New User
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h4 className="font-medium">All Users</h4>
          <button className="text-sm text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors">
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        <div className="p-4 text-center text-muted-foreground">
          No users registered
        </div>
      </div>

      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New User">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-2">Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Full Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm"
              placeholder="Secure password"
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
              Create User
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Users
