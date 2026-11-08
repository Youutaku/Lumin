<script setup>
import { ref, inject, computed, watch, onMounted, nextTick } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
import katex from 'katex'
import 'katex/dist/katex.min.css'

// Use gfm only — breaks:true mangles $$...$$ math blocks by inserting <br>
marked.setOptions({ gfm: true })

const renderer = new marked.Renderer()

// marked v15+ passes a single token object to renderer methods
renderer.code = function (token) {
  const code = token.text || ''
  const lang = token.lang || ''
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
  try {
    const highlighted = hljs.highlight(code, { language }).value
    return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`
  } catch (e) {
    return `<pre><code>${escapeHtml(code)}</code></pre>`
  }
}

renderer.heading = function (token) {
  const text = token.text || ''
  const depth = token.depth || 1
  const slug = String(text)
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '') || `heading-${Math.random().toString(36).slice(2, 8)}`
  return `<h${depth} id="${slug}"><a href="#${slug}" class="heading-anchor">#</a>${text}</h${depth}>`
}

marked.use({ renderer })

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
}

/**
 * Post-process: replace $$...$$ and $...$ with KaTeX HTML.
 * Operates on marked's HTML output. Must handle the case where
 * block math contains newlines (which marked may or may not convert).
 */
function renderMath(html) {
  // Block math: $$...$$ — allow anything including newlines and <br>
  const blockRe = /\$\$([\s\S]*?)\$\$/g
  // Inline math: $...$ — no newlines inside, must not match $$
  const inlineRe = /\$([^\n$][^\n$]*?)\$/g

  return html
    .replace(blockRe, (_, math) => {
      // Strip any <br> or leftover HTML whitespace inside block math
      const cleaned = math
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      try {
        return katex.renderToString(cleaned, {
          displayMode: true,
          throwOnError: false,
          output: 'html'
        })
      } catch (e) {
        return `<code>$$${math}$$</code>`
      }
    })
    .replace(inlineRe, (match, math) => {
      // Skip if this is actually part of a $$...$$ that wasn't caught (shouldn't happen)
      if (match.startsWith('$$')) return match
      const cleaned = math.trim()
      try {
        return katex.renderToString(cleaned, {
          displayMode: false,
          throwOnError: false,
          output: 'html'
        })
      } catch (e) {
        return `<code>${match}</code>`
      }
    })
}

const doc = inject('doc')
const previewEl = ref(null)

const rendered = computed(() => {
  try {
    const html = marked.parse(doc.content)
    return renderMath(html)
  } catch (e) {
    return `<p class="error">渲染错误: ${e.message}</p>`
  }
})

watch(rendered, () => {
  nextTick(renderMermaid)
})

async function renderMermaid() {
  if (!previewEl.value) return
  const codeBlocks = previewEl.value.querySelectorAll('pre code.language-mermaid')
  if (!codeBlocks.length) return
  let mermaidMod = null
  try {
    mermaidMod = await import('mermaid')
  } catch (e) {
    return
  }
  const mermaid = mermaidMod.default || mermaidMod
  mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' })
  for (const block of codeBlocks) {
    const code = block.textContent || ''
    try {
      const container = document.createElement('div')
      container.className = 'mermaid'
      const id = 'mermaid-' + Math.random().toString(36).slice(2, 8)
      const { svg } = await mermaid.render(id, code)
      const pre = block.closest('pre')
      if (pre && pre.parentNode) {
        pre.parentNode.replaceChild(container, pre)
        container.innerHTML = svg
      }
    } catch (e) {
      // leave as code block
    }
  }
}

onMounted(() => {
  nextTick(renderMermaid)
})
</script>

<template>
  <div ref="previewEl" class="markdown-body" v-html="rendered"></div>
</template>
