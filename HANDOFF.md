# Handoff: Frontend Visual-Improvement Pass (admin + portal)

Plan file: `~/.claude/plans/we-need-to-do-fuzzy-deer.md` (full context/rationale there).

## Goal
Foundation-first visual consistency pass across `admin/` (30-page internal console) and `portal/` (5-page consumer app). Light theme only, no dark mode work. Not a full rewrite — fix tokens + primitives, prove the pattern on a vertical slice, leave the rest as a documented recipe.

## Done so far

**Phase 0 (tokens/cleanup):**
- Deleted dead `admin/tailwind.config.js` (unused v3 config, never loaded under Tailwind v4).
- Copied admin's shadcn-style token block (`--background/--primary/--card/--destructive/--border/--ring`/radius scale) into `portal/src/index.css` — both apps now share the same token names/values.
- Fixed `admin/src/App.tsx` gradient background to reference `--semantic-bg-page` instead of duplicating it as a literal arbitrary-value class.

**Phase 1 (core + new primitives, both apps unless noted):**
- Rewrote `components/ui/{Button,Card,Input}.tsx` in both apps to use token classes (`bg-primary`, `text-foreground`, `border-border`, etc.) instead of hardcoded slate/rose.
- Fixed `admin/src/components/ui/StatusBadge.tsx` tone table (rose=danger, emerald=success, sky=info/accent — collapsed `accent` into sky since indigo was being retired).
- **Important fix**: `admin/src/lib/utils.ts`'s `cn()` imported `clsx`/`tailwind-merge`, but **neither package is installed anywhere in the repo** (not in package.json, not in node_modules) — the file was simply dead/unused before. Rewrote `cn()` as a dependency-free implementation. Mirrored it at `portal/src/lib/utils.ts` (new file).
- New primitives built (unwired beyond what Phase 2 touched):
  - `admin/src/components/ui/Table.tsx` — `Table`, `TableHeaderRow`, `TableBody`, `TableRow` (selected state), `TableCell`. Div-based (not literal `<table>`), matches the existing hand-rolled `divide-y` list-row pattern used everywhere in admin.
  - `admin/src/components/ui/Select.tsx` + `portal/src/components/ui/Select.tsx` — styled native `<select>` wrapper.
  - `portal/src/components/ui/Tabs.tsx` — `Tabs`/`TabList`/`TabTrigger`/`TabPanel` (context-based, controlled `value`/`onValueChange`).
  - `admin/src/components/ui/Alert.tsx` + `portal/src/components/ui/Alert.tsx` — `tone` prop (info/success/warning/danger), replaces ad hoc colored `<p>` banners.

**Phase 2 (vertical slice restyled):**
- Portal: `Login.tsx`, `Launcher.tsx`, `Profile.tsx` fully converted to tokens + new primitives (Alert, Tabs). **Fixed a real pre-existing bug**: Login's submit button never had `variant="primary"` — it faked a dark background via inline `style` while using the (dark) `secondary` text color, giving dark-on-dark low-contrast text. Now uses `variant="primary"` properly.
- Admin: `Dashboard.tsx` (mechanical token swap: `rounded-xl border border-slate-200 bg-white p-5 shadow-sm` → `bg-card`/`border-border`, slate-9/500/400/600/700/800 → foreground/muted-foreground, one `bg-red-50 text-red-600` → rose for the Risk Events stat). Left the hand-rolled inline SVG `LineChart`/`HorizontalBars` alone (data-viz, explicitly out of scope). `Users.tsx` and `Groups.tsx`: swapped their hand-rolled `Card` + `divide-y` list markup for the new `Table`/`TableHeaderRow`/`TableBody`/`TableRow` primitives, plus a few `red-*`→`rose-*` hover-state fixes on row action buttons. **Scope was deliberately narrow**: only the outer list/table wrapper + a handful of text-color classes were touched in these two files — the create/edit **Modals** inside both files still use the old local `fieldCls`/raw `<select>` pattern untouched (that's Phase 3 territory).

All of the above builds clean (`npm run build:admin`, `npm run build:portal` both pass with no errors as of last check).

## Verified (Playwright, headless, against the real dev stack)
- Confirmed `npm run dev` boots fine (API :4000 off the existing `data/sso.sqlite`, admin Vite :5174 since :5173 was occupied, portal Vite :5200).
- Portal Login and admin Login render correctly with the new tokens: focus rings, borders, error banners all look right. Admin login's `variant="primary"` button confirmed correct white-on-dark contrast.
- **Could NOT verify past the login screen** — the `.env` default admin credentials (`admin` / `change-me-now`) no longer match whatever's in the existing `data/sso.sqlite` (password was presumably changed in an earlier session). This blocked verifying Launcher, Profile, Dashboard, Users, and Groups visually/interactively.
- Playwright gotcha for whoever continues this: **`input[type="text"]` CSS attribute selectors will NOT match inputs that don't have an explicit `type` attribute in the JSX** (React's implicit default is `type="text"` at the DOM property level, but no `type` attribute is rendered, so `[type="text"]` selectors fail silently/time out). Use `input:not([type="password"])` instead.

