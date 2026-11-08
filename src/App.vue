<script setup>
import { reactive, watch, onMounted, provide, computed, ref, inject, nextTick } from 'vue'
import { marked } from 'marked'
import TitleBar from './components/TitleBar.vue'
import Toolbar from './components/Toolbar.vue'
import Sidebar from './components/Sidebar.vue'
import Editor from './components/Editor.vue'
import Preview from './components/Preview.vue'
import logoUrl from './assets/logo.png'

function renderMd(text) {
  if (!text) return ''
  try {
    return marked.parse(text, { async: false })
  } catch {
    return text
  }
}

const STORAGE_KEY = 'lumin-settings'
const AUTOSAVE_KEY = 'lumin-autosave'
const WELCOME_SHOWN_KEY = 'lumin-welcome-shown'

// GitHub 项目地址
const GITHUB_RELEASES = 'https://github.com/Youutaku/Lumin/releases'
const LICENSE_URL = 'https://github.com/Youutaku/Lumin/blob/master/LICENSE'

function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch (e) {}
  return {
    theme: 'light',
    sidebarVisible: true,
    mode: 'split',
    fontSize: 15,
    lineHeight: 1.7,
    wordWrap: true,
    spellcheck: false,
    zoom: 1
  }
}

function saveSettings(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

const settings = reactive(loadSettings())

const doc = reactive({
  content: '',
  filePath: null,
  dirty: false,
  title: '未命名文档'
})

// ---- Modal / Toast ----
const showAbout = ref(false)
const showChangelog = ref(false)
const appVersion = ref('0.0.1')
const changelogData = reactive({ from: '', to: '', releaseNotes: '' })
const toast = reactive({ visible: false, text: '', timer: null })

// ---- Updater 状态 ----
const updater = reactive({
  state: 'idle',     // idle | checking | available | not-available | downloading | downloaded | error
  version: '',
  percent: 0,
  errorMsg: ''
})

function openUrl(url) {
  const api = window.electronAPI
  if (api?.openExternal) {
    api.openExternal(url)
  } else {
    window.open(url, '_blank')
  }
}

function showToast(text, ms = 2500) {
  if (toast.timer) clearTimeout(toast.timer)
  toast.text = text
  toast.visible = true
  toast.timer = setTimeout(() => { toast.visible = false }, ms)
}

// Updater actions
async function checkUpdate() {
  const api = window.electronAPI
  if (!api?.updaterCheck) {
    showToast('开发模式下暂不支持自动更新')
    return
  }
  updater.state = 'checking'
  const res = await api.updaterCheck()
  if (res && !res.ok && res.message) {
    updater.state = 'error'
    updater.errorMsg = res.message
  }
}

async function downloadUpdate() {
  const api = window.electronAPI
  if (!api?.updaterDownload) return
  updater.state = 'downloading'
  await api.updaterDownload()
}

async function installUpdate() {
  const api = window.electronAPI
  if (!api?.updaterInstall) return
  showToast('正在重启安装更新...')
  await api.updaterInstall()
}

function setupUpdaterListeners() {
  const api = window.electronAPI
  if (!api?.onUpdater) return
  api.onUpdater((event, data) => {
    switch (event) {
      case 'updater:checking':
        updater.state = 'checking'; break
      case 'updater:available':
        updater.state = 'available'; updater.version = data.version; break
      case 'updater:not-available':
        updater.state = 'not-available'; break
      case 'updater:progress':
        updater.state = 'downloading'; updater.percent = data.percent; break
      case 'updater:downloaded':
        updater.state = 'downloaded'; break
      case 'updater:error':
        updater.state = 'error'; updater.errorMsg = data.message; break
    }
  })
}

function setupAppListeners() {
  const api = window.electronAPI
  if (!api?.onApp) return
  api.onApp((event, data) => {
    if (event === 'app:changelog') {
      changelogData.from = data.from
      changelogData.to = data.to
      changelogData.releaseNotes = data.releaseNotes || ''
      showChangelog.value = true
    }
  })
}

// 欢迎文档（只在第一次打开时显示）
const WELCOME_DOC = `# 欢迎使用 Lumin

**Lumin** 是一款专注、优雅的 Markdown 编辑器，让你安心写作、专注表达。

## 功能特性

- **亮色 / 暗色主题**，一键切换，护眼舒服
- **三种编辑模式**：纯编辑、分屏同步、纯预览
- **大纲导航**，长文档也能快速跳转
- **丰富快捷键**，从新建到保存全键盘搞定
- **数学公式**，内置 KaTeX，$E = mc^2$ 随手写
- **Mermaid 图表**，流程图、时序图直接渲染
- **语法高亮**，支持近百种编程语言

## 快速上手

1. 在左侧输入 Markdown 源码
2. 右侧实时渲染预览效果
3. 按 \`Ctrl + S\` 保存到本地

## 代码示例

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`)
  return true
}
greet('Lumin')
\`\`\`

## 数学公式

行内公式：$E = mc^2$

块级公式：

$$
\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

## Mermaid 图表

**流程图**

\`\`\`mermaid
flowchart LR
    A[开始] --> B{判断}
    B -->|是| C[执行操作]
    B -->|否| D[结束]
    C --> D
\`\`\`

**时序图**

\`\`\`mermaid
sequenceDiagram
    participant 用户
    participant 前端
    participant 后端
    用户->>前端: 点击登录
    前端->>后端: POST /api/login
    后端-->>前端: 返回 Token
    前端-->>用户: 登录成功
\`\`\`

**类图**

\`\`\`mermaid
classDiagram
    class Animal {
        +String name
        +int age
        +eat()
        +sleep()
    }
    class Dog {
        +String breed
        +bark()
    }
    Animal <|-- Dog
\`\`\`

**甘特图**

\`\`\`mermaid
gantt
    title 项目进度
    dateFormat YYYY-MM-DD
    section 设计
    UI 设计       :a1, 2026-11-01, 7d
    技术方案       :a2, after a1, 5d
    section 开发
    前端开发       :b1, after a2, 14d
    后端开发       :b2, after a2, 14d
    section 测试
    联调测试       :c1, after b1, 7d
    上线部署       :c2, after c1, 2d
\`\`\`

## 引用

> 简洁是复杂的终极形式。
> —— 达·芬奇

## 任务列表

- [x] 打开 Lumin
- [ ] 写下第一个想法
- [ ] 享受专注的写作时光

---

现在，开始书写吧。
`

