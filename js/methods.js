import { LotteryConfig } from './config.js';
import { getHeatMapColor, generatePrimes, analyzeGame, formatTime } from './utils.js';

const PRIMES = generatePrimes(LotteryConfig.totalNumbers);

export const appMethods = {
  // Inicializa Tabela Combinatória e BitSet dinamicamente
  initBitSetSystem() {
    const n = LotteryConfig.totalNumbers;
    const k = LotteryConfig.pickSize;
    
    // Tabela Pascal C(n, k)
    this.combTable = Array(n + 1).fill(0).map(() => Array(k + 1).fill(0));
    for (let i = 0; i <= n; i++) {
      this.combTable[i][0] = 1;
      for (let j = 1; j <= Math.min(i, k); j++) {
        this.combTable[i][j] = this.combTable[i-1][j-1] + this.combTable[i-1][j];
      }
    }

    if (!this.visitedBitmap) {
      // Calcula total de combinações: C(n, k)
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

  openDetails(row) {
    const gameId = parseInt(row.game);
    const games = this.filterPastGames(gameId);

    this.previousGamesCount = games.length;

    // Mapa de Frequência Local
    const counts = {};
    games.forEach(g => g.numbers.forEach(n => counts[n] = (counts[n] || 0) + 1));
    row.numbers.forEach(n => counts[n] = counts[n] || 0);

    const vals = Object.values(counts);
    const min = Math.min(...vals);
    const max = Math.max(...vals);

    const stats = analyzeGame(row.numbers, PRIMES);

    this.selectedDetails = {
      ...row,
      ...stats,
      numbersWithColor: row.numbers.map(n => ({
        val: n,
        style: getHeatMapColor(counts[n], min, max).bg ? 
               { backgroundColor: getHeatMapColor(counts[n], min, max).bg, color: getHeatMapColor(counts[n], min, max).text } : {}
      }))
    };

    if (!this.detailsModal) this.detailsModal = new bootstrap.Modal(document.getElementById('detailsModal'));
    this.detailsModal.show();
  },

  // Helper para filtrar jogos anteriores (reutilizado)
  filterPastGames(currentGameId) {
    let filterTime = null;
    if (this.filterStartDate) {
      const [y, m, d] = this.filterStartDate.split('-');
      filterTime = new Date(y, m - 1, d).setHours(0,0,0,0);
    }

    return this.results.filter(r => {
      if (parseInt(r.game) >= currentGameId) return false;
      if (filterTime) {
        const [d, m, y] = r.date.split('/');
        if (new Date(y, m - 1, d).setHours(0,0,0,0) < filterTime) return false;
      }
      return true;
    });
  },

  getNumberStyle(numStr) {
    const item = this.frequencyTable?.find(i => i.number === numStr);
    return item ? item.style : {};
  },

  // Stats genérico mantido, mas limpo
  genericStats(countFn, labelFn, sortKey) {
    if (!this.sortedResults.length) return [];
    const stats = {};
    const total = this.sortedResults.length;

    this.sortedResults.forEach(r => {
      const val = countFn(r);
      const key = labelFn(val);
      if (!stats[key]) stats[key] = { count: 0, [sortKey]: val };
      stats[key].count++;
    });

    return Object.keys(stats).map(k => ({
      label: k,
      count: stats[k].count,
      percent: ((stats[k].count / total) * 100).toFixed(1),
      [sortKey]: stats[k][sortKey]
    })).sort((a, b) => a[sortKey] - b[sortKey]);
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
          return {
            game: row[0],
            date: row[1],
            numbers: row.slice(2, 2 + LotteryConfig.pickSize)
                        .map(n => parseInt(n).toString().padStart(2, '0'))
                        .sort((a, b) => a - b)
          };
        }).filter(Boolean);
        
        this.loading = false;
        this.currentPage = 1;
      }
    });
  },

  toggleSort() {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
  },

  sortFrequency(col) {
    if (this.freqSortColumn === col) {
      this.freqSortOrder = this.freqSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.freqSortColumn = col;
      this.freqSortOrder = 'desc';
    }
  },

  cleanFilters() {
    this.filterStartDate = '';
  },

  toggleHighlight(num) {
    this.highlightNum = this.highlightNum === num ? null : num;
  },

  nextPage() {
    if (this.currentPage < this.totalPages) this.changePage(1);
  },

  prevPage() {
    if (this.currentPage > 1) this.changePage(-1);
  },

  changePage(dir) {
    this.currentPage += dir;
    document.getElementById('tabela-topo')?.scrollIntoView({ behavior: 'smooth' });
  },

  getProgressBarColor(p) {
    return p > 30 ? 'bg-success' : p > 15 ? 'bg-info' : 'bg-secondary';
  },

  openGenerator() {
    if (!this.generatorModal) this.generatorModal = new bootstrap.Modal(document.getElementById('generatorModal'));
    this.generateOptimizedGame();
    this.generatorModal.show();
  },

  // Validador compartilhado entre Gerador e Simulação
  isValidGame(nums, config) {
    const stats = analyzeGame(nums, PRIMES);
    
    // Soma
    if (config.minSum && (stats.sum < config.minSum || stats.sum > config.maxSum)) return false;
    
    // Pares
    if (config.evenCount !== 'any') {
      if (stats.even !== parseInt(config.evenCount)) return false;
    } else {
      // Regra básica: evitar todos pares ou todos ímpares
      if (stats.even === 0 || stats.even === LotteryConfig.pickSize) return false;
    }

    // Primos
    if (config.primeCount !== 'any') {
      if (stats.primes !== parseInt(config.primeCount)) return false;
    } else {
      if (stats.primes > Math.ceil(LotteryConfig.pickSize / 1.5)) return false;
    }

    return { isValid: true, stats };
  },

  generateOptimizedGame() {
    this.generatedGame = null;

    setTimeout(() => {
      // Prepara pool de números baseada em frequência
      let pool;
      if (this.frequencyTable?.length) {
        pool = [...this.frequencyTable].sort((a, b) => b.count - a.count).map(i => parseInt(i.number));
      } else {
        pool = Array.from({ length: LotteryConfig.totalNumbers }, (_, i) => i + 1);
      }

      // Cria chunks (quintis)
      const chunkSize = Math.ceil(pool.length / LotteryConfig.pickSize);
      const chunks = [];
      for (let i = 0; i < LotteryConfig.pickSize; i++) {
        chunks.push(pool.slice(i * chunkSize, (i + 1) * chunkSize));
      }

      let best = null;
      let attempts = 0;

      while (!best && attempts < 5000) {
        attempts++;
        
        // Sorteia 1 de cada chunk para garantir espalhamento
        let candidate = chunks.map(chunk => {
          return chunk.length ? chunk[Math.floor(Math.random() * chunk.length)] : Math.floor(Math.random() * LotteryConfig.totalNumbers) + 1;
        });

        candidate = [...new Set(candidate)].sort((a, b) => a - b);
        if (candidate.length !== LotteryConfig.pickSize) continue;

        const check = this.isValidGame(candidate, this.genConfig);
        
        if (check && check.isValid) {
          best = {
            numbers: candidate.map(n => n.toString().padStart(2, '0')),
            ...check.stats
          };
        }
      }

      if (best) {
        this.generatedGame = best;
      } else {
        alert('Não foi possível gerar um jogo com essas regras exatas. Tente flexibilizar os filtros.');
      }
    }, 50);
  },

  openSimulation(row) {
    const stats = analyzeGame(row.numbers, PRIMES);
    
    // Calcula Padrão de Quintis do Alvo
    // Precisamos recriar os chunks baseados na frequência daquele momento
    const pastGames = this.filterPastGames(parseInt(row.game));
    const counts = {};
    pastGames.forEach(g => g.numbers.forEach(n => counts[n] = (counts[n] || 0) + 1));
    
    const sortedNums = Array.from({length: LotteryConfig.totalNumbers}, (_, i) => i + 1)
      .sort((a, b) => (counts[b] || 0) - (counts[a] || 0));

    const chunks = [];
    const chunkSize = Math.ceil(LotteryConfig.totalNumbers / LotteryConfig.pickSize);
    for(let i=0; i<LotteryConfig.pickSize; i++) chunks.push(sortedNums.slice(i*16, (i+1)*16));

    const quintilePattern = Array(LotteryConfig.pickSize).fill(0);
    row.numbers.forEach(n => {
      const idx = chunks.findIndex(c => c.includes(parseInt(n)));
      if (idx !== -1) quintilePattern[idx]++;
    });

    this.simState = {
      running: false,
      mode: 'smart',
      attempts: 0,
      startTime: null,
      elapsedTime: '00:00',
      targetGame: { ...row, ...stats },
      bestTry: Array(LotteryConfig.pickSize).fill('..'),
      quintilePattern,
      chunks
    };

    if (!this.simModal) this.simModal = new bootstrap.Modal(document.getElementById('simModal'));
    this.simModal.show();
  },

  startSim() {
    this.simState.running = true;
    this.simState.startTime = Date.now();
    this.simState.attempts = 0;
    this.initBitSetSystem();
    this.runSimLoop();
  },

  runSimLoop() {
    if (!this.simState.running) return;

    const { chunks, quintilePattern, targetGame, mode } = this.simState;
    const targetStr = targetGame.numbers.join(',');
    const batchSize = mode === 'random' ? LotteryConfig.simBatchSize.random : LotteryConfig.simBatchSize.smart;
    
    let batch = 0;

    while (batch < batchSize) {
      batch++;
      let candidate = [];

      if (mode === 'random') {
        while (candidate.length < LotteryConfig.pickSize) {
          const rnd = Math.floor(Math.random() * LotteryConfig.totalNumbers) + 1;
          if (!candidate.includes(rnd)) candidate.push(rnd);
        }
        candidate.sort((a, b) => a - b);
      } else {
        // Smart Generation (Quintiles)
        for (let i = 0; i < LotteryConfig.pickSize; i++) {
          const needed = quintilePattern[i];
          if (needed > 0) {
            const chunk = chunks[i];
            const picked = [];
            while(picked.length < needed) {
              const rnd = chunk[Math.floor(Math.random() * chunk.length)];
              if (!picked.includes(rnd)) picked.push(rnd);
            }
            candidate.push(...picked);
          }
        }
        candidate.sort((a, b) => a - b);
      }

      // BitSet Check
      const idx = this.getGameIndex(candidate);
      const byteIdx = Math.floor(idx / 8);
      const bitIdx = idx % 8;

      if ((this.visitedBitmap[byteIdx] & (1 << bitIdx)) !== 0) continue;
      this.visitedBitmap[byteIdx] |= (1 << bitIdx);
      
      this.simState.attempts++;

      // Validations (Smart Mode)
      if (mode === 'smart') {
        const sum = candidate.reduce((a, b) => a + b, 0);
        if (sum !== targetGame.sum) continue;
        
        const even = candidate.filter(n => n % 2 === 0).length;
        if (even !== targetGame.even) continue;

        const primes = candidate.filter(n => PRIMES.includes(n)).length;
        if (primes !== targetGame.primes) continue;
      }

      // Check Win
      const formatted = candidate.map(n => n.toString().padStart(2, '0'));
      if (batch % 500 === 0) this.simState.bestTry = formatted;

      if (formatted.join(',') === targetStr) {
        this.simState.bestTry = formatted;
        this.simState.running = false;
        setTimeout(() => {
          alert(`ACERTOU (${mode === 'smart' ? 'Inteligente' : 'Aleatório'})!\nJogos: ${this.simState.attempts.toLocaleString()}\nTempo: ${this.simState.elapsedTime}`);
        }, 10);
        return;
      }
    }

    this.simState.elapsedTime = formatTime(Date.now() - this.simState.startTime);
    if (this.simState.running) requestAnimationFrame(this.runSimLoop);
  },

  stopSim() { this.simState.running = false; },
  resetSim() {
    this.simState.running = false;
    this.simState.attempts = 0;
    this.simState.elapsedTime = '00:00';
    this.simState.bestTry = Array(LotteryConfig.pickSize).fill('..');
  }
};
