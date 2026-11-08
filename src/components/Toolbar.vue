<script setup>
import { inject } from 'vue'

const actions = inject('actions')
const settings = inject('settings')

const modes = [
  { key: 'edit', icon: '✎', label: '编辑' },
  { key: 'split', icon: '⇄', label: '分屏' },
  { key: 'preview', icon: '◉', label: '预览' }
]
</script>

<template>
  <div class="toolbar">
    <div class="toolbar__group">
      <button class="tool-btn" title="新建 (Ctrl+N)" @click="actions.handleNew">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
        <span>新建</span>
      </button>
      <button class="tool-btn" title="打开 (Ctrl+O)" @click="actions.handleOpen">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span>打开</span>
      </button>
      <button class="tool-btn" title="保存 (Ctrl+S)" @click="actions.handleSave">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        <span>保存</span>
      </button>
    </div>

    <div class="toolbar__sep"></div>

    <div class="toolbar__group toolbar__group--segmented">
      <button
        v-for="m in modes"
        :key="m.key"
        class="tool-btn tool-btn--segmented"
        :class="{ 'is-active': settings.mode === m.key }"
        :title="m.label"
        @click="actions.handleToggleMode(m.key)"
      >
        <span class="seg-icon">{{ m.icon }}</span>
        <span class="seg-label">{{ m.label }}</span>
      </button>
    </div>

    <div class="toolbar__spacer"></div>

    <div class="toolbar__group">
      <button class="tool-btn" :title="settings.sidebarVisible ? '隐藏侧边栏 (Ctrl+B)' : '显示侧边栏 (Ctrl+B)'" @click="actions.handleToggleSidebar">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
      </button>
      <button class="tool-btn" :title="settings.theme === 'light' ? '切换到暗色 (Ctrl+Shift+T)' : '切换到亮色 (Ctrl+Shift+T)'" @click="actions.handleToggleTheme">
        <svg v-if="settings.theme === 'light'" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
      </button>
    </div>
  </div>
</template>