const status = reactive({
  words: 0,
  chars: 0,
  lines: 1,
  cursorLine: 1,
  cursorCol: 1
})

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

function applyZoom(scale) {
  const z = Math.max(0.5, Math.min(2, Math.round(scale * 10) / 10))
  // 只对 .main-area 用 CSS zoom，窗口 chrome 不动
  const main = document.querySelector('.main-area')
  if (main) {
    main.style.zoom = String(z)
  }
}

function updateStatus() {
  const text = doc.content
  status.chars = text.length
  status.words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length
  status.lines = text.split('\n').length
}

let autosaveTimer = null
function autosave() {
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, doc.content)
    } catch (e) {}
  }, 1500)
}

watch(
  settings,
  (s) => {
    saveSettings(s)
    applyTheme(s.theme)
    applyZoom(s.zoom)
  },
  { deep: true }
)

watch(
  () => doc.content,
  () => {
    doc.dirty = true
    updateStatus()
    autosave()
  }
)

// ---- Actions ----
async function handleNew() {
  if (doc.dirty && !confirm('当前文档未保存，是否继续？')) return
  doc.content = ''
  doc.filePath = null
  doc.title = '未命名文档'
  doc.dirty = false
  localStorage.removeItem(AUTOSAVE_KEY)
}

async function handleOpen() {
  if (doc.dirty && !confirm('当前文档未保存，是否继续？')) return
  const api = window.electronAPI
  if (!api) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,.mdown,.mkd,.txt'
    input.onchange = (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        doc.content = String(reader.result || '')
        doc.filePath = file.name
        doc.title = file.name.replace(/\.[^.]+$/, '')
        doc.dirty = false
      }
      reader.readAsText(file)
    }
    input.click()
    return
  }
  const result = await api.openFileDialog()
  if (result) {
    doc.content = result.content
    doc.filePath = result.filePath
    doc.title = result.filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') || '未命名文档'
    doc.dirty = false
  }
}

async function handleSave() {
  const api = window.electronAPI
  if (!api) return
  if (doc.filePath) {
    const ok = await api.writeFile(doc.filePath, doc.content)
    if (ok) doc.dirty = false
  } else {
    await handleSaveAs()
  }
}

async function handleSaveAs() {
  const api = window.electronAPI
  if (!api) return
  const savedPath = await api.saveFileDialog(doc.content, `${doc.title}.md`)
  if (savedPath) {
    doc.filePath = savedPath
    doc.title = savedPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') || '未命名文档'
    doc.dirty = false
  }
}

