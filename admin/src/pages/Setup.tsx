import { useState } from 'react'
import { Alert, Button, Group, Image, NativeSelect, PasswordInput, Stack, Text, TextInput } from '@mantine/core'
import { AuthCard, AuthLayout, ColorSchemeToggle } from '@nexus/design'
import { AlertCircle, Settings2 } from 'lucide-react'
import { useInitializeSetup } from '../hooks/useApi'
import React from 'react';

function AuthBrand() {
  return (
    <Group gap={10}>
      <Image src="/logo.svg" alt="NexusID" w={32} h={32} radius="md" fit="contain" />
      <Text fw={600} fz="lg">
        NexusID
      </Text>
    </Group>
  )
}

const Setup = () => {
  const [databaseProvider, setDatabaseProvider] = useState<'sqlite' | 'postgresql' | 'mysql'>('sqlite')
  const [databasePath, setDatabasePath] = useState('./data/sso.sqlite')
  const [externalDatabaseUrl, setExternalDatabaseUrl] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const initializeSetup = useInitializeSetup()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Admin name is required')
      return
    }
    if (!email.trim()) {
      setError('Admin email is required')
      return
    }
    if (!username.trim()) {
      setError('Admin username is required')
      return
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(username.trim())) {
      setError('Username may only contain letters, numbers, _, ., and -')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (databaseProvider === 'sqlite' && !databasePath.trim()) {
      setError('SQLite database path is required')
      return
    }
    if (databaseProvider !== 'sqlite' && !externalDatabaseUrl.trim()) {
      setError('External database URL is required for PostgreSQL/MySQL')
      return
    }

    await initializeSetup.mutateAsync({
      name: name.trim(),
      email: email.trim(),
      username: username.trim(),
      password,
      databaseProvider,
      databasePath: databaseProvider === 'sqlite' ? databasePath.trim() : undefined,
      externalDatabaseUrl: databaseProvider !== 'sqlite' ? externalDatabaseUrl.trim() : undefined
    }, {
      onSuccess: (result: any) => {
        const next = result?.email ? `/login?identifier=${encodeURIComponent(result.email)}` : '/login'
        window.location.href = next
      },
      onError: (err: any) => {
        setError(err?.message ?? 'Failed to initialize setup')
      }
    })
  }

  return (
    <AuthLayout
      contentWidth={440}
      brand={<AuthBrand />}
      topRight={<ColorSchemeToggle size="md" variant="default" />}
    >
      <AuthCard
        icon={<Settings2 size={22} />}
        title="First-run Setup"
        subtitle="Create the initial administrator account with your own username and email."
      >
        <form onSubmit={onSubmit}>
          <Stack gap="sm">
            {error && (
              <Alert color="red" icon={<AlertCircle size={16} />} role="alert">
                {error}
              </Alert>
            )}

            <NativeSelect
              label="Database Provider"
              value={databaseProvider}
              onChange={e => setDatabaseProvider(e.target.value as 'sqlite' | 'postgresql' | 'mysql')}
              data={[
                { value: 'sqlite', label: 'SQLite' },
                { value: 'postgresql', label: 'PostgreSQL' },
                { value: 'mysql', label: 'MySQL' }
              ]}
            />

            {databaseProvider === 'sqlite' ? (
              <TextInput
                label="SQLite Database Path"
                type="text"
                value={databasePath}
                onChange={e => setDatabasePath(e.target.value)}
                placeholder="./data/sso.sqlite"
                ff="monospace"
              />
            ) : (
              <TextInput
                label="External Database URL"
                type="text"
                value={externalDatabaseUrl}
                onChange={e => setExternalDatabaseUrl(e.target.value)}
                placeholder={databaseProvider === 'postgresql' ? 'postgresql://user:pass@host:5432/sso' : 'mysql://user:pass@host:3306/sso'}
                ff="monospace"
              />
            )}

            <TextInput
              label="Administrator Name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Platform Administrator"
              autoFocus
            />

            <TextInput
              label="Administrator Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@yourcompany.com"
            />

            <TextInput
              label="Administrator Username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="admin"
            />

            <PasswordInput
              label="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />

            <PasswordInput
              label="Confirm Password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />

            <Button
              type="submit"
              fullWidth
              mt="xs"
              disabled={initializeSetup.isPending}
              loading={initializeSetup.isPending}
            >
              {initializeSetup.isPending ? 'Initializing…' : 'Initialize Installation'}
            </Button>
          </Stack>
        </form>
      </AuthCard>
    </AuthLayout>
  )
}

export default Setup
