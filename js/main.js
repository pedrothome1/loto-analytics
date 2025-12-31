import { getAppData } from './data.js';
import { appComputed } from './computed.js';
import { appMethods } from './methods.js';

const { createApp } = Vue;

createApp({
  data: getAppData, // Sintaxe curta
  watch: {
    sortedResults() { this.currentPage = 1; }
  },
  computed: appComputed,
  methods: appMethods,
}).mount('#app');
