<template>
  <div class="lazy-gallery" :style="gridStyle">
    <div
      v-for="(img, index) in images"
      :key="index"
      class="lazy-image-item"
      @click="openPreview(index)"
    >
      <img
        v-if="loadedImages.has(index) || !lazy"
        :src="img.thumb || img.src"
        :alt="img.alt || `照片${index + 1}`"
        loading="lazy"
      />
      <div v-else class="lazy-placeholder">
        <div class="lazy-loading">
          <svg viewBox="0 0 24 24" width="32" height="32">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="31.4 31.4" class="spinner" />
          </svg>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="previewVisible" class="preview-overlay" @click="closePreview">
        <button class="preview-close" @click="closePreview">×</button>
        <button v-if="previewIndex > 0" class="preview-prev" @click.stop="prev">‹</button>
        <img :src="currentImage?.full || currentImage?.src" class="preview-image" @click.stop />
        <button v-if="previewIndex < images.length - 1" class="preview-next" @click.stop="next">›</button>
        <div class="preview-info">{{ previewIndex + 1 }} / {{ images.length }}</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

interface ImageItem {
  src: string
  thumb?: string
  full?: string
  alt?: string
}

const props = withDefaults(defineProps<{
  images: ImageItem[]
  cols?: number | string
  lazy?: boolean
  gap?: number | string
}>(), {
  cols: 'auto-fit',
  lazy: true,
  gap: 12,
})

const gridStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${props.cols}, 1fr)`,
  gap: `${props.gap}px`,
}))

const loadedImages = ref(new Set<number>())
const previewVisible = ref(false)
const previewIndex = ref(0)

const currentImage = computed(() => props.images[previewIndex.value])

function loadImage(index: number) {
  if (!props.lazy) return
  const img = new Image()
  img.onload = () => loadedImages.value.add(index)
  img.src = props.images[index].thumb || props.images[index].src
}

function openPreview(index: number) {
  if (props.images[index].full) {
    const fullImg = new Image()
    fullImg.onload = () => {
      previewIndex.value = index
      previewVisible.value = true
    }
    fullImg.src = props.images[index].full!
  } else {
    previewIndex.value = index
    previewVisible.value = true
  }
}

function closePreview() {
  previewVisible.value = false
}

function prev() {
  if (previewIndex.value > 0) {
    openPreview(previewIndex.value - 1)
  }
}

function next() {
  if (previewIndex.value < props.images.length - 1) {
    openPreview(previewIndex.value + 1)
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (!previewVisible.value) return
  if (e.key === 'Escape') closePreview()
  if (e.key === 'ArrowLeft') prev()
  if (e.key === 'ArrowRight') next()
}

onMounted(() => {
  if (props.lazy) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number((entry.target as HTMLElement).dataset.index)
            loadImage(index)
            observer.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '100px' }
    )

    document.querySelectorAll('.lazy-image-item').forEach((el) => {
      observer.observe(el)
    })
  }

  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.lazy-gallery {
  margin-top: 16px;
}

.lazy-image-item {
  position: relative;
  aspect-ratio: 3 / 2;
  overflow: hidden;
  border-radius: 8px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.05);
}

.lazy-image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.lazy-image-item:hover img {
  transform: scale(1.05);
}

.lazy-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lazy-loading {
  color: rgba(255, 255, 255, 0.3);
}

.spinner {
  animation: spin 1s linear infinite;
  transform-origin: center;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.preview-image {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
}

.preview-close {
  position: absolute;
  top: 20px;
  right: 30px;
  font-size: 40px;
  color: white;
  background: none;
  border: none;
  cursor: pointer;
  width: 50px;
  height: 50px;
  line-height: 1;
}

.preview-prev,
.preview-next {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  font-size: 60px;
  color: white;
  background: none;
  border: none;
  cursor: pointer;
  padding: 20px;
}

.preview-prev { left: 20px; }
.preview-next { right: 20px; }

.preview-info {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}
</style>
