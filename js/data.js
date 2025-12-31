import { LotteryConfig } from './config.js';

export function getAppData() {
  return {
    loading: false,
    results: [],
    
    // UI State
    sortOrder: 'desc',
    filterStartDate: '',
    freqSortColumn: 'count',
    freqSortOrder: 'desc',
    highlightNum: null,
    currentPage: 1,
    pageSize: LotteryConfig.pageSize,
    
    // Modals & Features
    generatedGame: null,
    generatorModal: null,
    genConfig: { ...LotteryConfig.defaultGenConfig }, // Clone para evitar mutação da config
    
    detailsModal: null,
    selectedDetails: null,
    previousGamesCount: 0,
    
    simModal: null,
    simState: {
      running: false,
      attempts: 0,
      startTime: null,
      elapsedTime: '00:00',
      targetGame: null,
      bestTry: null,
      quintilePattern: [],
      chunks: [],
    },
    
    // Optimization
    visitedBitmap: null,
    combTable: null,
  };
}
