<script setup>
import logoUrl from '../assets/logo.png'

defineProps({
  doc: { type: Object, required: true }
})
</script>

<template>
  <header class="title-bar">
    <div class="title-bar__drag">
      <div class="title-bar__brand">
        <img class="brand-logo" :src="logoUrl" alt="Lumin" />
        <span class="brand-name">Lumin</span>
      </div>
      <div class="title-bar__file" :title="doc.filePath || '未保存'">
        {{ doc.title }}
        <span v-if="doc.dirty" class="dirty-mark">●</span>
      </div>
    </div>
  </header>
</template>