function handleToggleTheme() {
  settings.theme = settings.theme === 'light' ? 'dark' : 'light'
}
function handleToggleSidebar() {
  settings.sidebarVisible = !settings.sidebarVisible
}
function handleToggleMode(mode) {
  settings.mode = mode
}
function handleFocusMode() {
  settings.mode = settings.mode === 'split' ? 'edit' : 'split'
}
function handleZoomIn() {
  settings.zoom = Math.min(2, Math.round((settings.zoom + 0.1) * 10) / 10)
}
function handleZoomOut() {
  settings.zoom = Math.max(0.5, Math.round((settings.zoom - 0.1) * 10) / 10)
}
function handleZoomReset() {
  settings.zoom = 1
}
function handleCursorMove(line, col) {
  status.cursorLine = line
  status.cursorCol = col
}

const actions = {
  handleNew, handleOpen, handleSave, handleSaveAs,
  handleToggleTheme, handleToggleSidebar, handleToggleMode, handleFocusMode
}

provide('settings', settings)
provide('doc', doc)
provide('actions', actions)

const hasEditor = computed(() => ['edit', 'split'].includes(settings.mode))
const hasPreview = computed(() => ['preview', 'split'].includes(settings.mode))

function setupShortcuts() {
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey
    const shift = e.shiftKey
    if (mod && !shift) {
      switch (e.key.toLowerCase()) {
        case 'n': e.preventDefault(); handleNew(); break
        case 'o': e.preventDefault(); handleOpen(); break
        case 's': e.preventDefault(); handleSave(); break
        case 'b': e.preventDefault(); handleToggleSidebar(); break
        case '=': case '+': e.preventDefault(); handleZoomIn(); break
        case '-': case '_': e.preventDefault(); handleZoomOut(); break
        case '0': e.preventDefault(); handleZoomReset(); break
      }
    }
    if (mod && shift) {
      switch (e.key.toLowerCase()) {
        case 's': e.preventDefault(); handleSaveAs(); break
        case 't': e.preventDefault(); handleToggleTheme(); break
        case 'f': e.preventDefault(); handleFocusMode(); break
      }
    }
  })
}

function setupMenuEvents() {
  const api = window.electronAPI
  if (!api) return
  api.onMenu((event) => {
    switch (event) {
      case 'menu:new': handleNew(); break
      case 'menu:open': handleOpen(); break
      case 'menu:save': handleSave(); break
      case 'menu:saveAs': handleSaveAs(); break
      case 'menu:toggleTheme': handleToggleTheme(); break
      case 'menu:focusMode': handleFocusMode(); break
      case 'menu:toggleSidebar': handleToggleSidebar(); break
      case 'menu:zoomIn': handleZoomIn(); break
      case 'menu:zoomOut': handleZoomOut(); break
      case 'menu:zoomReset': handleZoomReset(); break
      case 'menu:help': showToast('帮助文档暂未完成'); break
      case 'menu:about': showAbout.value = true; break
    }
  })
}

onMounted(() => {
  applyTheme(settings.theme)
  nextTick(() => applyZoom(settings.zoom))
  setupShortcuts()
  setupMenuEvents()
  setupUpdaterListeners()
  setupAppListeners()
  updateStatus()

  // 加载真实版本号
  const api = window.electronAPI
  if (api?.getVersion) {
    api.getVersion().then((v) => { appVersion.value = v })
  }

  // ESC 关闭弹窗（changelog 优先）
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (showChangelog.value) {
        showChangelog.value = false
      } else if (showAbout.value) {
        showAbout.value = false
      }
    }
  })

  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY)
    if (saved) {
      // 有 autosave → 恢复上次编辑的内容
      doc.content = saved
      doc.dirty = false
    } else if (!localStorage.getItem(WELCOME_SHOWN_KEY)) {
      // 首次打开 → 显示欢迎文档，之后永远不再自动显示
      doc.content = WELCOME_DOC
      localStorage.setItem(WELCOME_SHOWN_KEY, '1')
    }
    // 否则：blank（新建空白文档）
  } catch (e) {}
})
</script>

