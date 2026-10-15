import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { NexusProvider, notificationsDefaults } from '@nexus/design'
import App from './App'
import { LanguageProvider } from './i18n'
import '@mantine/core/styles.layer.css'
import '@mantine/notifications/styles.layer.css'
import '@nexus/design/styles.css'
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NexusProvider>
      <ModalsProvider>
        <Notifications {...notificationsDefaults} />
        <LanguageProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter basename={import.meta.env.BASE_URL}>
              <App />
            </BrowserRouter>
          </QueryClientProvider>
        </LanguageProvider>
      </ModalsProvider>
    </NexusProvider>
  </React.StrictMode>
)
