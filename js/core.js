import { LotteryConfig } from './config.js';
import { generatePrimes, analyzeGame } from './utils.js';

const PRIMES = generatePrimes(LotteryConfig.totalNumbers);

export const CoreModule = {
  data() {
    return {
      loading: false,
      results: [],
      visitedBitmap: null,
      combTable: null,
      lotteryConfig: LotteryConfig 
    };
  },
  methods: {
    initBitSetSystem() {
      const n = LotteryConfig.totalNumbers;
      const k = LotteryConfig.pickSize;
      
      this.combTable = Array(n + 1).fill(0).map(() => Array(k + 1).fill(0));
      for (let i = 0; i <= n; i++) {
        this.combTable[i][0] = 1;
        for (let j = 1; j <= Math.min(i, k); j++) {
          this.combTable[i][j] = this.combTable[i-1][j-1] + this.combTable[i-1][j];
        }
      }

      if (!this.visitedBitmap) {
        const totalCombs = this.combTable[n][k];
        const byteSize = Math.ceil(totalCombs / 8);
        this.visitedBitmap = new Uint8Array(byteSize);
      } else {
        this.visitedBitmap.fill(0);
      }
    },
    getGameIndex(nums) {
      let idx = 0;
      for (let i = 0; i < LotteryConfig.pickSize; i++) {
        idx += this.combTable[nums[i] - 1][i + 1];
      }
      return idx;
    },
    handleFileUpload(e) {
      const file = e.target.files[0];
      if (!file) return;

      this.loading = true;
      this.results = [];
      
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (res) => {
          this.results = res.data.slice(1).map(row => {
            if (row.length < 3) return null;
            
            const nums = row.slice(2, 2 + LotteryConfig.pickSize)
                            .map(n => parseInt(n).toString().padStart(2, '0'))
                            .sort((a, b) => a - b);
            
            const [day, month, year] = row[1].split('/');
            const dateObj = new Date(year, month - 1, day);
            const stats = analyzeGame(nums, PRIMES); 

            return {
              game: row[0],
              date: row[1],
              numbers: nums,
              stats: {
                ...stats,
                d: parseInt(day), m: parseInt(month), y: parseInt(year),
                time: dateObj.setHours(0,0,0,0),
                isLeap: (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
              }
            };
          }).filter(Boolean);
          
          this.loading = false;
          this.currentPage = 1; // Reseta UI
        }
      });
    }
  }
};