## What's missing / next steps

1. **Unblock authenticated verification.** Either reset the admin password directly in `data/sso.sqlite` (it's better-sqlite3 + scrypt hashing per the README) or find/set a known-good credential, then actually drive Launcher → Profile (all 4 tabs incl. TOTP enrollment UI) → admin Dashboard → Users (create/edit/delete/bulk actions) → Groups (same) in a real browser. This was the single biggest gap — Phase 2's admin changes (Table adoption in Users/Groups, Dashboard token swap) have only been **build-verified**, not **visually/interactively verified**.
2. **Groups.tsx TableRow layout risk**: I overrode `TableRow`'s default `flex` layout for Groups' row (its content has its own nested flex div, unlike Users.tsx which is naturally flex-per-row) by adding `className="block"` to `TableRow` and `w-full` to the inner div as a defensive belt-and-suspenders fix. This was **never visually confirmed** — screenshot the Groups list specifically to make sure rows render full-width and aligned correctly, since my lightweight `cn()` doesn't dedupe conflicting `flex`/`block` Tailwind classes (no tailwind-merge), so the actual winning `display` rule depends on Tailwind's internal stylesheet order, not className order. If it looks broken, the fix is straightforward: remove reliance on the override and instead pass explicit non-flex classes, or restructure the row's JSX to not need it.
3. **Phase 3 (documented, not started)**: apply the same recipe to the remaining ~24 admin CRUD pages (ServiceIdentities, Clients, Roles, Policies, Administration, FederationProviders, AuthenticationFlows, InteractionViews, UiCustomizations, AuditLog, Sessions, Devices, Consents, Tenants, EventHooks, Metrics, ConnectorDetail, Connectors, Plugins, UserAttributes, AccessGovernance, Elevations/ElevationSessions, Setup/Consent/DeviceVerification). Recipe per page: swap hand-rolled `<table>`-like divs for `Table`/`TableHeaderRow`/`TableBody`/`TableRow`, swap ad hoc badge colors for the consolidated `StatusBadge` tones, swap raw `<select>`/local `fieldCls` for the new `Select`/`Input`, swap literal `rounded-xl border border-slate-200 bg-white` card divs for `Card`. `Documentation.tsx` (5304 lines, static docs) should probably be skipped entirely — separate concern.
4. **Users.tsx and Groups.tsx modals** (create/edit forms) still use the old local `fieldCls`/raw `<select>` — not migrated to `Input`/`Select` primitives yet. Same for every other page's forms. This is the largest remaining chunk of "Phase 3" work.
5. **Dev server is currently running in the background** (`nohup npm run dev`, log at `/tmp/claude-1000/-home-botinha-dev-sso/b0d970a2-3709-4ee8-9538-38716c50c8b8/scratchpad/dev-server.log`) — that scratchpad directory is session-specific and will likely be gone; just re-run `npm run dev` fresh.
6. **Explicitly out of scope for this whole effort** (per user's plan decisions): dark mode (both apps — admin's `.dark` CSS block stays inert/untouched), Checkbox/Radio/Switch/Tooltip/Dropdown-Menu primitives, admin Sidebar IA restructuring, Dashboard's SVG chart.

## Quick verification commands
```
npm run build:admin   # vite build, should be clean
npm run build:portal  # vite build, should be clean
npm run dev            # boots API:4000, admin:5173/5174, portal:5200
```
No admin/portal-specific `tsconfig.json`/typecheck script exists independently of the root — rely on `vite build` catching type errors, plus manual review.
