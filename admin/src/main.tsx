import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { NexusProvider, notificationsDefaults } from '@nexus/design'
import App from './App'
import { LanguageProvider } from './i18n'
import '@mantine/core/styles.layer.css'
import '@mantine/notifications/styles.layer.css'
import '@mantine/charts/styles.layer.css'
import '@mantine/dates/styles.layer.css'
import '@nexus/design/styles.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NexusProvider>
      <ModalsProvider>
        <Notifications {...notificationsDefaults} />
        <BrowserRouter>
          <LanguageProvider>
            <App />
          </LanguageProvider>
        </BrowserRouter>
      </ModalsProvider>
    </NexusProvider>
  </React.StrictMode>,
)
