import { LotteryPresets } from './config.js';
import { generatePrimes, analyzeGame } from './utils.js';
import { StorageService } from './storage.js';

export const CoreModule = {
  data() {
    return {
      lotteryConfig: { ...LotteryPresets.quina },
      presets: LotteryPresets,
      loading: false,
      results: [],
      resultsCache: {}, 
      visitedBitmap: null,
      combTable: null
    };
  },
  
  async created() {
    // Ao iniciar o app, carrega a última loteria usada
    try {
      await StorageService.init();
      const lastId = await StorageService.get('settings', 'lastLotteryId');
      
      if (lastId && this.presets[lastId]) {
        // Usa setLottery mas evita loop de salvar 'lastLotteryId' imediatamente
        await this.loadLotteryData(lastId);
      } else {
        await this.loadLotteryData('quina');
      }
    } catch (e) {
      console.error("Erro ao iniciar DB", e);
    }
  },

  computed: {
    primes() {
      return generatePrimes(this.lotteryConfig.totalNumbers);
    }
  },
  
  methods: {
    // Wrapper para trocar de loteria e salvar a preferência
    setLottery(key) {
      this.loadLotteryData(key);
      StorageService.set('settings', 'lastLotteryId', key);
    },

    async loadLotteryData(key) {
      if (!this.presets[key]) return;
      
      this.loading = true;
      this.lotteryConfig = { ...this.presets[key] };
      
      // 1. Tenta Cache de Memória (Rápido)
      if (this.resultsCache[key]) {
        this.results = this.resultsCache[key];
      } else {
        // 2. Tenta IndexedDB (Persistente)
        const savedResults = await StorageService.get('results', key);
        if (savedResults) {
          this.results = savedResults;
          this.resultsCache[key] = savedResults;
        } else {
          this.results = [];
        }
      }

      // 3. Restaura Filtros salvos para esta loteria (se houver)
      const savedFilters = await StorageService.get('settings', `filters_${key}`);
      if (savedFilters && this.restoreFilters) {
        this.restoreFilters(savedFilters);
      } else if (this.cleanFilters) {
        this.cleanFilters();
      }

      // 4. Restaura Config do Gerador
      const savedGenConfig = await StorageService.get('settings', `gen_${key}`);
      if (savedGenConfig && this.genConfig) {
        Object.assign(this.genConfig, savedGenConfig);
      } else if (this.genConfig) {
        // Reset gen config defaults
        this.genConfig.minSum = this.lotteryConfig.limits.minSum;
        this.genConfig.maxSum = this.lotteryConfig.limits.maxSum;
      }
      
      // Reset de auxiliares
      this.visitedBitmap = null;
      this.combTable = null;
      if (this.resetSim) this.resetSim();

      this.loading = false;
    },

    initBitSetSystem() {
      const n = this.lotteryConfig.totalNumbers;
      const k = this.lotteryConfig.pickSize;
      
      this.combTable = Array(n + 1).fill(0).map(() => Array(k + 1).fill(0));
      for (let i = 0; i <= n; i++) {
        this.combTable[i][0] = 1;
        for (let j = 1; j <= Math.min(i, k); j++) {
          this.combTable[i][j] = this.combTable[i-1][j-1] + this.combTable[i-1][j];
        }
      }

      try {
        const totalCombs = this.combTable[n][k];
        const byteSize = Math.ceil(totalCombs / 8);
        if (byteSize > 50 * 1024 * 1024) throw new Error("Muito grande");
        this.visitedBitmap = new Uint8Array(byteSize);
      } catch (e) {
        console.warn("BitSet desativado: Memória insuficiente.");
        this.visitedBitmap = null;
      }
    },

    getGameIndex(nums) {
      if (!this.combTable) return -1;
      let idx = 0;
      for (let i = 0; i < this.lotteryConfig.pickSize; i++) {
        idx += this.combTable[nums[i] - 1][i + 1];
      }
      return idx;
    },

    handleFileUpload(e) {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size === 0) {
        alert("O arquivo parece vazio (0 bytes).\n\nDICA: Se estiver no Google Drive/Planilhas, use 'Salvar como' > 'CSV'.");
        e.target.value = '';
        return;
      }

      this.loading = true;
      e.target.value = ''; 

      const reader = new FileReader();

      reader.onload = (evt) => {
        const csvText = evt.target.result;
        
        Papa.parse(csvText, {
          header: false,
          skipEmptyLines: true,
          complete: (res) => {
            if (res.data.length > 0 && res.data[0][0] && res.data[0][0].includes('<html')) {
               alert("O arquivo é um HTML, não CSV. Baixe novamente.");
               this.loading = false;
               return;
            }

            const parsedResults = res.data.slice(1).map((row) => {
                const pick = this.lotteryConfig.pickSize;
                
                if (row.length < 2 + pick) return null;

                const rawFixed = row.slice(2, 2 + pick);
                const validNumbers = [];
                for (let val of rawFixed) {
                    const num = parseInt(val);
                    if (isNaN(num) || num < 1 || num > this.lotteryConfig.totalNumbers) return null; 
                    validNumbers.push(num.toString().padStart(2, '0'));
                }

                const foundNumbers = validNumbers.sort((a, b) => a - b);
                const [day, month, year] = row[1].split('/');
                if (!year) return null;
                
                const dateObj = new Date(year, month - 1, day);
                const stats = analyzeGame(foundNumbers, this.primes); 

                return {
                  game: row[0],
                  date: row[1],
                  numbers: foundNumbers,
                  stats: {
                    ...stats,
                    d: parseInt(day), m: parseInt(month), y: parseInt(year),
                    time: dateObj.setHours(0,0,0,0),
                    isLeap: (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
                  }
                };
            }).filter(Boolean);
            
            // Atualiza memória
            this.results = parsedResults;
            this.resultsCache[this.lotteryConfig.id] = parsedResults;
            
            // Persiste no IndexedDB
            StorageService.set('results', this.lotteryConfig.id, parsedResults)
              .then(() => console.log("Dados salvos no disco com sucesso!"));
            
            this.loading = false;
            this.currentPage = 1;

            if (this.results.length === 0) {
                alert("Nenhum jogo válido encontrado.");
            }
          }
        });
      };

      reader.onerror = () => {
          alert("Erro de leitura do arquivo.");
          this.loading = false;
      };

      reader.readAsText(file, "ISO-8859-1");
    }
  }
};
