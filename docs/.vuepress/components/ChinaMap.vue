<template>
  <div class="china-map-wrap">
    <div ref="chartEl" class="china-map" />
    <div v-if="loading" class="china-map-loading">
      加载地图中...
    </div>
    <div v-else-if="error" class="china-map-loading">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import * as echarts from 'echarts'
import { useRouter } from 'vue-router'

// VuePress 的页面里通常有 vue-router，但为避免极端情况下 setup 失败导致组件不渲染，
// 这里对 useRouter 做一次兜底。
let router: any = null
try {
  router = useRouter()
} catch {
  router = null
}
const chartEl = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

let chart: echarts.ECharts | null = null
let onResize: (() => void) | null = null

// Cities with photo pages are determined by existing markdown files:
// docs/cities/<城市名>.md  ->  /cities/<城市名>/
const cityMdModules = (import.meta as any).glob('../../cities/*.md') as Record<string, unknown>

function extractCityName(mdPath: string) {
  const m = mdPath.match(/([^/\\]+)\.md$/)
  return m ? m[1] : mdPath
}

const cityNames = computed(() => Object.keys(cityMdModules).map(extractCityName))

// For cities missing in the remote dataset, keep a small fallback.
// [lon, lat]
const CITY_FALLBACK_CP: Record<string, [number, number]> = {
  邢台: [114.508851, 37.0682],
  宁波: [121.544, 29.868],
  三亚: [109.508268, 18.247872],
  杭州: [120.153576, 30.287459],
}

// Use local static files first to avoid CDN/network instability.
const CHINA_MAP_URL = '/map-data/china.json'
const CHINA_CITIES_URL = '/map-data/china-cities.json'

type Cp = [number, number]
const cityCpByName = new Map<string, Cp>()

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`)
  return (await res.json()) as T
}

function render() {
  if (!chart) return

  const activePoints: Array<{ name: string; value: Cp }> = []
  for (const city of cityNames.value) {
    const cp = cityCpByName.get(city) ?? CITY_FALLBACK_CP[city]
    if (!cp) continue
    activePoints.push({ name: city, value: cp })
  }

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const name = p?.name || ''
        return `<div style="font-size:14px;font-weight:600;margin-bottom:4px;">${name}</div><div style="opacity:.8;">点击查看照片</div>`
      },
    },
    geo: {
      map: 'china',
      roam: false,
      zoom: 1.22,
      center: [104.5, 35.5],
      itemStyle: {
        areaColor: '#141C2B',
        borderColor: '#2E3C57',
        borderWidth: 1,
      },
      emphasis: {
        itemStyle: {
          areaColor: '#1B2740',
        },
      },
    },
    series: [
      {
        name: 'activeCities',
        type: 'effectScatter',
        coordinateSystem: 'geo',
        symbol: 'circle',
        symbolSize: 16,
        cursor: 'pointer',
        zlevel: 10,
        showEffectOn: 'render',
        rippleEffect: {
          period: 3.5,
          scale: 3,
        },
        data: activePoints,
        itemStyle: {
          color: 'rgba(52, 156, 255, 0.35)', // 浅蓝：有照片文件的城市
          borderColor: 'rgba(52, 156, 255, 0.55)',
          borderWidth: 1.5,
          shadowBlur: 8,
          shadowColor: 'rgba(52, 156, 255, 0.25)',
        },
        emphasis: {
          itemStyle: {
            color: 'rgba(0, 89, 255, 0.9)', // 深蓝：鼠标悬停在“亮的区域”上
            borderColor: 'rgba(0, 89, 255, 1)',
            borderWidth: 2.2,
            shadowBlur: 14,
            shadowColor: 'rgba(0, 89, 255, 0.4)',
          },
        },
      },
    ],
    animation: true,
    animationDuration: 550,
    animationEasing: 'cubicOut',
  }

  chart.setOption(option, { notMerge: true })
}

function setupEvents() {
  if (!chart) return

  chart.off('click')
  chart.on('click', (params: any) => {
    if (params?.seriesName !== 'activeCities') return
    const city = String(params?.name || '')
    if (!city) return

    const url = `/cities/${city}/`
    // Click -> jump to city page (prefer vue-router, fallback to full navigation)
    if (router?.push) router.push(url).catch(() => {})
    else window.location.href = url
  })
}

onMounted(async () => {
  if (!chartEl.value) return
  chart = echarts.init(chartEl.value)

  chart.showLoading('default', { text: '加载地图中...' })
  loading.value = true
  error.value = null

  try {
    const chinaMap = await fetchJson<any>(CHINA_MAP_URL)
    echarts.registerMap('china', chinaMap)

    // Parse city center points (best-effort).
    try {
      const chinaCities = await fetchJson<any>(CHINA_CITIES_URL)
      const features = (chinaCities as any)?.features
      if (Array.isArray(features)) {
        for (const f of features) {
          const name: unknown = f?.properties?.name
          const cp: unknown = f?.properties?.cp
          if (typeof name !== 'string') continue
          if (!Array.isArray(cp) || cp.length < 2) continue
          const lon = Number(cp[0])
          const lat = Number(cp[1])
          if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
          cityCpByName.set(name, [lon, lat])
        }
      }
    } catch (e) {
      // Ignore city dataset failures; we can still render active cities using fallback CP.
      // eslint-disable-next-line no-console
      console.warn(e)
    }
  } catch (e: any) {
    // If china map fails, skip render to avoid ECharts geo errors.
    // eslint-disable-next-line no-console
    console.error(e)
    error.value = '地图加载失败。请确认本地 map 数据文件存在：/map-data/china.json'
  } finally {
    loading.value = false
    chart.hideLoading()
    if (!error.value) {
      render()
      setupEvents()
    }
  }

  onResize = () => chart?.resize()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  if (onResize) window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.china-map-wrap {
  position: relative;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  min-height: calc(100vh - 64px);
  background:
    radial-gradient(1200px 600px at 70% 20%, rgba(21, 69, 175, 0.26), transparent 60%),
    radial-gradient(900px 450px at 20% 80%, rgba(16, 118, 255, 0.2), transparent 62%),
    #070b14;
}

.china-map {
  width: 100vw;
  height: calc(100vh - 64px);
}

.china-map-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: rgba(231, 240, 255, 0.82);
  background: rgba(7, 11, 20, 0.58);
  backdrop-filter: blur(4px);
}
</style>