<template>
  <div class="app-root">
    <TitleBar :doc="doc" />
    <Toolbar />
    <div class="app-body">
      <Sidebar v-if="settings.sidebarVisible" />
      <div class="main-area" :class="{ 'main-area--split': settings.mode === 'split' }">
        <div v-if="hasEditor" class="pane pane--editor">
          <Editor @cursor-move="handleCursorMove" />
        </div>
        <div v-if="hasPreview" class="pane pane--preview">
          <Preview />
        </div>
      </div>
    </div>
    <footer class="status-bar">
      <span class="status-item">{{ doc.title }}<span v-if="doc.dirty"> *</span></span>
      <span class="status-sep">|</span>
      <span class="status-item">行 {{ status.cursorLine }}, 列 {{ status.cursorCol }}</span>
      <span class="status-sep">|</span>
      <span class="status-item">{{ status.lines }} 行</span>
      <span class="status-sep">|</span>
      <span class="status-item">{{ status.words }} 词</span>
      <span class="status-sep">|</span>
      <span class="status-item">{{ status.chars }} 字符</span>
      <div class="status-spacer"></div>
      <span class="status-item status-item--hint">Ctrl+S 保存 · Ctrl+Shift+T 主题 · Ctrl+B 侧边栏</span>
    </footer>

    <!-- Toast（toolbar 正下方居中） -->
    <Transition name="toast">
      <div v-if="toast.visible" class="toast">{{ toast.text }}</div>
    </Transition>

    <!-- Changelog 弹窗（更新后首次打开） -->
    <Transition name="modal">
      <div v-if="showChangelog" class="modal-overlay" @click.self="showChangelog = false">
        <div class="modal-card changelog-card" role="dialog" aria-modal="true">
          <header class="changelog-header">
            <h2 class="changelog-title">更新已安装</h2>
            <span class="changelog-version">
              {{ changelogData.from }} → {{ changelogData.to }}
            </span>
          </header>
          <div class="changelog-body">
            <div v-if="changelogData.releaseNotes" class="changelog-notes markdown-body" v-html="renderMd(changelogData.releaseNotes)"></div>
            <div v-else class="changelog-notes-empty">
              暂无更新说明。
            </div>
          </div>
          <footer class="changelog-footer">
            <a class="changelog-link" @click="openUrl(GITHUB_RELEASES)">查看完整 Release 历史 ↗</a>
            <button class="btn btn--primary" @click="showChangelog = false">开始使用</button>
          </footer>
        </div>
      </div>
    </Transition>

    <!-- About 弹窗（主题一致） -->
    <Transition name="modal">
      <div v-if="showAbout" class="modal-overlay" @click.self="showAbout = false">
        <div class="modal-card about-card" role="dialog" aria-modal="true">
          <div class="about-hero">
            <img :src="logoUrl" class="about-logo" alt="Lumin logo" />
            <h1 class="about-name">Lumin</h1>
            <p class="about-tagline">专注、优雅的 Markdown 编辑器</p>
          </div>

          <div class="about-meta">
            <div class="about-row">
              <span class="about-row-label">版本</span>
              <span class="about-row-value">v{{ appVersion }}</span>
            </div>
            <div class="about-row">
              <span class="about-row-label">作者</span>
              <span class="about-row-value">Youutaku</span>
            </div>
            <div class="about-row">
              <span class="about-row-label">开源许可证</span>
              <a class="about-link" @click="openUrl(LICENSE_URL); showToast('许可证页面已在浏览器打开')">自定义许可证 ↗</a>
            </div>
          </div>

          <div class="updater-section">
            <!-- 状态行 -->
            <div v-if="updater.state === 'checking'" class="updater-status">
              <span class="updater-spinner"></span>
              正在检查更新...
            </div>
            <div v-else-if="updater.state === 'available'" class="updater-status updater-status--success">
              发现新版本 <strong>v{{ updater.version }}</strong>
            </div>
            <div v-else-if="updater.state === 'not-available'" class="updater-status updater-status--info">
              当前已是最新版本 v{{ appVersion }}
            </div>
            <div v-else-if="updater.state === 'downloaded'" class="updater-status updater-status--success">
              v{{ updater.version }} 已下载完成
            </div>
            <div v-else-if="updater.state === 'error'" class="updater-status updater-status--error">
              更新失败：{{ updater.errorMsg }}
            </div>

            <!-- 进度条 -->
            <div v-if="updater.state === 'downloading'" class="updater-progress">
              <div class="updater-progress-bar" :style="{ width: updater.percent + '%' }"></div>
              <span class="updater-progress-text">{{ updater.percent }}%</span>
            </div>

            <!-- 按钮行 -->
            <div class="about-actions">
              <template v-if="updater.state === 'idle' || updater.state === 'not-available' || updater.state === 'error'">
                <button class="btn btn--primary" :disabled="updater.state === 'checking'" @click="checkUpdate">检查更新</button>
              </template>
              <template v-else-if="updater.state === 'available'">
                <button class="btn btn--primary" @click="downloadUpdate">下载 v{{ updater.version }}</button>
              </template>
              <template v-else-if="updater.state === 'downloaded'">
                <button class="btn btn--primary" @click="installUpdate">立即安装并重启</button>
              </template>
              <template v-else-if="updater.state === 'checking' || updater.state === 'downloading'">
                <button class="btn btn--primary" disabled>
                  {{ updater.state === 'checking' ? '检查中...' : '下载中...' }}
                </button>
              </template>
              <button class="btn btn--ghost" @click="showAbout = false">关闭</button>
            </div>

            <a class="updater-link" @click="openUrl(GITHUB_RELEASES)">查看全部 Releases ↗</a>
          </div>

          <p class="about-copyright">© 2026 Lumin · Built with Electron + Vue 3</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ============ Toast ============ */
