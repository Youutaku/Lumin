const { app, BrowserWindow, ipcMain, dialog, Menu, shell, net } = require('electron')
const path = require('path')
const fs = require('fs')
const { autoUpdater } = require('electron-updater')
const { publish } = require('../package.json').build

let mainWindow = null
const isDev = process.env.NODE_ENV === 'development'

// 配置 autoUpdater
autoUpdater.autoDownload = false  // 用户点"检查更新"才下载
autoUpdater.autoInstallOnAppQuit = true  // 退出时自动安装

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#ffffff',
    titleBarStyle: 'hiddenInset',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.on('did-finish-load', () => {
    // 窗口加载完成后检测版本变更
    checkVersionChange()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建',
          accelerator: 'Ctrl+N',
          click: () => mainWindow?.webContents.send('menu:new')
        },
        {
          label: '打开...',
          accelerator: 'Ctrl+O',
          click: () => mainWindow?.webContents.send('menu:open')
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'Ctrl+S',
          click: () => mainWindow?.webContents.send('menu:save')
        },
        {
          label: '另存为...',
          accelerator: 'Ctrl+Shift+S',
          click: () => mainWindow?.webContents.send('menu:saveAs')
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { type: 'separator' },
        { label: '全选', role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '切换主题',
          accelerator: 'Ctrl+Shift+T',
          click: () => mainWindow?.webContents.send('menu:toggleTheme')
        },
        {
          label: '切换专注模式',
          accelerator: 'Ctrl+Shift+F',
          click: () => mainWindow?.webContents.send('menu:focusMode')
        },
        {
          label: '切换侧边栏',
          accelerator: 'Ctrl+B',
          click: () => mainWindow?.webContents.send('menu:toggleSidebar')
        },
        { type: 'separator' },
        {
          label: '放大',
          accelerator: 'Ctrl+=',
          click: () => mainWindow?.webContents.send('menu:zoomIn')
        },
        {
          label: '缩小',
          accelerator: 'Ctrl+-',
          click: () => mainWindow?.webContents.send('menu:zoomOut')
        },
        {
          label: '重置缩放',
          accelerator: 'Ctrl+0',
          click: () => mainWindow?.webContents.send('menu:zoomReset')
        },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '帮助文档',
          click: () => mainWindow?.webContents.send('menu:help')
        },
        { type: 'separator' },
        {
          label: '关于 Lumin',
          click: () => mainWindow?.webContents.send('menu:about')
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// 文件对话框 IPC
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开 Markdown 文件',
    properties: ['openFile'],
    filters: [
      { name: 'Markdown 文件', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0]
    const content = fs.readFileSync(filePath, 'utf-8')
    return { filePath, content }
  }
  return null
})

ipcMain.handle('dialog:saveFile', async (event, { content, defaultPath }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存 Markdown 文件',
    defaultPath: defaultPath || 'untitled.md',
    filters: [
      { name: 'Markdown 文件', extensions: ['md'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })

  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, content, 'utf-8')
    return result.filePath
  }
  return null
})

ipcMain.handle('file:read', async (event, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch (e) {
    return null
  }
})

ipcMain.handle('file:write', async (event, { filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  } catch (e) {
    return false
  }
})

ipcMain.handle('app:getVersion', () => app.getVersion())

ipcMain.handle('shell:openExternal', async (event, url) => {
  try {
    await shell.openExternal(url)
    return true
  } catch (e) {
    return false
  }
})

// ============ Auto Updater + Changelog ============

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

const CHANGES_DIR = app.getPath('userData')
const LAST_VERSION_FILE = path.join(CHANGES_DIR, '.last-version.json')
const CHANGELOG_FILE = path.join(CHANGES_DIR, '.changelog.json')

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch {
    return null
  }
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
  } catch {}
}

function checkVersionChange() {
  const current = app.getVersion()
  const lastRun = readJson(LAST_VERSION_FILE)?.version
  if (lastRun && lastRun !== current) {
    // 有更新，把上次下载时存的 changelog 发出去
    const changelog = readJson(CHANGELOG_FILE) || {}
    sendToRenderer('app:changelog', {
      from: lastRun,
      to: current,
      releaseNotes: changelog.releaseNotes || '',
      releaseDate: changelog.releaseDate || ''
    })
  }
  writeJson(LAST_VERSION_FILE, { version: current, at: Date.now() })
}

// 从 GitHub Releases API 拉 release notes
async function fetchGithubReleaseNotes(tag) {
  try {
    const url = `https://api.github.com/repos/${publish.owner}/${publish.repo}/releases/tags/${tag}`
    const resp = await net.fetch(url)
    if (!resp.ok) return ''
    const data = await resp.json()
    return data.body || ''
  } catch {
    return ''
  }
}

autoUpdater.on('checking-for-update', () => {
  sendToRenderer('updater:checking')
})

autoUpdater.on('update-available', async (info) => {
  // electron-updater 的 info.releaseNotes 通常是空的，主动拉 GitHub API
  let releaseNotes = info.releaseNotes || ''
  if (!releaseNotes) {
    releaseNotes = await fetchGithubReleaseNotes(`v${info.version}`)
  }
  // 立刻存起来，update-downloaded 时 info.releaseNotes 还是空的
  writeJson(CHANGELOG_FILE, {
    version: info.version,
    releaseNotes,
    releaseDate: info.releaseDate || '',
    savedAt: Date.now()
  })
  sendToRenderer('updater:available', {
    version: info.version,
    releaseNotes,
    releaseDate: info.releaseDate || ''
  })
})

autoUpdater.on('update-not-available', (info) => {
  sendToRenderer('updater:not-available', { version: info.version })
})

autoUpdater.on('download-progress', (progressObj) => {
  sendToRenderer('updater:progress', {
    percent: Math.round(progressObj.percent),
    bytesPerSecond: progressObj.bytesPerSecond,
    total: progressObj.total,
    transferred: progressObj.transferred
  })
})

autoUpdater.on('update-downloaded', (info) => {
  // 存 changelog，下次启动时弹窗用
  let releaseNotes = info.releaseNotes || ''
  writeJson(CHANGELOG_FILE, {
    version: info.version,
    releaseNotes,
    releaseDate: info.releaseDate || '',
    savedAt: Date.now()
  })
  sendToRenderer('updater:downloaded', { version: info.version })
})

autoUpdater.on('error', (err) => {
  sendToRenderer('updater:error', { message: err.message || String(err) })
})

// IPC: 渲染进程主动触发检查更新
ipcMain.handle('updater:check', async () => {
  if (isDev) {
    return { ok: false, message: '开发模式下无法检查更新，请使用打包后的版本。' }
  }
  try {
    await autoUpdater.checkForUpdates()
    return { ok: true }
  } catch (e) {
    return { ok: false, message: e.message || String(e) }
  }
})

// IPC: 用户点"下载更新"
ipcMain.handle('updater:download', async () => {
  try {
    await autoUpdater.downloadUpdate()
    return { ok: true }
  } catch (e) {
    return { ok: false, message: e.message || String(e) }
  }
})

// IPC: 用户点"立即安装并重启"
ipcMain.handle('updater:install', async () => {
  autoUpdater.quitAndInstall(true, true)
  return { ok: true }
})

app.whenReady().then(() => {
  createWindow()
  createMenu()

  // 生产环境启动后静默检查一次更新
  if (!isDev) {
    autoUpdater.checkForUpdates().catch(() => {})
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
