import { createApp } from 'vue';
import '@cards/ui/theme.css';
import App from './App.vue';
import { router } from './router';

createApp(App).use(router).mount('#app');
