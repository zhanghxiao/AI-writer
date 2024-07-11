import Vue from 'vue'
import VueRouter from 'vue-router'
import XiaohongshuWriter from '../views/XiaohongshuWriter.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'XiaohongshuWriter',
    component: XiaohongshuWriter
  }
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

export default router