# NexusID Admin Console

Modern React admin interface for the SSO identity platform.

## ✅ Feature Complete Status

| Feature | Status |
|---------|--------|
| ✅ Client management | Complete |
| ✅ User directory | Complete |
| ✅ Roles & permissions | Complete |
| ✅ Active session inspection | Complete |
| ✅ System audit log | Complete |
| ✅ Consent management | Complete |
| ✅ Multi-tenant management | Complete |
| ✅ Modal dialog system | Complete |
| ✅ Data fetching layer | Complete |
| ✅ Backend API integration | Complete |
| ✅ Policy decision simulator | Complete |

## 🚀 Commands

```bash
# Development server
npm run dev:admin

# Production build
npm run build:admin
```

## 🎨 Design System

100% aligned with Git-client design system:
- Neutral slate color palette
- Geist Sans / JetBrains Mono fonts
- 10px base radius system
- Standard spacing scale
- Full dark mode support

## 🏗 Architecture

```
admin/
├── src/
│   ├── pages/          # All admin views
│   ├── components/     # Reusable components
│   ├── hooks/          # Data fetching hooks
│   ├── lib/            # Utilities
│   ├── types/          # TypeScript definitions
│   ├── App.tsx         # Routing root
│   ├── main.tsx        # Entry point
│   └── index.css       # Global styles
├── vite.config.ts      # Build configuration
└── postcss.config.js   # PostCSS + Tailwind
```

## 🔗 Backend Integration

All API requests are proxied to `http://localhost:4000/api/admin`

Available hooks:
- `useClients()`
- `useCreateClient()`
- `useDeleteClient()`
- `useUsers()`
- `useSessions()`
- `useAuditLog()`
- `usePolicies()`
- `useSetPolicyAssignment()`
- `useEvaluatePolicyDecision()`
- `usePolicyDecisions()`
- `useAuthorizationCheck()`

## Policy Simulator (ABAC Preparation)

The Policies page includes a Decision Simulator to run dry-run authorization checks before live enforcement.

Policy categories:

- `authentication`: stage-based policy enforcement in login/recovery flows
- `authorization`: resource/action/context decisions (no stage bindings)

What it does:

- Uses `POST /api/admin/policies/evaluate`
- Supports `POST /api/admin/authorization/check` for dedicated authorization checks
- Reads history from `GET /api/admin/policies/decisions`
- Evaluates policies with no stage bindings (authorization-style simulation)
- Returns an aggregate allow/deny plus per-policy decision details

Simulator input fields:

- `userId`: subject user to evaluate
- `resource`: resource identifier (`finance:invoice:123`)
- `action`: operation (`read`, `write`, `delete`, etc.)
- `decisionStrategy`: evaluator mode (`deny_overrides`, `allow_overrides`, `first_applicable`)
- `tenantId` (optional)
- `clientId` (optional)
- `ip` (optional)
- `context` (optional JSON object)

Advanced assignment tuning for authorization policies:

- Assignment `config.effect`: `deny` (default) or `allow`
- Assignment `config.priority`: integer priority (higher runs first)
- Assignment `config.resourcePattern`: wildcard matcher for resources (example: `finance:*`)
- Assignment `config.actionPattern`: wildcard matcher for actions (example: `write` or `admin:*`)

Decision strategy behavior summary:

- `deny_overrides`: any applied deny wins
- `allow_overrides`: any applied allow wins
- `first_applicable`: first applied decision in priority order wins

Policy script context available in simulator mode:

- `policy.request.resource`
- `policy.request.action`
- `policy.request.context`
- `policy.request.tenantId`
- `policy.request.clientId`
- `policy.request.ip`