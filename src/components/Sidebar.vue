<script setup>
import { inject, computed } from 'vue'

function parseHeadings(md) {
  const lines = md.split('\n')
  const headings = []
  const seen = new Map()
  let inCode = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().startsWith('```')) {
      inCode = !inCode
      continue
    }
    if (inCode) continue

    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (!match) continue

    const level = match[1].length
    const rawText = match[2].trim()
    let slug = rawText
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '')
    if (!slug) slug = `heading-${i}`

    if (seen.has(slug)) {
      seen.set(slug, seen.get(slug) + 1)
      slug = `${slug}-${seen.get(slug)}`
    } else {
      seen.set(slug, 0)
    }

    headings.push({ level, text: rawText, slug, line: i })
  }
  return headings
}

const doc = inject('doc')
const headings = computed(() => parseHeadings(doc.content))

function scrollToHeading(slug) {
  const el = document.getElementById(slug)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__header">
      <span>大纲</span>
      <span class="sidebar__count">{{ headings.length }}</span>
    </div>
    <nav v-if="headings.length" class="outline">
      <button
        v-for="h in headings"
        :key="h.slug"
        class="outline__item"
        :style="{ paddingLeft: (h.level - 1) * 16 + 12 + 'px' }"
        @click="scrollToHeading(h.slug)"
        :title="h.text"
      >
        <span class="outline__marker" :class="'outline__marker--h' + h.level"></span>
        <span class="outline__text">{{ h.text }}</span>
      </button>
    </nav>
    <div v-else class="sidebar__empty">
      <p>暂无标题</p>
      <p class="hint">在文档中使用 # 创建标题</p>
    </div>
  </aside>
</template>
