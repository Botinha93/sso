import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { CheckCircle2, FileArchive, ShieldAlert, Trash2, UploadCloud } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import Button from '../components/ui/Button'
import CodeBlock from '../components/ui/CodeBlock'
import Input from '../components/ui/Input'
import {
  type PluginManifestDto,
  useDeletePlugin,
  usePlugins,
  useUploadPlugin,
  useValidatePlugin,
} from '../hooks/useApi'

const fieldCls = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'

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
      permissions: permissionsText.split(',').map((value) => value.trim()).filter(Boolean),
      hooks: hooksText.split(',').map((value) => value.trim()).filter(Boolean),
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

  const onSelectBundle = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Extensibility"
        title="Plugins"
        description="Upload signed plugin bundles and validate manifest contracts before activation."
      />

      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        Active plugins are executed by the runtime for matching declared hooks. Keep permissions and hooks minimal, and validate every bundle before activation.
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <UploadCloud size={16} className="text-slate-500" />
            <h3 className="text-base font-semibold text-slate-900">Upload Plugin Bundle</h3>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Plugin ID</label>
              <Input value={manifest.id} onChange={(e) => setManifest((prev) => ({ ...prev, id: e.target.value }))} placeholder="acme.audit-enricher" />
            </div>
            <div>
              <label className={labelCls}>Version</label>
              <Input value={manifest.version} onChange={(e) => setManifest((prev) => ({ ...prev, version: e.target.value }))} placeholder="1.0.0" />
            </div>
            <div>
              <label className={labelCls}>Name</label>
              <Input value={manifest.name} onChange={(e) => setManifest((prev) => ({ ...prev, name: e.target.value }))} placeholder="ACME Audit Enricher" />
            </div>
            <div>
              <label className={labelCls}>Entrypoint</label>
              <Input value={manifest.entrypoint} onChange={(e) => setManifest((prev) => ({ ...prev, entrypoint: e.target.value }))} placeholder="dist/index.js" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={manifest.description ?? ''}
              onChange={(e) => setManifest((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Permissions (comma separated)</label>
              <Input value={permissionsText} onChange={(e) => setPermissionsText(e.target.value)} placeholder="events:emit, users:read" />
            </div>
            <div>
              <label className={labelCls}>Hooks (comma separated)</label>
              <Input value={hooksText} onChange={(e) => setHooksText(e.target.value)} placeholder="user.created, auth.login.success" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Homepage (optional)</label>
            <Input value={manifest.homepage ?? ''} onChange={(e) => setManifest((prev) => ({ ...prev, homepage: e.target.value }))} placeholder="https://plugins.example.com/acme-audit-enricher" />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <label className={labelCls}>Bundle ZIP (max 5MB)</label>
            <input type="file" accept=".zip,application/zip" onChange={onSelectBundle} className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-sky-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-sky-500" />
            <p className="mt-2 text-xs text-slate-500">{bundleName ? `Selected: ${bundleName}` : 'No file selected'}</p>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={activateAfterUpload} onChange={(e) => setActivateAfterUpload(e.target.checked)} className="rounded border-slate-300" />
            Mark plugin as active after upload
          </label>

          {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
          {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={handleValidate}
              disabled={validatePlugin.isPending}
            >
              {validatePlugin.isPending ? 'Validating...' : 'Validate'}
            </Button>
            <Button
              variant="primary"
              onClick={handleUpload}
              disabled={uploadPlugin.isPending}
            >
              {uploadPlugin.isPending ? 'Uploading...' : 'Upload Plugin'}
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-slate-500" />
            <h3 className="text-base font-semibold text-slate-900">Validation Results</h3>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Manifest Preview</p>
            <CodeBlock code={manifestPreview} language="json" className="mt-2" />
          </div>

          {!validationResult ? (
            <p className="text-sm text-slate-500">Run validation to review manifest and bundle checks.</p>
          ) : (
            <div className="space-y-3">
              <p className={`rounded-lg px-3 py-2 text-sm ${validationResult.valid ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-rose-200 bg-rose-50 text-rose-700'}`}>
                {validationResult.valid ? 'Validation passed' : 'Validation failed'}
              </p>

              {validationResult.errors.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">Errors</p>
                  <ul className="mt-1 space-y-1 text-sm text-rose-700">
                    {validationResult.errors.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
              ) : null}

              {validationResult.warnings.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Warnings</p>
                  <ul className="mt-1 space-y-1 text-sm text-amber-700">
                    {validationResult.warnings.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <div className="flex items-start gap-2">
              <ShieldAlert size={14} className="mt-0.5" />
              <p>
                Plugin execution should stay behind a feature flag and security review gate. Keep hooks and permissions minimal.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <FileArchive size={16} className="text-slate-500" />
          <h3 className="text-base font-semibold text-slate-900">Uploaded Plugins</h3>
        </div>

        {isLoading ? (
          <TableSkeleton rows={3} />
        ) : plugins.length === 0 ? (
          <EmptyState
            title="No plugin bundles uploaded yet"
            description="Upload a plugin bundle to extend platform functionality."
          />
        ) : (
          <div className="space-y-3">
            {plugins.map((plugin) => (
              <div key={plugin.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{plugin.name} <span className="font-mono text-xs text-slate-500">{plugin.id}</span></p>
                    <p className="mt-0.5 text-xs text-slate-600">Version {plugin.version} • {plugin.status} • {Math.ceil(plugin.bundleBytes / 1024)} KB</p>
                    <p className="mt-1 text-xs text-slate-500 break-all">SHA-256: {plugin.bundleChecksum}</p>
                    <p className="mt-1 text-xs text-slate-500">Hooks: {plugin.hooks.join(', ') || 'none'} | Permissions: {plugin.permissions.join(', ') || 'none'}</p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(plugin.id)}
                    disabled={deletePlugin.isPending}
                  >
                    <Trash2 size={13} /> Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