.toast {
  position: fixed;
  top: 100px; /* titleBar ~30px + toolbar ~40px + gap ≈ 70 → 从 toolbar 正下方出现 */
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  font-size: 13px;
  font-weight: 500;
  z-index: 9999;
  white-space: nowrap;
  letter-spacing: 0.02em;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 180ms, transform 180ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* ============ Modal Overlay ============ */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

[data-theme="dark"] .modal-overlay {
  background: rgba(0, 0, 0, 0.58);
}

/* ============ Modal Animation ============ */
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal-card,
.modal-leave-to .modal-card {
  transform: scale(0.94) translateY(6px);
  opacity: 0;
}
.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-enter-active .modal-card,
.modal-leave-active .modal-card {
  transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms;
}

/* ============ About Card ============ */
.about-card {
  width: 420px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 36px 32px 28px;
  font-family: var(--font-sans);
  color: var(--text-primary);
}

.about-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.about-logo {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  box-shadow: var(--shadow-md);
  margin-bottom: 14px;
}

.about-name {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 4px 0;
  letter-spacing: 0.02em;
  background: linear-gradient(135deg, var(--accent) 0%, #a497f9 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.about-tagline {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary);
}

.about-meta {
  margin-bottom: 24px;
}

.about-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px dashed var(--border-subtle);
  font-size: 14px;
}

.about-row:last-child {
  border-bottom: none;
}

.about-row-label {
  color: var(--text-tertiary);
  font-weight: 400;
}

.about-row-value {
  color: var(--text-primary);
  font-weight: 500;
}

.about-link {
  color: var(--accent);
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: color 150ms;
}
.about-link:hover {
  color: var(--accent-hover);
  text-decoration: underline;
}

.about-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.btn {
  flex: 1;
  padding: 10px 18px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  border: none;
  transition: background 160ms, transform 80ms, box-shadow 160ms;
}

.btn:active {
  transform: scale(0.97);
}

.btn--primary {
  background: var(--accent);
  color: #fff;
}
.btn--primary:hover {
  background: var(--accent-hover);
  box-shadow: 0 2px 8px rgba(108, 92, 231, 0.35);
}

.btn--ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
}
.btn--ghost:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.about-copyright {
  margin: 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
  letter-spacing: 0.01em;
}

/* ============ Updater ============ */
.updater-section {
  padding-top: 16px;
  border-top: 1px solid var(--border-subtle);
}

.updater-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.updater-status--success {
  color: #16a34a;
}
[data-theme="dark"] .updater-status--success {
  color: #4ade80;
}

.updater-status--info {
  color: var(--text-tertiary);
}

.updater-status--error {
  color: #dc2626;
}
[data-theme="dark"] .updater-status--error {
  color: #f87171;
}

.updater-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-default);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.updater-progress {
  position: relative;
  height: 6px;
  background: var(--bg-elevated);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 10px;
}

.updater-progress-bar {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 200ms ease-out;
}

.updater-progress-text {
  position: absolute;
  right: 0;
  top: 10px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.updater-link {
  display: block;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
  cursor: pointer;
  margin-top: 12px;
  transition: color 150ms;
}
.updater-link:hover {
  color: var(--accent);
}

.about-actions .btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* ============ Changelog 弹窗 ============ */
.changelog-card {
  width: 560px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.changelog-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.changelog-title {
  margin: 0 0 4px;
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
}

.changelog-version {
  font-size: 13px;
  color: var(--accent);
  font-weight: 500;
}

.changelog-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.changelog-notes {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.changelog-notes h2 {
  font-size: 15px;
  margin: 16px 0 8px;
  color: var(--text-primary);
  border-bottom: none;
  padding-bottom: 0;
}

.changelog-notes ul {
  margin: 8px 0;
  padding-left: 20px;
}

.changelog-notes li {
  margin: 4px 0;
}

.changelog-notes-empty {
  text-align: center;
  color: var(--text-tertiary);
  padding: 20px;
  font-size: 13px;
}

.changelog-footer {
  padding: 14px 24px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.changelog-link {
  font-size: 13px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color 150ms;
}
.changelog-link:hover {
  color: var(--accent);
}
</style>
