<script setup>
import { ref, inject, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

const emit = defineEmits(['cursor-move'])
const settings = inject('settings')
const doc = inject('doc')

const container = ref(null)
let editor = null
let suppressChange = false
let monacoModule = null

async function initMonaco() {
  if (!container.value) return
  const monaco = await import('monaco-editor/esm/vs/editor/editor.api')
  monacoModule = monaco

  const isDark = settings.theme === 'dark'
  const initFontSize = Math.round(settings.fontSize * (settings.zoom || 1))

  editor = monaco.editor.create(container.value, {
    value: doc.content,
    language: 'markdown',
    theme: isDark ? 'vs-dark' : 'vs',
    fontSize: initFontSize,
    lineHeight: Math.round(initFontSize * settings.lineHeight),
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, Menlo, monospace",
    fontLigatures: true,
    wordWrap: settings.wordWrap ? 'on' : 'off',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    renderLineHighlight: 'line',
    renderWhitespace: 'none',
    showFoldingControls: 'always',
    folding: true,
    foldingHighlight: true,
    automaticLayout: true,
    tabSize: 2,
    insertSpaces: true,
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indentation: true },
    padding: { top: 24, bottom: 24 },
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true
  })

  monaco.languages.setMonarchTokensProvider('markdown', {
    tokenizer: {
      root: [
        [/^\s*#.*/, 'keyword'],
        [/^\s*>\s.*/, 'string'],
        [/^\s*[-*+]\s.*/, 'number'],
        [/^\s*\d+\.\s.*/, 'number'],
        [/^```.*/, 'type', '@code'],
        [/`[^`]+`/, 'string'],
        [/\*\*[^*]+\*\*/, 'strong'],
        [/\*[^*]+\*/, 'emphasis'],
        [/\[[^\]]+\]\([^)]+\)/, 'link'],
        [/!\[[^\]]*\]\([^)]+\)/, 'link'],
        [/\$[^$]+\$/, 'constant']
      ],
      code: [
        [/```.*/, 'type', '@pop'],
        [/.*/, 'variable.default']
      ]
    }
  })

  editor.onDidChangeModelContent(() => {
    if (suppressChange) return
    suppressChange = true
    doc.content = editor.getValue()
    suppressChange = false
  })

  editor.onDidChangeCursorPosition((e) => {
    emit('cursor-move', e.position.lineNumber, e.position.column)
  })
}

watch(() => settings.theme, (theme) => {
  nextTick(() => {
    if (editor && monacoModule) {
      monacoModule.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs')
    }
  })
})

const getEditorFontSize = () =>
  Math.round(settings.fontSize * (settings.zoom || 1))

watch([() => settings.fontSize, () => settings.zoom], () => {
  if (editor) {
    const size = getEditorFontSize()
    editor.updateOptions({
      fontSize: size,
      lineHeight: Math.round(size * settings.lineHeight)
    })
  }
})

watch(() => doc.content, (newVal) => {
  if (!editor) return
  suppressChange = true
  const current = editor.getValue()
  if (current !== newVal) {
    const pos = editor.getPosition()
    editor.setValue(newVal)
    if (pos) editor.setPosition(pos)
  }
  suppressChange = false
})

onMounted(() => {
  nextTick(initMonaco)
})

onBeforeUnmount(() => {
  if (editor) {
    editor.dispose()
    editor = null
  }
})
</script>

<template>
  <div ref="container" class="editor-container"></div>
</template>
