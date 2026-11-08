const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 对话框
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  saveFileDialog: (content, defaultPath) =>
    ipcRenderer.invoke('dialog:saveFile', { content, defaultPath }),

  // 文件操作
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath, content) =>
    ipcRenderer.invoke('file:write', { filePath, content }),

  // 应用信息
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // 外部链接
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // ============ GitHub 代理 ============
  proxyGet: () => ipcRenderer.invoke('proxy:get'),
  proxySet: (enabled, proxyUrl) => ipcRenderer.invoke('proxy:set', { enabled, proxyUrl }),
  proxyTest: (proxyUrl) => ipcRenderer.invoke('proxy:test', proxyUrl),

  // ============ Auto Updater ============
  updaterCheck: () => ipcRenderer.invoke('updater:check'),
  updaterDownload: () => ipcRenderer.invoke('updater:download'),
  updaterInstall: () => ipcRenderer.invoke('updater:install'),

  // 监听主进程推送的 updater 事件
  onUpdater: (callback) => {
    const events = [
      'updater:checking',
      'updater:available',
      'updater:not-available',
      'updater:progress',
      'updater:downloaded',
      'updater:error'
    ]
    events.forEach((event) => {
      ipcRenderer.on(event, (_evt, data) => callback(event, data))
    })
  },

  // 监听主进程推送的 app 事件（版本变更等）
  onApp: (callback) => {
    const events = ['app:changelog']
    events.forEach((event) => {
      ipcRenderer.on(event, (_evt, data) => callback(event, data))
    })
  },

  // 菜单事件监听
  onMenu: (callback) => {
    const events = [
      'menu:new',
      'menu:open',
      'menu:save',
      'menu:saveAs',
      'menu:toggleTheme',
      'menu:focusMode',
      'menu:toggleSidebar',
      'menu:zoomIn',
      'menu:zoomOut',
      'menu:zoomReset',
      'menu:help',
      'menu:about'
    ]
    events.forEach((event) => {
      ipcRenderer.on(event, () => callback(event))
    })
  }
})
