import { Alert, Badge, Box, Button, Checkbox, FileInput, Grid, Group, List, Paper, SimpleGrid, Stack, Text, TextInput, Textarea, TagsInput } from '@mantine/core'
import { useMemo, useState } from 'react'
import { CheckCircle2, FileArchive, ShieldAlert, Trash2, UploadCloud, Info } from 'lucide-react'
import { CopyField, PageHeader, SectionCard, TableSkeleton } from '@nexus/design'
import CodeBlock from '../components/CodeBlock'
import EmptyState from '../components/EmptyState'
import {
  type PluginManifestDto,
  useDeletePlugin,
  usePlugins,
  useUploadPlugin,
  useValidatePlugin,
} from '../hooks/useApi'

const splitList = (text: string) => text.split(',').map((value) => value.trim()).filter(Boolean)

const emptyManifest: PluginManifestDto = {
  id: '',
  name: '',
  version: '1.0.0',
  description: '',
  entrypoint: 'dist/index.js',
  permissions: [],
  hooks: [],
  homepage: ''
}

export default function Plugins() {
  const { data, isLoading } = usePlugins()
  const validatePlugin = useValidatePlugin()
  const uploadPlugin = useUploadPlugin()
  const deletePlugin = useDeletePlugin()

  const [manifest, setManifest] = useState<PluginManifestDto>(emptyManifest)
  const [permissionsText, setPermissionsText] = useState('events:emit, users:read')
  const [hooksText, setHooksText] = useState('user.created, auth.login.success')
  const [bundleName, setBundleName] = useState('')
  const [bundleBase64, setBundleBase64] = useState('')
  const [activateAfterUpload, setActivateAfterUpload] = useState(false)
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[]; warnings: string[] } | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const plugins = data?.data ?? []

  const parsedManifest = useMemo(() => {
    return {
      ...manifest,
      permissions: splitList(permissionsText),
      hooks: splitList(hooksText),
      description: manifest.description?.trim() || undefined,
      homepage: manifest.homepage?.trim() || undefined
    }
  }, [hooksText, manifest, permissionsText])

  const manifestPreview = useMemo(() => JSON.stringify(parsedManifest, null, 2), [parsedManifest])

  const readFileAsBase64 = async (file: File): Promise<string> => {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Could not read file'))
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('Could not read file data'))
          return
        }
        resolve(reader.result)
      }
      reader.readAsDataURL(file)
    })
  }

  const onSelectBundle = async (file: File | null) => {
    if (!file) return

    setError('')
    setMessage('')

    const lowerName = file.name.toLowerCase()
    if (!lowerName.endsWith('.zip')) {
      setError('Plugin bundle must be a .zip archive')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Plugin bundle must be 5MB or smaller')
      return
    }

    try {
      const encoded = await readFileAsBase64(file)
      setBundleBase64(encoded)
      setBundleName(file.name)
    } catch (fileError: any) {
      setError(fileError?.message ?? 'Could not read selected file')
    }
  }

  const handleValidate = async () => {
    setError('')
    setMessage('')
    try {
      const result = await validatePlugin.mutateAsync({
        manifest: parsedManifest,
        bundleBase64: bundleBase64 || undefined
      })
      setValidationResult(result)
      if (result.valid) {
        setMessage('Validation passed. You can upload this plugin bundle.')
      }
    } catch (validateError: any) {
      setError(validateError?.message ?? 'Validation failed')
      setValidationResult(null)
    }
  }

  const handleUpload = async () => {
    if (!bundleBase64) {
      setError('Select a plugin ZIP bundle before uploading')
      return
    }

    setError('')
    setMessage('')
    try {
      await uploadPlugin.mutateAsync({
        manifest: parsedManifest,
        bundleBase64,
        activate: activateAfterUpload
      })
      setMessage('Plugin uploaded successfully')
      setValidationResult(null)
      setBundleBase64('')
      setBundleName('')
    } catch (uploadError: any) {
      const details = uploadError?.message ?? 'Upload failed'
      setError(details)
    }
  }

  const handleDelete = async (id: string) => {
    setError('')
    setMessage('')
    try {
      await deletePlugin.mutateAsync(id)
      setMessage(`Plugin ${id} removed`)      
    } catch (deleteError: any) {
      setError(deleteError?.message ?? 'Could not delete plugin')
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Extensibility"
        title="Plugins"
        description="Upload signed plugin bundles and validate manifest contracts before activation."
      />

      <Alert color="blue" variant="light" icon={<Info size={16} />}>
        Active plugins are executed by the runtime for matching declared hooks. Keep permissions and hooks minimal, and validate every bundle before activation.
      </Alert>

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, xl: 7 }}>
          <SectionCard
            title="Upload Plugin Bundle"
            icon={<UploadCloud size={16} />}
            footer={
              <Group justify="flex-end" gap="xs">
                <Button variant="default" onClick={handleValidate} loading={validatePlugin.isPending}>
                  Validate
                </Button>
                <Button onClick={handleUpload} loading={uploadPlugin.isPending}>
                  Upload Plugin
                </Button>
              </Group>
            }
          >
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput label="Plugin ID" ff="monospace" value={manifest.id} onChange={(e) => { const value = e.currentTarget.value; setManifest((prev) => ({ ...prev, id: value })) }} placeholder="acme.audit-enricher" />
                <TextInput label="Version" value={manifest.version} onChange={(e) => { const value = e.currentTarget.value; setManifest((prev) => ({ ...prev, version: value })) }} placeholder="1.0.0" />
                <TextInput label="Name" value={manifest.name} onChange={(e) => { const value = e.currentTarget.value; setManifest((prev) => ({ ...prev, name: value })) }} placeholder="ACME Audit Enricher" />
                <TextInput label="Entrypoint" ff="monospace" value={manifest.entrypoint} onChange={(e) => { const value = e.currentTarget.value; setManifest((prev) => ({ ...prev, entrypoint: value })) }} placeholder="dist/index.js" />
              </SimpleGrid>

              <Textarea
                label="Description"
                autosize
                minRows={3}
                value={manifest.description ?? ''}
                onChange={(e) => { const value = e.currentTarget.value; setManifest((prev) => ({ ...prev, description: value })) }}
              />

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TagsInput
                  label="Permissions"
                  description="Press Enter or comma to add."
                  value={splitList(permissionsText)}
                  onChange={(values) => setPermissionsText(values.join(', '))}
                  acceptValueOnBlur
                  placeholder="events:emit, users:read"
                />
                <TagsInput
                  label="Hooks"
                  description="Press Enter or comma to add."
                  value={splitList(hooksText)}
                  onChange={(values) => setHooksText(values.join(', '))}
                  acceptValueOnBlur
                  placeholder="user.created, auth.login.success"
                />
              </SimpleGrid>

              <TextInput label="Homepage (optional)" type="url" value={manifest.homepage ?? ''} onChange={(e) => { const value = e.currentTarget.value; setManifest((prev) => ({ ...prev, homepage: value })) }} placeholder="https://plugins.example.com/acme-audit-enricher" />

              <FileInput
                label="Bundle ZIP (max 5MB)"
                description={bundleName ? `Selected: ${bundleName}` : 'No file selected'}
                inputWrapperOrder={['label', 'input', 'description', 'error']}
                accept=".zip,application/zip"
                placeholder="Choose a .zip bundle"
                leftSection={<FileArchive size={16} />}
                onChange={onSelectBundle}
                clearable={false}
              />

              <Checkbox
                checked={activateAfterUpload}
                onChange={(e) => setActivateAfterUpload(e.currentTarget.checked)}
                label="Mark plugin as active after upload"
              />

              {error ? <Alert color="red" variant="light">{error}</Alert> : null}
              {message ? <Alert color="green" variant="light">{message}</Alert> : null}
            </Stack>
          </SectionCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xl: 5 }}>
          <SectionCard title="Validation Results" icon={<CheckCircle2 size={16} />} h="100%">
            <Stack gap="md">
              <Box>
                <Text size="xs" fw={600} tt="uppercase" c="dimmed">Manifest Preview</Text>
                <CodeBlock code={manifestPreview} language="json" mt="xs" />
              </Box>

              {!validationResult ? (
                <Text size="sm" c="dimmed">Run validation to review manifest and bundle checks.</Text>
              ) : (
                <Stack gap="sm">
                  <Alert color={validationResult.valid ? 'green' : 'red'} variant="light">
                    {validationResult.valid ? 'Validation passed' : 'Validation failed'}
                  </Alert>

                  {validationResult.errors.length > 0 ? (
                    <Box>
                      <Text size="xs" fw={600} tt="uppercase" c="red">Errors</Text>
                      <List size="sm" c="red" mt={4} spacing={4}>
                        {validationResult.errors.map((item) => <List.Item key={item}>{item}</List.Item>)}
                      </List>
                    </Box>
                  ) : null}

                  {validationResult.warnings.length > 0 ? (
                    <Box>
                      <Text size="xs" fw={600} tt="uppercase" c="yellow.7">Warnings</Text>
                      <List size="sm" c="yellow.7" mt={4} spacing={4}>
                        {validationResult.warnings.map((item) => <List.Item key={item}>{item}</List.Item>)}
                      </List>
                    </Box>
                  ) : null}
                </Stack>
              )}

              <Alert color="yellow" variant="light" icon={<ShieldAlert size={16} />}>
                <Text size="xs">
                  Plugin execution should stay behind a feature flag and security review gate. Keep hooks and permissions minimal.
                </Text>
              </Alert>
            </Stack>
          </SectionCard>
        </Grid.Col>
      </Grid>

      <SectionCard title="Uploaded Plugins" icon={<FileArchive size={16} />}>
        {isLoading ? (
          <TableSkeleton rows={3} withHeader={false} columns={['text', 'mono', 'action']} />
        ) : plugins.length === 0 ? (
          <EmptyState
            icon={FileArchive}
            title="No plugin bundles uploaded yet"
            description="Upload a plugin bundle to extend platform functionality."
          />
        ) : (
          <Stack gap="sm">
            {plugins.map((plugin) => (
              <Paper key={plugin.id} withBorder radius="md" p="sm" bg="var(--nx-color-surface-sunken)">
                <Group justify="space-between" align="flex-start" gap="sm">
                  <Stack gap={4} miw={0} flex={1}>
                    <Group gap="xs">
                      <Text size="sm" fw={600}>{plugin.name}</Text>
                      <Text size="xs" ff="monospace" c="dimmed">{plugin.id}</Text>
                      <Badge size="sm" variant="light" color={plugin.status === 'active' ? 'green' : 'gray'}>{plugin.status}</Badge>
                    </Group>
                    <Text size="xs" c="dimmed">Version {plugin.version} • {plugin.status} • {Math.ceil(plugin.bundleBytes / 1024)} KB</Text>
                    <Group gap={6} wrap="nowrap" miw={0}>
                      <Text size="xs" c="dimmed">SHA-256:</Text>
                      <CopyField variant="inline" value={plugin.bundleChecksum} copyLabel="Copy checksum" miw={0} />
                    </Group>
                    <Text size="xs" c="dimmed">Hooks: {plugin.hooks.join(', ') || 'none'} | Permissions: {plugin.permissions.join(', ') || 'none'}</Text>
                  </Stack>
                  <Button
                    color="red"
                    variant="light"
                    size="xs"
                    leftSection={<Trash2 size={14} />}
                    onClick={() => handleDelete(plugin.id)}
                    disabled={deletePlugin.isPending}
                  >
                    Remove
                  </Button>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </SectionCard>
    </>
  )
}
