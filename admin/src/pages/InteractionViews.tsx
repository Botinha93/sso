import Card from '../components/ui/Card'
import { ArrowUpRight, KeyRound, LogIn, MonitorSmartphone, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import React from 'react';

const cards = [
  {
    title: 'Login View',
    description: 'Open the hosted sign-in view used by authorization and admin login flows.',
    href: '/login',
    icon: LogIn,
    note: 'Useful for validating login prompts and federation entry points.'
  },
  {
    title: 'Consent View',
    description: 'Open the consent screen route used during interactive authorization flows.',
    href: '/consent',
    icon: ShieldCheck,
    note: 'Best launched by a real authorization request so client and scope context are present.'
  },
  {
    title: 'Device Verification View',
    description: 'Open the device verification screen where end users approve a device_code request.',
    href: '/oauth/device/verify',
    icon: MonitorSmartphone,
    note: 'Can be used directly by entering a user code or via verification_uri_complete.'
  }
]

export default function InteractionViews() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Authentication"
        title="Interaction Views"
        description="Quick access to the hosted OAuth and OIDC user-facing interaction screens. These views are normally opened by live protocol flows, but can be launched here for manual validation."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="p-5">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-foreground">
                <Icon size={20} />
              </div>
              <h2 className="text-lg font-semibold text-foreground">{card.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
              <p className="mt-3 rounded-xl border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{card.note}</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <code className="truncate text-xs text-muted-foreground">{card.href}</code>
                <a
                  href={card.href}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500"
                >
                  Open
                  <ArrowUpRight size={14} />
                </a>
              </div>
            </Card>
          )
        })}
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 text-foreground">
          <KeyRound size={18} />
          <h2 className="text-base font-semibold">Usage Notes</h2>
        </div>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <p>The consent screen is most meaningful when opened by an authorize request that provides client_id, scope, redirect_uri, response_type, and response_mode.</p>
          <p>The device verification screen is now usable as a standalone page because it accepts a manual user code entry.</p>
          <p>These links are intended for operator validation and troubleshooting, not as the normal application launch path.</p>
        </div>
      </Card>
    </div>
  )
}