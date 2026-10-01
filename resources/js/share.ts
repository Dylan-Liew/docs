import { createApp } from 'vue';
import Share from './share.vue';

const data = document.getElementById('share-data');
if (data) createApp(Share, JSON.parse(data.textContent ?? '{}')).mount('#app');
