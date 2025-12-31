import { LotteryConfig } from './config.js';
import { getHeatMapColor, generatePrimes, analyzeGame, formatTime } from './utils.js';

const PRIMES = generatePrimes(LotteryConfig.totalNumbers);

export const appMethods = {
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
              d: parseInt(day),
              m: parseInt(month),
              y: parseInt(year),
              time: dateObj.setHours(0,0,0,0),
              isLeap: (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
            }
          };
        }).filter(Boolean);
        
        this.loading = false;
        this.currentPage = 1;
      }
    });
  },

  checkFilters(row) {
    const f = this.filters;
    const s = row.stats;

    if (f.startDate) {
      const [y, m, d] = f.startDate.split('-');
      if (s.time < new Date(y, m - 1, d).setHours(0,0,0,0)) return false;
    }
    
    if (f.day && s.d !== parseInt(f.day)) return false;
    if (f.month && s.m !== parseInt(f.month)) return false;
    if (f.year && s.y !== parseInt(f.year)) return false;
    if (f.leapYear && !s.isLeap) return false;

    if (f.evenCount !== '' && s.even !== parseInt(f.evenCount)) return false;
    if (f.primeCount !== '' && s.primes !== parseInt(f.primeCount)) return false;
    if (f.sumMin !== '' && s.sum < parseInt(f.sumMin)) return false;
    if (f.sumMax !== '' && s.sum > parseInt(f.sumMax)) return false;

    return true;
  },

  cleanFilters() {
    this.filters = {
      startDate: '', endDate: '', day: '', month: '', year: '', 
      leapYear: false, evenCount: '', primeCount: '', sumMin: '', sumMax: ''
    };
  },

  filterPastGames(currentGameId) {
    return this.results.filter(r => {
      if (parseInt(r.game) >= currentGameId) return false;
      return this.checkFilters(r);
    });
  },

  openDetails(row) {
    const gameId = parseInt(row.game);
    const games = this.filterPastGames(gameId);

    this.previousGamesCount = games.length;

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

  getNumberStyle(numStr) {
    const item = this.frequencyTable?.find(i => i.number === numStr);
    return item ? item.style : {};
  },

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

  toggleSort() { this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc'; },
  sortFrequency(col) {
    if (this.freqSortColumn === col) {
      this.freqSortOrder = this.freqSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.freqSortColumn = col;
      this.freqSortOrder = 'desc';
    }
  },
  
  toggleHighlight(num) { this.highlightNum = this.highlightNum === num ? null : num; },
  nextPage() { if (this.currentPage < this.totalPages) this.changePage(1); },
  prevPage() { if (this.currentPage > 1) this.changePage(-1); },
  changePage(dir) {
    this.currentPage += dir;
    document.getElementById('tabela-topo')?.scrollIntoView({ behavior: 'smooth' });
  },
  getProgressBarColor(p) { return p > 30 ? 'bg-success' : p > 15 ? 'bg-info' : 'bg-secondary'; },

  openGenerator() {
    if (!this.generatorModal) this.generatorModal = new bootstrap.Modal(document.getElementById('generatorModal'));
    this.generateOptimizedGame();
    this.generatorModal.show();
  },

  isValidGame(nums, config) {
    const stats = analyzeGame(nums, PRIMES);
    
    if (config.minSum && (stats.sum < config.minSum || stats.sum > config.maxSum)) return false;
    
    if (config.evenCount !== 'any') {
      if (stats.even !== parseInt(config.evenCount)) return false;
    } else {
      if (stats.even === 0 || stats.even === LotteryConfig.pickSize) return false;
    }

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
      let sortedNumbersList;
      if (this.frequencyTable?.length) {
        sortedNumbersList = [...this.frequencyTable]
          .sort((a, b) => b.count - a.count)
          .map(i => parseInt(i.number));
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
      
      const maxAttemptsSmart = 2000;
      const maxAttemptsTotal = 10000;

      while (!bestGame && attempts < maxAttemptsTotal) {
        attempts++;
        let candidate = [];

        if (attempts < maxAttemptsSmart) {
          candidate = chunks.map(chunk => {
            if (!chunk || !chunk.length) return Math.floor(Math.random() * LotteryConfig.totalNumbers) + 1;
            return chunk[Math.floor(Math.random() * chunk.length)];
          });
        } else {
          const poolSize = Math.min(50, sortedNumbersList.length);
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
          bestGame = {
            numbers: candidate.map(n => n.toString().padStart(2, '0')),
            ...check.stats
          };
        }
      }

      if (bestGame) {
        this.generatedGame = bestGame;
      } else {
        alert('Não foi possível gerar um jogo com essas regras exatas. Tente aumentar a faixa de soma ou alterar os filtros.');
      }
    }, 50);
  },

  openSimulation(row) {
    const stats = analyzeGame(row.numbers, PRIMES);
    
    const pastGames = this.filterPastGames(parseInt(row.game));
    const counts = {};
    pastGames.forEach(g => g.numbers.forEach(n => counts[n] = (counts[n] || 0) + 1));
    
    const sortedNums = Array.from({length: LotteryConfig.totalNumbers}, (_, i) => i + 1)
      .sort((a, b) => (counts[b] || 0) - (counts[a] || 0));

    const chunks = [];
    const chunkSize = Math.ceil(LotteryConfig.totalNumbers / LotteryConfig.pickSize);
    for(let i=0; i<LotteryConfig.pickSize; i++) {
        chunks.push(sortedNums.slice(i * chunkSize, (i+1) * chunkSize));
    }

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

      const idx = this.getGameIndex(candidate);
      const byteIdx = Math.floor(idx / 8);
      const bitIdx = idx % 8;

      if ((this.visitedBitmap[byteIdx] & (1 << bitIdx)) !== 0) continue;
      this.visitedBitmap[byteIdx] |= (1 << bitIdx);
      
      this.simState.attempts++;

      if (mode === 'smart') {
        const sum = candidate.reduce((a, b) => a + b, 0);
        if (sum !== targetGame.sum) continue;
        
        const even = candidate.filter(n => n % 2 === 0).length;
        if (even !== targetGame.even) continue;

        const primes = candidate.filter(n => PRIMES.includes(n)).length;
        if (primes !== targetGame.primes) continue;
      }

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
