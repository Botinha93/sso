import { ArrowLeft, ImagePlus, Lightbulb, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useRef, useState, type FormEvent } from 'react'
import type { PortalUser } from '../hooks'
import {
  logout,
  usePortalCreateSuggestion,
  usePortalSuggestions,
  usePortalUploadSuggestionImage,
} from '../hooks'
import LanguageSelector from '../components/LanguageSelector'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import { useI18n } from '../i18n'

interface Props {
  user: PortalUser
}

const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5'
const portalHome = import.meta.env.BASE_URL

export default function Suggestions({ user }: Props) {
  const { t } = useI18n()
  const { data: items = [], isLoading } = usePortalSuggestions()
  const createSuggestion = usePortalCreateSuggestion()
  const uploadImage = usePortalUploadSuggestionImage()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [kind, setKind] = useState<'existing_app' | 'new_system'>('existing_app')
  const [appId, setAppId] = useState(user.apps[0]?.id ?? '')
  const [proposedName, setProposedName] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleLogout = async () => {
    await logout()
    window.location.href = portalHome
  }

  const appendMarkdownImage = (url: string) => {
    setBody((current) => `${current}${current && !current.endsWith('\n') ? '\n' : ''}![](${url})\n`)
    setImageUrls((current) => current.includes(url) ? current : [...current, url])
  }

  const handleUpload = async (file: File) => {
    setError('')
    try {
      const result = await uploadImage.mutateAsync(file)
      if (result.url) {
        appendMarkdownImage(result.url)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('suggestions.errors.uploadFailed'))
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess(false)

    if (!title.trim() || !body.trim()) {
      setError(t('suggestions.errors.required'))
      return
    }
    if (kind === 'existing_app' && !appId) {
      setError(t('suggestions.errors.required'))
      return
    }

    try {
      await createSuggestion.mutateAsync({
        kind,
        appId: kind === 'existing_app' ? appId : undefined,
        proposedName: kind === 'new_system' ? proposedName : undefined,
        title: title.trim(),
        body: body.trim(),
        imageUrls
      })
      setTitle('')
      setBody('')
      setProposedName('')
      setImageUrls([])
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('suggestions.errors.submitFailed'))
    }
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={15} />
            {t('suggestions.backToApps')}
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSelector className="hidden sm:inline-flex" />
            <Button onClick={handleLogout} variant="ghost" size="sm">
              {t('common.signOut')}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Lightbulb size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{t('suggestions.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('suggestions.subtitle')}</p>
          </div>
        </div>

        <Card className="p-5">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setKind('existing_app')}
                className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                  kind === 'existing_app' ? 'border-ring bg-muted' : 'border-border hover:border-ring'
                }`}
              >
                <p className="font-semibold text-foreground">{t('suggestions.kind.existingApp')}</p>
              </button>
              <button
                type="button"
                onClick={() => setKind('new_system')}
                className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                  kind === 'new_system' ? 'border-ring bg-muted' : 'border-border hover:border-ring'
                }`}
              >
                <p className="font-semibold text-foreground">{t('suggestions.kind.newSystem')}</p>
              </button>
            </div>

            {kind === 'existing_app' ? (
              <div>
                <label className={labelCls}>{t('suggestions.app')}</label>
                {user.apps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('suggestions.noApps')}</p>
                ) : (
                  <Select value={appId} onChange={(event) => setAppId(event.target.value)}>
                    <option value="">{t('suggestions.selectApp')}</option>
                    {user.apps.map((app) => (
                      <option key={app.id} value={app.id}>{app.name}</option>
                    ))}
                  </Select>
                )}
              </div>
            ) : (
              <div>
                <label className={labelCls}>{t('suggestions.proposedName')}</label>
                <Input
                  value={proposedName}
                  onChange={(event) => setProposedName(event.target.value)}
                  placeholder={t('suggestions.proposedNamePlaceholder')}
                />
              </div>
            )}

            <div>
              <label className={labelCls}>{t('suggestions.titleField')}</label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('suggestions.titlePlaceholder')}
              />
            </div>

            <div>
              <label className={labelCls}>{t('suggestions.body')}</label>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={t('suggestions.bodyPlaceholder')}
                className="min-h-32 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>

            {imageUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {imageUrls.map((url) => (
                  <img key={url} src={url} alt="" className="h-16 w-16 rounded-lg object-cover border border-border" />
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void handleUpload(file)
              }}
            />

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-emerald-700">{t('suggestions.submitted')}</p>}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadImage.isPending}
              >
                {uploadImage.isPending ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                {t('suggestions.addImage')}
              </Button>
              <Button type="submit" disabled={createSuggestion.isPending || (kind === 'existing_app' && user.apps.length === 0)}>
                {createSuggestion.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                {createSuggestion.isPending ? t('suggestions.submitting') : t('suggestions.submit')}
              </Button>
            </div>
          </form>
        </Card>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {t('suggestions.mySuggestions')}
          </h2>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-muted-foreground" size={20} />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('suggestions.empty')}</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.kind === 'existing_app'
                          ? (item.appName ?? t('suggestions.app'))
                          : (item.proposedName || t('suggestions.newSystemLabel'))}
                      </p>
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-wide rounded-full bg-slate-100 text-slate-700 px-2 py-0.5">
                      {t(`suggestions.status.${item.status}`)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap line-clamp-4">{item.body}</p>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
