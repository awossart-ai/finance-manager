'use strict'

const { app, BrowserWindow, shell, Menu, session } = require('electron')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0f172a',
    show: false,
    title: 'Finance Manager',
  })

  // Bypass CORS pour les APIs financières (Yahoo Finance, CoinGecko)
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://*.yahoo.com/*', 'https://api.coingecko.com/*'] },
    (details, callback) => {
      details.requestHeaders['User-Agent'] =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      details.requestHeaders['Origin'] = 'https://finance.yahoo.com'
      details.requestHeaders['Referer'] = 'https://finance.yahoo.com/'
      callback({ requestHeaders: details.requestHeaders })
    }
  )

  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['https://*.yahoo.com/*', 'https://api.coingecko.com/*'] },
    (details, callback) => {
      const headers = { ...details.responseHeaders }
      headers['access-control-allow-origin'] = ['*']
      headers['access-control-allow-headers'] = ['*']
      callback({ responseHeaders: headers })
    }
  )

  // Ouvre les liens externes dans le navigateur par défaut
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
}

// Menu en français
const menuTemplate = [
  {
    label: app.name,
    submenu: [
      { role: 'about', label: 'À propos de Finance Manager' },
      { type: 'separator' },
      { role: 'services', label: 'Services' },
      { type: 'separator' },
      { role: 'hide', label: 'Masquer Finance Manager' },
      { role: 'hideOthers', label: 'Masquer les autres' },
      { role: 'unhide', label: 'Tout afficher' },
      { type: 'separator' },
      { role: 'quit', label: 'Quitter Finance Manager' },
    ],
  },
  {
    label: 'Édition',
    submenu: [
      { role: 'undo', label: 'Annuler' },
      { role: 'redo', label: 'Rétablir' },
      { type: 'separator' },
      { role: 'cut', label: 'Couper' },
      { role: 'copy', label: 'Copier' },
      { role: 'paste', label: 'Coller' },
      { role: 'selectAll', label: 'Tout sélectionner' },
    ],
  },
  {
    label: 'Affichage',
    submenu: [
      { role: 'reload', label: 'Recharger' },
      { role: 'forceReload', label: 'Forcer le rechargement' },
      { type: 'separator' },
      { role: 'resetZoom', label: 'Taille réelle' },
      { role: 'zoomIn', label: 'Agrandir' },
      { role: 'zoomOut', label: 'Réduire' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Plein écran' },
    ],
  },
  {
    label: 'Fenêtre',
    submenu: [
      { role: 'minimize', label: 'Réduire' },
      { role: 'zoom', label: 'Agrandir' },
      { type: 'separator' },
      { role: 'front', label: 'Tout ramener au premier plan' },
    ],
  },
]

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
