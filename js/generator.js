import { LotteryConfig } from './config.js';
import { analyzeGame, generatePrimes } from './utils.js';

const PRIMES = generatePrimes(LotteryConfig.totalNumbers);

export const GeneratorModule = {
  data() {
    return {
      generatedGame: null,
      generatorModal: null,
      genConfig: { 
        minSum: LotteryConfig.limits.minSum,
        maxSum: LotteryConfig.limits.maxSum,
        evenMin: LotteryConfig.limits.evenMin, evenMax: LotteryConfig.limits.evenMax,
        primeMin: LotteryConfig.limits.primeMin, primeMax: LotteryConfig.limits.primeMax
      }
    };
  },
  methods: {
    openGenerator() {
      if (!this.generatorModal) this.generatorModal = new bootstrap.Modal(document.getElementById('generatorModal'));
      this.generateOptimizedGame();
      this.generatorModal.show();
    },
    isValidGame(nums, config) {
      const stats = analyzeGame(nums, PRIMES);
      if (config.minSum && (stats.sum < config.minSum || stats.sum > config.maxSum)) return false;
      if (config.evenMin !== '' && stats.even < parseInt(config.evenMin)) return false;
      if (config.evenMax !== '' && stats.even > parseInt(config.evenMax)) return false;
      if (config.primeMin !== '' && stats.primes < parseInt(config.primeMin)) return false;
      if (config.primeMax !== '' && stats.primes > parseInt(config.primeMax)) return false;
      return { isValid: true, stats };
    },
    generateOptimizedGame() {
      this.generatedGame = null;
      setTimeout(() => {
        let sortedNumbersList;
        if (this.frequencyTable?.length) {
          sortedNumbersList = [...this.frequencyTable].sort((a, b) => b.count - a.count).map(i => parseInt(i.number));
        } else {
          sortedNumbersList = Array.from({ length: LotteryConfig.totalNumbers }, (_, i) => i + 1);
        }

        const chunks = [];
        const chunkSize = Math.ceil(sortedNumbersList.length / LotteryConfig.pickSize);
        for (let i = 0; i < LotteryConfig.pickSize; i++) {
          chunks.push(sortedNumbersList.slice(i * chunkSize, (i + 1) * chunkSize));
        }

        let bestGame = null;
        let attempts = 0;
        
        while (!bestGame && attempts < 10000) {
          attempts++;
          let candidate = [];

          if (attempts < 2000) {
            candidate = chunks.map(chunk => {
              if (!chunk || !chunk.length) return Math.floor(Math.random() * LotteryConfig.totalNumbers) + 1;
              return chunk[Math.floor(Math.random() * chunk.length)];
            });
          } else {
            const dynamicPool = Math.floor(LotteryConfig.totalNumbers * 0.65);
            const poolSize = Math.min(dynamicPool, sortedNumbersList.length);
            const activePool = sortedNumbersList.slice(0, poolSize);
            while (candidate.length < LotteryConfig.pickSize) {
               const rnd = activePool[Math.floor(Math.random() * activePool.length)];
               if (!candidate.includes(rnd)) candidate.push(rnd);
            }
          }

          candidate = [...new Set(candidate)].sort((a, b) => a - b);
          if (candidate.length !== LotteryConfig.pickSize) continue;

          const check = this.isValidGame(candidate, this.genConfig);
          if (check && check.isValid) {
            bestGame = { numbers: candidate.map(n => n.toString().padStart(2, '0')), ...check.stats };
          }
        }

        if (bestGame) {
          this.generatedGame = bestGame;
        } else {
          alert('Não foi possível gerar um jogo com essas regras. Tente flexibilizar os filtros.');
        }
      }, 50);
    }
  }
};
