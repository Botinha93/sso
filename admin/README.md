# Northstar SSO Admin Console

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