import Vue from 'vue'
import App from './App.vue'
import router from './router'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'

Vue.config.productionTip = false
Vue.use(ElementUI)

console.log('VUE_APP_API_BASE_URL:', process.env.VUE_APP_API_BASE_URL)
console.log('VUE_APP_API_KEY:', process.env.VUE_APP_API_KEY)
console.log('VUE_APP_TEXT_MODELS:', process.env.VUE_APP_TEXT_MODELS)
console.log('VUE_APP_VISION_MODELS:', process.env.VUE_APP_VISION_MODELS)

new Vue({
  router,
  render: h => h(App)
}).$mount('#app')