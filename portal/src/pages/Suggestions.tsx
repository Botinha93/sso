import { Alert, Badge, Box, Button, Group, Image, Loader, NativeSelect, Paper, SegmentedControl, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { CardSkeleton, PageHeader, SectionCard, SectionHeader } from '@nexus/design'
import { ImagePlus, Lightbulb } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import type { PortalUser } from '../hooks'
import {
  usePortalCreateSuggestion,
  usePortalSuggestions,
  usePortalUploadSuggestionImage,
} from '../hooks'
import PortalShell from '../components/PortalShell'
import { useI18n } from '../i18n'

interface Props {
  user: PortalUser
}


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
    <PortalShell user={user}>
      <PageHeader
        mb={0}
        icon={<Lightbulb size={20} />}
        iconColor="yellow"
        title={t('suggestions.title')}
        description={t('suggestions.subtitle')}
      />

      <SectionCard>
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <SegmentedControl
              fullWidth
              value={kind}
              onChange={(value) => setKind(value as 'existing_app' | 'new_system')}
              data={[
                { value: 'existing_app', label: t('suggestions.kind.existingApp') },
                { value: 'new_system', label: t('suggestions.kind.newSystem') },
              ]}
            />

            {kind === 'existing_app' ? (
              user.apps.length === 0 ? (
                <Stack gap={4}>
                  <Text size="sm" fw={500}>{t('suggestions.app')}</Text>
                  <Text size="sm" c="dimmed">{t('suggestions.noApps')}</Text>
                </Stack>
              ) : (
                <NativeSelect
                  label={t('suggestions.app')}
                  value={appId}
                  onChange={(event) => setAppId(event.currentTarget.value)}
                  data={[
                    { value: '', label: t('suggestions.selectApp') },
                    ...user.apps.map((app) => ({ value: app.id, label: app.name })),
                  ]}
                />
              )
            ) : (
              <TextInput
                label={t('suggestions.proposedName')}
                value={proposedName}
                onChange={(event) => setProposedName(event.currentTarget.value)}
                placeholder={t('suggestions.proposedNamePlaceholder')}
              />
            )}

            <TextInput
              label={t('suggestions.titleField')}
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
              placeholder={t('suggestions.titlePlaceholder')}
            />

            <Textarea
              label={t('suggestions.body')}
              value={body}
              onChange={(event) => setBody(event.currentTarget.value)}
              placeholder={t('suggestions.bodyPlaceholder')}
              autosize
              minRows={5}
            />

            {imageUrls.length > 0 && (
              <Group gap="xs">
                {imageUrls.map((url) => (
                  <Image
                    key={url}
                    src={url}
                    alt=""
                    w={64}
                    h={64}
                    radius="md"
                    fit="cover"
                    style={{ border: '1px solid var(--nx-color-border)' }}
                  />
                ))}
              </Group>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void handleUpload(file)
              }}
            />

            {error && <Alert color="red">{error}</Alert>}
            {success && <Alert color="green">{t('suggestions.submitted')}</Alert>}

            <Group gap="xs" justify="flex-end">
              <Button
                type="button"
                variant="default"
                onClick={() => fileInputRef.current?.click()}
                loading={uploadImage.isPending}
                leftSection={<ImagePlus size={16} />}
              >
                {t('suggestions.addImage')}
              </Button>
              <Button
                type="submit"
                disabled={createSuggestion.isPending || (kind === 'existing_app' && user.apps.length === 0)}
                leftSection={createSuggestion.isPending ? <Loader size={14} color="currentColor" /> : null}
              >
                {createSuggestion.isPending ? t('suggestions.submitting') : t('suggestions.submit')}
              </Button>
            </Group>
          </Stack>
        </form>
      </SectionCard>

      <Box component="section">
        <SectionHeader variant="eyebrow" title={t('suggestions.mySuggestions')} mb="sm" />
        {isLoading ? (
          <Stack gap="sm">
            <CardSkeleton />
            <CardSkeleton />
          </Stack>
        ) : items.length === 0 ? (
          <Paper withBorder p="xl" ta="center" style={{ borderStyle: 'dashed', background: 'transparent' }}>
            <Text size="sm" c="dimmed">{t('suggestions.empty')}</Text>
          </Paper>
        ) : (
          <Stack gap="sm">
            {items.map((item) => (
              <Paper key={item.id} withBorder radius="md" p="md">
                <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                  <Box miw={0}>
                    <Text size="sm" fw={600}>{item.title}</Text>
                    <Text size="xs" c="dimmed" mt={2}>
                      {item.kind === 'existing_app'
                        ? (item.appName ?? t('suggestions.app'))
                        : (item.proposedName || t('suggestions.newSystemLabel'))}
                    </Text>
                  </Box>
                  <Badge size="sm" color="gray">
                    {t(`suggestions.status.${item.status}`)}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed" mt="xs" lineClamp={4} style={{ whiteSpace: 'pre-wrap' }}>
                  {item.body}
                </Text>
              </Paper>
            ))}
          </Stack>
        )}
      </Box>
    </PortalShell>
  )
}
