import { getAppData } from './data.js';
import { appComputed } from './computed.js';
import { appMethods } from './methods.js';

const { createApp } = Vue;

createApp({
  data() {
    return getAppData();
  },
  watch: {
    sortedResults() {
      this.currentPage = 1;
    },
  },
  computed: appComputed,
  methods: appMethods,
}).mount('#app');
