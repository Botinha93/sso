const Dashboard = () => {
  return (
    <div>
      <div className="mb-10">
        <p className="text-xs font-extrabold uppercase tracking-widest text-primary mb-2">Operational Surface</p>
        <h2 className="text-5xl font-extrabold leading-[0.96] tracking-tight">
          Run the whole identity layer from one screen.
        </h2>
        <p className="text-muted-foreground text-lg mt-4 max-w-2xl leading-relaxed">
          Users, roles, tenants, clients, and token flows stay live in a file-backed store designed for local concurrency.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-5 rounded-2xl bg-card border border-border/60">
          <span className="text-muted-foreground text-sm">Users</span>
          <strong className="block text-3xl font-extrabold tracking-tight mt-2">0</strong>
        </div>
        <div className="p-5 rounded-2xl bg-card border border-border/60">
          <span className="text-muted-foreground text-sm">Roles</span>
          <strong className="block text-3xl font-extrabold tracking-tight mt-2">0</strong>
        </div>
        <div className="p-5 rounded-2xl bg-card border border-border/60">
          <span className="text-muted-foreground text-sm">Tenants</span>
          <strong className="block text-3xl font-extrabold tracking-tight mt-2">0</strong>
        </div>
        <div className="p-5 rounded-2xl bg-card border border-border/60">
          <span className="text-muted-foreground text-sm">Clients</span>
          <strong className="block text-3xl font-extrabold tracking-tight mt-2">0</strong>
        </div>
      </div>
    </div>
  )
}

export default Dashboard