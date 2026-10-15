import { ActionIcon, Alert, Badge, Box, Button, Center, Checkbox, Group, Image, Paper, ScrollArea, SimpleGrid, Stack, Tabs, Text, TextInput, Tooltip } from '@mantine/core'
import { Boxes, ExternalLink, Globe, Pencil, Plus, Trash2, Users, Shield, Key, Server } from 'lucide-react'
import { CardSkeleton, ListEditor, PageHeader, RefreshButton, ResourceCard, SearchInput } from '@nexus/design'
import { useState } from 'react'
import ImageField from '../components/ImageField'
import EmptyState from '../components/EmptyState'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { iconFieldForCreate, iconFieldForUpdate, imageFieldForCreate, imageFieldForUpdate, resolveMediaSrc } from '../lib/media'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import React from 'react';
import {
  useApps, useCreateApp, useDeleteApp, useUpdateApp,
  useUploadAppImage, useDefaultAppImages,
  useUsers, useUpdateUser,
  useGroups, useUpdateGroup,
  useRoles, useUpdateRole,
  useClients, useUpdateClient,
} from '../hooks/useApi'

const EMOJI_SUGGESTIONS = ['🚀', '🔐', '📦', '🛡️', '⚙️', '🌐', '📊', '💼', '🔧', '🎯', '📱', '🖥️', '🤖', '🔑', '💡']

interface AppItem {
  id: string
  name: string
  description: string
  icon?: string
  imageUrl?: string
  url?: string
  resources: string[]
  createdAt: string
}

const EMPTY_FORM = { name: '', description: '', icon: '', imageUrl: '', url: '', resources: [] as string[] }

type ComponentTab = 'clients' | 'users' | 'groups' | 'roles'

interface ComponentsManagerProps {
  appId: string
}

