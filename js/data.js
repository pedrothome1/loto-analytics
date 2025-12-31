import { LotteryConfig } from './config.js';

export function getAppData() {
  return {
    loading: false,
    results: [],
    
    sortOrder: 'desc',
    
    filters: {
      startDate: '',
      endDate: '',
      day: '',       
      month: '',     
      year: '',      
      leapYear: false, 
      evenMin: '',
      evenMax: '',
      primeMin: '',
      primeMax: '',
      sumMin: '',    
      sumMax: ''
    },

    freqSortColumn: 'count',
    freqSortOrder: 'desc',
    highlightNum: null,
    currentPage: 1,
    pageSize: LotteryConfig.pageSize,
    
    generatedGame: null,
    generatorModal: null,
    genConfig: { ...LotteryConfig.defaultGenConfig }, 
    
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
    
    visitedBitmap: null,
    combTable: null,
  };
}
