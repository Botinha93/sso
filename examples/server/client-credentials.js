// Example: Client Credentials Grant
// Usage:
// node examples/server/client-credentials.js <clientId> <clientSecret>

const [clientId, clientSecret] = process.argv.slice(2)
if (!clientId || !clientSecret) {
  console.error('Usage: node examples/server/client-credentials.js <clientId> <clientSecret>')
  process.exit(1)
}

const issuer = process.env.SSO_ISSUER ?? 'http://127.0.0.1:4000'

const run = async () => {
  const res = await fetch(`${issuer}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'openid profile'
    })
  })

  const payload = await res.json()
  console.log('status:', res.status)
  console.log(JSON.stringify(payload, null, 2))
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
