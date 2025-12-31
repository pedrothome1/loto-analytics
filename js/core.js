import { LotteryPresets } from './config.js';
import { generatePrimes, analyzeGame } from './utils.js';

export const CoreModule = {
  data() {
    return {
      lotteryConfig: { ...LotteryPresets.quina },
      presets: LotteryPresets,
      loading: false,
      results: [],
      resultsCache: {}, // NOVO: Guarda os dados de cada loteria
      visitedBitmap: null,
      combTable: null
    };
  },
  computed: {
    primes() {
      return generatePrimes(this.lotteryConfig.totalNumbers);
    }
  },
  methods: {
    setLottery(key) {
      if (!this.presets[key]) return;
      this.lotteryConfig = { ...this.presets[key] };
      
      // ALTERADO: Recupera do cache se existir, senão inicia vazio
      this.results = this.resultsCache[key] || [];
      
      // Reseta estruturas auxiliares (mas mantém os dados)
      this.visitedBitmap = null;
      this.combTable = null;
      
      // Limpa filtros e simulações anteriores para evitar confusão visual
      if (this.cleanFilters) this.cleanFilters();
      if (this.resetSim) this.resetSim();
      
      // Atualiza configs do gerador
      if (this.genConfig) {
        this.genConfig.minSum = this.lotteryConfig.limits.minSum;
        this.genConfig.maxSum = this.lotteryConfig.limits.maxSum;
      }
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

      console.log("📂 Arquivo:", file.name, "| Tamanho:", file.size);
      
      if (file.size === 0) {
        alert("O arquivo parece vazio (0 bytes).\n\nDICA: Se estiver no Google Drive/Planilhas, use 'Salvar como' > 'CSV' e tente novamente.");
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
            // Proteção contra HTML
            if (res.data.length > 0 && res.data[0][0] && res.data[0][0].includes('<html')) {
               alert("O arquivo é um HTML, não CSV. Baixe novamente.");
               this.loading = false;
               return;
            }

            this.results = res.data.slice(1).map((row) => {
                const pick = this.lotteryConfig.pickSize;
                
                // --- MODO ESTRITO ---
                // Verifica se a linha tem tamanho mínimo (ID + Data + Bolas)
                if (row.length < 2 + pick) return null;

                // Corta EXATAMENTE as colunas logo após a data (índices 2 até 2+pick)
                const rawFixed = row.slice(2, 2 + pick);

                // Valida cada item desse corte
                const validNumbers = [];
                for (let val of rawFixed) {
                    const num = parseInt(val);
                    // Se não for número ou estiver fora do limite (ex: 61 na Mega), a linha é lixo
                    if (isNaN(num) || num < 1 || num > this.lotteryConfig.totalNumbers) {
                        return null; 
                    }
                    validNumbers.push(num.toString().padStart(2, '0'));
                }

                // Ordena os números encontrados
                const foundNumbers = validNumbers.sort((a, b) => a - b);

                // Parse da Data
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
            
            this.resultsCache[this.lotteryConfig.id] = this.results;
            
            this.loading = false;
            this.currentPage = 1;

            if (this.results.length === 0) {
                alert("Nenhum jogo válido encontrado.\n\nVerifique:\n1. Se escolheu a Loteria certa no menu.\n2. Se o CSV tem o formato: Concurso;Data;Bola1;Bola2...");
            } else {
                // Feedback visual para confirmar que deu certo
                console.log(`✅ ${this.results.length} jogos importados com SUCESSO!`);
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
