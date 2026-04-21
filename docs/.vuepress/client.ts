import { defineClientConfig } from 'vuepress/client'
import ChinaMap from './components/ChinaMap.vue'
import LazyGallery from './components/LazyGallery.vue'

import './theme/styles/custom.css'

export default defineClientConfig({
  enhance({ app }) {
    app.component('ChinaMap', ChinaMap)
    app.component('LazyGallery', LazyGallery)
  },
})
