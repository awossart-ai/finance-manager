'use strict'

const { contextBridge } = require('electron')

// Expose des infos sécurisées au renderer
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.versions.electron,
})