const ComponentsManager = ({ appId }: ComponentsManagerProps) => {
  const [tab, setTab] = useState<ComponentTab>('clients')
  const { data: clients = [] } = useClients()
  const { data: users = [] } = useUsers()
  const { data: groups = [] } = useGroups()
  const { data: roles = [] } = useRoles()
  const updateClient = useUpdateClient()
  const updateUser = useUpdateUser()
  const updateGroup = useUpdateGroup()
  const updateRole = useUpdateRole()

  const tabs: { key: ComponentTab; label: string; icon: React.ReactNode }[] = [
    { key: 'clients', label: 'Clients', icon: <Server size={13} /> },
    { key: 'users', label: 'Users', icon: <Users size={13} /> },
    { key: 'groups', label: 'Groups', icon: <Shield size={13} /> },
    { key: 'roles', label: 'Roles', icon: <Key size={13} /> },
  ]

  type AnyItem = { id: string; name?: string; email?: string; appId?: string; appIds?: string[] }

  const getItems = (): AnyItem[] => {
    if (tab === 'clients') return (clients as AnyItem[])
    if (tab === 'users') return (users as AnyItem[])
    if (tab === 'groups') return (groups as AnyItem[])
    return (roles as AnyItem[])
  }

  const toggleAssign = async (item: AnyItem) => {
    const currentAppIds = item.appIds ?? (item.appId ? [item.appId] : [])
    const nextAppIds = currentAppIds.includes(appId)
      ? currentAppIds.filter((id) => id !== appId)
      : [...currentAppIds, appId]

    if (tab === 'clients') await updateClient.mutateAsync({ id: item.id, appId: item.appId === appId ? undefined : appId })
    else if (tab === 'users') await updateUser.mutateAsync({ id: item.id, appIds: nextAppIds })
    else if (tab === 'groups') await updateGroup.mutateAsync({ id: item.id, appIds: nextAppIds })
    else await updateRole.mutateAsync({ id: item.id, appId: item.appId === appId ? undefined : appId })
  }

  const items = getItems()
  const assignedIds = new Set(items.filter((item) => (item.appIds ?? (item.appId ? [item.appId] : [])).includes(appId)).map((item) => item.id))

  return (
    <Stack gap="sm">
      <Tabs value={tab} onChange={(value) => value && setTab(value as ComponentTab)}>
        <Tabs.List>
          {tabs.map(t => (
            <Tabs.Tab key={t.key} value={t.key} leftSection={t.icon}>{t.label}</Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
      <ScrollArea.Autosize mah={256} type="auto">
        {items.length === 0 ? (
          <Text size="xs" c="dimmed" ta="center" py="md">No {tab} found</Text>
        ) : (
          <Stack gap={4}>
            {items.map((item) => {
              const assigned = assignedIds.has(item.id)
              const label = (item as any).username || item.email || item.name || item.id
              return (
                <Paper
                  key={item.id}
                  radius="md"
                  px="sm"
                  py={8}
                  bg={assigned ? 'var(--nx-color-surface-sunken)' : 'transparent'}
                >
                  <Checkbox
                    checked={assigned}
                    onChange={() => toggleAssign(item)}
                    label={
                      <Group gap="xs" justify="space-between" wrap="nowrap">
                        <Text size="sm">{label}</Text>
                        {assigned && <Badge size="sm" variant="light" color="gray">assigned</Badge>}
                      </Group>
                    }
                    styles={{ body: { alignItems: 'center' }, labelWrapper: { flex: 1 } }}
                  />
                </Paper>
              )
            })}
          </Stack>
        )}
      </ScrollArea.Autosize>
    </Stack>
  )
}

const Apps = () => {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)
  const { data: apps = [], isLoading, isFetching, refetch } = useApps(debouncedSearch)
  const createApp = useCreateApp()
  const updateApp = useUpdateApp()
  const deleteApp = useDeleteApp()
  const uploadAppImage = useUploadAppImage()
  const { data: defaultAppImages } = useDefaultAppImages()

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editTab, setEditTab] = useState<'details' | 'components'>('details')
  const [appToEdit, setAppToEdit] = useState<AppItem | null>(null)
  const [appToDelete, setAppToDelete] = useState<AppItem | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [createFormError, setCreateFormError] = useState('')
  const [editFormError, setEditFormError] = useState('')

  const openCreate = () => {
    setFormData(EMPTY_FORM)
    setSelectedImageFile(null)
    setCreateFormError('')
    setCreateOpen(true)
  }

  const openEdit = (app: AppItem) => {
    setAppToEdit(app)
    setFormData({ name: app.name, description: app.description, icon: app.icon ?? '', imageUrl: app.imageUrl ?? '', url: app.url ?? '', resources: app.resources ?? [] })
    setSelectedImageFile(null)
    setEditFormError('')
    setEditTab('details')
    setEditOpen(true)
  }

  const handleCreate = async () => {
    if (!formData.name) return

    setCreateFormError('')
    try {
      const created = await createApp.mutateAsync({
        name: formData.name,
        description: formData.description,
        icon: iconFieldForCreate(formData.icon),
        imageUrl: imageFieldForCreate(formData.imageUrl),
        url: formData.url || undefined,
        resources: formData.resources,
      }) as AppItem

      if (selectedImageFile && created?.id) {
        await uploadAppImage.mutateAsync({ appId: created.id, file: selectedImageFile })
      }

      setCreateOpen(false)
      setSelectedImageFile(null)
    } catch (error) {
      setCreateFormError(error instanceof Error ? error.message : 'Failed to create app')
    }
  }

  const handleUpdate = async () => {
    if (!appToEdit || !formData.name) return

    setEditFormError('')
    try {
      await updateApp.mutateAsync({
        id: appToEdit.id,
        name: formData.name,
        description: formData.description,
        icon: iconFieldForUpdate(formData.icon),
        imageUrl: imageFieldForUpdate(formData.imageUrl),
        url: formData.url || null,
        resources: formData.resources,
      })
      setEditOpen(false)
      setAppToEdit(null)
    } catch (error) {
      setEditFormError(error instanceof Error ? error.message : 'Failed to update app')
    }
  }

  const confirmDelete = async () => {
    if (!appToDelete) return
    await deleteApp.mutateAsync(appToDelete.id)
    setAppToDelete(null)
  }

  const renderAppVisual = (imageUrl: string | undefined, icon: string | undefined, name: string, fallbackSize = 20) => {
    const src = resolveMediaSrc(imageUrl)
    if (src) return <Image src={src} alt={name} w="100%" h="100%" fit="cover" radius="md" />
    if (icon) return <Text span fz={fallbackSize + 2} lh={1}>{icon}</Text>
    return <Boxes size={fallbackSize} />
  }

  const renderAppForm = () => (
    <Stack gap="md">
      <Group gap="sm" align="flex-end" wrap="nowrap">
        <Stack gap={4}>
          <Text size="sm" fw={500}>Preview</Text>
          <Center
            w={80}
            h={48}
            title="Click emoji suggestions to pick"
            style={{
              border: '2px dashed var(--nx-color-border)',
              borderRadius: 'var(--mantine-radius-md)',
              overflow: 'hidden',
              color: 'var(--nx-color-text-muted)',
            }}
          >
            {resolveMediaSrc(formData.imageUrl)
              ? <Image src={resolveMediaSrc(formData.imageUrl)} alt="app" w="100%" h="100%" fit="cover" />
              : (formData.icon ? <Text span fz={24} lh={1}>{formData.icon}</Text> : <Boxes size={20} />)}
          </Center>
        </Stack>
        <TextInput
          label="App Name"
          withAsterisk
          flex={1}
          value={formData.name}
          onChange={e => { const value = e.currentTarget.value; setFormData(p => ({ ...p, name: value })) }}
          placeholder="Internal Portal"
        />
      </Group>

      <ImageField
        label="App Image"
        value={formData.imageUrl}
        onChange={(imageUrl) => setFormData((prev) => ({ ...prev, imageUrl }))}
        previewFallback={formData.icon || <Boxes size={20} />}
        defaultImages={(defaultAppImages as any)?.items ?? []}
        uploadPending={uploadAppImage.isPending}
        onUpload={appToEdit
          ? async (file) => {
              try {
                const result = await uploadAppImage.mutateAsync({ appId: appToEdit.id, file }) as { imageUrl?: string }
                if (result?.imageUrl) {
                  setFormData((prev) => ({ ...prev, imageUrl: result.imageUrl ?? '' }))
                }
                setEditFormError('')
              } catch (error) {
                setEditFormError(error instanceof Error ? error.message : 'Failed to upload app image')
              }
            }
          : async (file) => setSelectedImageFile(file)}
        uploadHint={!appToEdit && selectedImageFile
          ? `Selected: ${selectedImageFile.name}. The image will upload when you create the app.`
          : undefined}
      />

      <Stack gap={6}>
        <Text size="sm" fw={500}>Emoji Suggestions</Text>
        <Group gap={6}>
          {EMOJI_SUGGESTIONS.map(emoji => (
            <ActionIcon
              key={emoji}
              type="button"
              size="lg"
              variant={formData.icon === emoji ? 'light' : 'default'}
              onClick={() => setFormData(p => ({ ...p, icon: p.icon === emoji ? '' : emoji }))}
              aria-label={`Use ${emoji} icon`}
              aria-pressed={formData.icon === emoji}
            >
              <Text span fz="md" lh={1}>{emoji}</Text>
            </ActionIcon>
          ))}
          {formData.icon && !EMOJI_SUGGESTIONS.includes(formData.icon) && (
            <TextInput
              value={formData.icon}
              onChange={e => { const value = e.currentTarget.value.slice(0, 4); setFormData(p => ({ ...p, icon: value })) }}
              w={80}
              size="xs"
              styles={{ input: { textAlign: 'center' } }}
              placeholder="custom"
              aria-label="Custom icon"
            />
          )}
          <Button
            type="button"
            variant="subtle"
            color="gray"
            size="xs"
            onClick={() => setFormData(p => ({ ...p, icon: '' }))}
          >
            clear
          </Button>
        </Group>
      </Stack>

      <TextInput
        label="Description"
        value={formData.description}
        onChange={e => { const value = e.currentTarget.value; setFormData(p => ({ ...p, description: value })) }}
        placeholder="Identity assets for internal portal"
      />

      <TextInput
        label="App URL"
        type="url"
        leftSection={<Globe size={14} />}
        value={formData.url}
        onChange={e => { const value = e.currentTarget.value; setFormData(p => ({ ...p, url: value })) }}
        placeholder="https://portal.example.com"
      />

      <Stack gap={6}>
        <Box>
          <Text size="sm" fw={500}>Resources</Text>
          <Text size="xs" c="dimmed">Used for role permission scoping.</Text>
        </Box>
        <ListEditor<string>
          value={formData.resources}
          onChange={(resources) => setFormData(p => ({ ...p, resources }))}
          createItem={() => ''}
          addLabel="Add Resource"
          emptyText="No resources yet."
          removeLabel="Remove resource"
          renderItem={(resource, { id, onChange }) => (
            <TextInput
              id={id}
              value={resource}
              onChange={e => onChange(e.currentTarget.value)}
              placeholder="resource_name"
              aria-label="Resource name"
              ff="monospace"
              flex={1}
            />
          )}
        />
      </Stack>
    </Stack>
  )

  const closeEdit = () => { setEditOpen(false); setAppToEdit(null) }

  return (
    <>
      <PageHeader
        eyebrow="Management Units"
        title="Apps"
        actions={
          <Button onClick={openCreate} leftSection={<Plus size={16} />}>
            New App
          </Button>
        }
      />

      <Group justify="space-between" gap="sm">
        <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search apps by name, description, URL…" maw={360} w="100%" />
        <RefreshButton onRefresh={() => refetch()} loading={isFetching} size="xs" lastUpdated={null} />
      </Group>

      {isLoading ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)}
        </SimpleGrid>
      ) : (apps as AppItem[]).length === 0 ? (
        <Paper withBorder radius="md">
          <EmptyState
            icon={Boxes}
            title="No apps created yet"
            description="Create an app to group users, clients and roles."
            action={<Button onClick={openCreate} size="xs" leftSection={<Plus size={14} />}>New App</Button>}
          />
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" className="nx-stagger">
          {(apps as AppItem[]).map((app) => (
            <ResourceCard
              key={app.id}
              layout="grid"
              title={app.name}
              subtitle={app.url}
              description={app.description || undefined}
              icon={renderAppVisual(app.imageUrl, app.icon, app.name)}
              iconColor="gray"
              tags={(app.resources?.length ?? 0) > 0 ? [
                <Badge key="resources" variant="light" color="blue">
                  {app.resources.length} resource{app.resources.length !== 1 ? 's' : ''}
                </Badge>,
              ] : undefined}
              actions={
                <Group gap={4} wrap="nowrap">
                  {app.url && (
                    <Tooltip label={app.url}>
                      <ActionIcon
                        component="a"
                        href={app.url}
                        target="_blank"
                        rel="noreferrer"
                        variant="subtle"
                        color="gray"
                        aria-label={`Open ${app.name}`}
                      >
                        <ExternalLink size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  <Tooltip label="Edit app">
                    <ActionIcon onClick={() => openEdit(app)} variant="subtle" color="gray" aria-label="Edit app" title="Edit app">
                      <Pencil size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Delete app">
                    <ActionIcon onClick={() => setAppToDelete(app)} variant="subtle" color="red" aria-label="Delete app" title="Delete app">
                      <Trash2 size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              }
            />
          ))}
        </SimpleGrid>
      )}

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create App">
        <Stack gap="md">
          {renderAppForm()}
          {createFormError && <Alert color="red" variant="light">{createFormError}</Alert>}
          <Group justify="flex-end" gap="xs" pt="xs">
            <Button onClick={() => { setCreateOpen(false); setSelectedImageFile(null) }} variant="default">Cancel</Button>
            <Button
              onClick={handleCreate}
              loading={createApp.isPending || uploadAppImage.isPending}
              disabled={!formData.name}
            >
              Create App
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Modal with tabs */}
      <Modal isOpen={editOpen} onClose={closeEdit} title={`Edit App${appToEdit ? `: ${appToEdit.name}` : ''}`}>
        <Tabs value={editTab} onChange={(value) => value && setEditTab(value as 'details' | 'components')}>
          <Tabs.List mb="md">
            <Tabs.Tab value="details">Details</Tabs.Tab>
            <Tabs.Tab value="components">Components</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="details">
            <Stack gap="md">
              {renderAppForm()}
              {editFormError && <Alert color="red" variant="light">{editFormError}</Alert>}
              <Group justify="flex-end" gap="xs" pt="xs">
                <Button onClick={closeEdit} variant="default">Cancel</Button>
                <Button
                  onClick={handleUpdate}
                  loading={updateApp.isPending}
                  disabled={!formData.name}
                >
                  Save Changes
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="components">
            <Stack gap="md">
              {appToEdit && <ComponentsManager appId={appToEdit.id} />}
              <Group justify="flex-end" pt="sm" style={{ borderTop: '1px solid var(--nx-color-border)' }}>
                <Button onClick={closeEdit} variant="default">Close</Button>
              </Group>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Modal>

      <ConfirmDialog
        isOpen={!!appToDelete}
        title="Delete App"
        message={`Delete app "${appToDelete?.name ?? ''}"? Linked records will keep their IDs but app grouping will be removed if you reassign them.`}
        confirmLabel="Delete App"
        pending={deleteApp.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setAppToDelete(null)}
      />
    </>
  )
}

export default Apps
