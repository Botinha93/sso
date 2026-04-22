// Example: Frontend login + backend OAuth token verification + RBAC route enforcement
//
// Run:
//   BACKEND_OAUTH_CLIENT_ID=backend-api \
//   BACKEND_OAUTH_CLIENT_SECRET=change-me \
//   node examples/fullstack-rbac/backend.js
//
// Open:
//   http://127.0.0.1:3100

import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'

const ISSUER = process.env.SSO_ISSUER ?? 'http://127.0.0.1:4000'
const PORT = Number(process.env.EXAMPLE_BACKEND_PORT ?? 3100)
const OAUTH_CLIENT_ID = process.env.BACKEND_OAUTH_CLIENT_ID ?? ''
const OAUTH_CLIENT_SECRET = process.env.BACKEND_OAUTH_CLIENT_SECRET ?? ''

if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET) {
  console.error('Missing BACKEND_OAUTH_CLIENT_ID/BACKEND_OAUTH_CLIENT_SECRET for introspection calls.')
  process.exit(1)
}

const json = (reply, statusCode, payload) => {
  reply.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  })
  reply.end(JSON.stringify(payload, null, 2))
}

const parseJsonBody = async (req) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  const raw = Buffer.concat(chunks).toString('utf8')
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('Invalid JSON body')
  }
}

const bearerTokenFromRequest = (req) => {
  const auth = req.headers.authorization ?? ''
  if (!auth.toLowerCase().startsWith('bearer ')) return null
  return auth.slice('bearer '.length).trim()
}

const postJson = async (url, payload) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  })

  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text }
  }

  return { ok: res.ok, status: res.status, body }
}

const getJson = async (url, headers = {}) => {
  const res = await fetch(url, { headers })
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text }
  }
  return { ok: res.ok, status: res.status, body }
}

const normalizeListClaim = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).map(String)
  if (typeof value === 'string') return value.split(/[\s,]+/).filter(Boolean)
  return []
}

const resolvePrincipal = async (token) => {
  const introspection = await postJson(`${ISSUER}/oauth/introspect`, {
    token,
    client_id: OAUTH_CLIENT_ID,
    client_secret: OAUTH_CLIENT_SECRET
  })

  if (!introspection.ok || !introspection.body?.active) {
    return { ok: false, reason: 'inactive_token', details: introspection.body }
  }

  const userInfo = await getJson(`${ISSUER}/oauth/userinfo`, {
    authorization: `Bearer ${token}`
  })

  if (!userInfo.ok) {
    return { ok: false, reason: 'userinfo_failed', details: userInfo.body }
  }

  const scopeClaims = normalizeListClaim(introspection.body.scope)
  const roles = normalizeListClaim(userInfo.body.roles)
  const permissions = normalizeListClaim(userInfo.body.permissions)

  return {
    ok: true,
    principal: {
      sub: userInfo.body.sub,
      email: userInfo.body.email,
      username: userInfo.body.preferred_username,
      scope: scopeClaims,
      roles,
      permissions,
      claims: userInfo.body
    }
  }
}

const authorize = (principal, policy) => {
  const missingRoles = (policy.roles ?? []).filter((role) => !principal.roles.includes(role))
  const missingPermissions = (policy.permissions ?? []).filter((perm) => !principal.permissions.includes(perm))

  if (missingRoles.length || missingPermissions.length) {
    return {
      allowed: false,
      missingRoles,
      missingPermissions
    }
  }

  return { allowed: true, missingRoles: [], missingPermissions: [] }
}

const server = http.createServer(async (req, reply) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)

    if (req.method === 'GET' && url.pathname === '/') {
      const html = await readFile(new URL('./frontend.html', import.meta.url), 'utf8')
      reply.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      reply.end(html)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/session/login') {
      const payload = await parseJsonBody(req)
      const login = await postJson(`${ISSUER}/auth/login`, {
        email: payload.email,
        password: payload.password,
        clientId: payload.clientId,
        scope: payload.scope ?? ['openid', 'profile', 'email', 'roles', 'permissions']
      })

      if (!login.ok) {
        json(reply, login.status, {
          error: 'login_failed',
          upstream: login.body
        })
        return
      }

      json(reply, 200, {
        token_type: login.body.token_type,
        access_token: login.body.access_token,
        refresh_token: login.body.refresh_token,
        expires_in: login.body.expires_in
      })
      return
    }

    const protectedPolicies = {
      '/api/me': { roles: [], permissions: [] },
      '/api/admin/reports': { roles: ['admin'], permissions: ['reports:read'] },
      '/api/finance/payouts': { roles: ['finance_admin'], permissions: ['payouts:approve'] }
    }

    if (req.method === 'GET' && Object.hasOwn(protectedPolicies, url.pathname)) {
      const token = bearerTokenFromRequest(req)
      if (!token) {
        json(reply, 401, { error: 'missing_bearer_token' })
        return
      }

      const principalResult = await resolvePrincipal(token)
      if (!principalResult.ok) {
        json(reply, 401, {
          error: principalResult.reason,
          details: principalResult.details
        })
        return
      }

      const principal = principalResult.principal
      const authorization = authorize(principal, protectedPolicies[url.pathname])
      if (!authorization.allowed) {
        json(reply, 403, {
          error: 'forbidden',
          route: url.pathname,
          required: protectedPolicies[url.pathname],
          missingRoles: authorization.missingRoles,
          missingPermissions: authorization.missingPermissions,
          principal: {
            sub: principal.sub,
            roles: principal.roles,
            permissions: principal.permissions
          }
        })
        return
      }

      if (url.pathname === '/api/me') {
        json(reply, 200, {
          message: 'Authenticated principal context',
          principal
        })
        return
      }

      if (url.pathname === '/api/admin/reports') {
        json(reply, 200, {
          message: 'Admin reports route granted.',
          reports: [
            { id: 'rep_001', name: 'Quarterly Access Review', status: 'ready' },
            { id: 'rep_002', name: 'Privileged Elevation Audit', status: 'ready' }
          ],
          principal: {
            sub: principal.sub,
            roles: principal.roles,
            permissions: principal.permissions
          }
        })
        return
      }

      if (url.pathname === '/api/finance/payouts') {
        json(reply, 200, {
          message: 'Finance payout approval route granted.',
          queueSize: 3,
          principal: {
            sub: principal.sub,
            roles: principal.roles,
            permissions: principal.permissions
          }
        })
      }
      return
    }

    json(reply, 404, { error: 'not_found' })
  } catch (error) {
    json(reply, 500, {
      error: 'internal_error',
      message: error instanceof Error ? error.message : String(error)
    })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`RBAC example backend listening on http://127.0.0.1:${PORT}`)
  console.log(`Using issuer: ${ISSUER}`)
})
