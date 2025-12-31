import { LotteryConfig } from './config.js';

export function getAppData() {
  return {
    loading: false,
    results: [],
    sortOrder: 'desc',
    
    filters: {
      startDate: '', endDate: '', day: '', month: '', year: '', leapYear: false, 
      evenMin: '', evenMax: '', 
      primeMin: '', primeMax: '', 
      sumMin: '', sumMax: ''
    },

    freqSortColumn: 'count',
    freqSortOrder: 'desc',
    highlightNum: null,
    currentPage: 1,
    pageSize: LotteryConfig.pageSize,
    
    generatedGame: null,
    generatorModal: null,
    
    // CORREÇÃO: Usa 'limits' da config, não values hardcoded
    genConfig: { 
      minSum: LotteryConfig.limits.minSum,
      maxSum: LotteryConfig.limits.maxSum,
      evenMin: LotteryConfig.limits.evenMin, evenMax: LotteryConfig.limits.evenMax,
      primeMin: LotteryConfig.limits.primeMin, primeMax: LotteryConfig.limits.primeMax
    }, 
    
    detailsModal: null,
    selectedDetails: null,
    previousGamesCount: 0,
    
    simModal: null,
    simState: {
      running: false,
      mode: 'smart',
      attempts: 0,
      startTime: null,
      elapsedTime: '00:00',
      targetGame: null,
      bestTry: null,
      quintilePattern: [],
      chunks: [],
      // CORREÇÃO: Inicializa com base na config da loteria atual
      customConfig: {
        minSum: LotteryConfig.limits.minSum, 
        maxSum: LotteryConfig.limits.maxSum,
        evenMin: LotteryConfig.limits.evenMin, evenMax: LotteryConfig.limits.evenMax,
        primeMin: LotteryConfig.limits.primeMin, primeMax: LotteryConfig.limits.primeMax
      },
    },
    
    visitedBitmap: null,
    combTable: null,
    
    // Helper para expor config no template (HTML)
    lotteryConfig: LotteryConfig 
  };
}
