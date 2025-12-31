import { analyzeGame, formatTime } from './utils.js';

export const SimulationModule = {
  data() {
    return {
      simModal: null,
      simState: {
        running: false, mode: 'smart', attempts: 0, startTime: null, elapsedTime: '00:00',
        targetGame: null, bestTry: null, quintilePattern: [], chunks: [],
        customConfig: { minSum: 0, maxSum: 0, evenMin: '', evenMax: '', primeMin: '', primeMax: '' },
      }
    };
  },
  methods: {
    openSimulation(row) {
      const config = this.lotteryConfig;
      const stats = analyzeGame(row.numbers, this.primes);
      const pastGames = this.filterPastGames(parseInt(row.game));
      const counts = {};
      pastGames.forEach(g => g.numbers.forEach(n => counts[n] = (counts[n] || 0) + 1));
      
      const sortedNums = Array.from({length: config.totalNumbers}, (_, i) => i + 1)
        .sort((a, b) => (counts[b] || 0) - (counts[a] || 0));

      const chunks = [];
      const chunkSize = Math.ceil(config.totalNumbers / config.pickSize);
      for(let i=0; i<config.pickSize; i++) {
          chunks.push(sortedNums.slice(i * chunkSize, (i+1) * chunkSize));
      }

      const quintilePattern = Array(config.pickSize).fill(0);
      row.numbers.forEach(n => {
        const idx = chunks.findIndex(c => c.includes(parseInt(n)));
        if (idx !== -1) quintilePattern[idx]++;
      });

      this.simState = {
        ...this.simState,
        running: false, mode: 'smart', attempts: 0, startTime: null, elapsedTime: '00:00',
        targetGame: { ...row, ...stats },
        bestTry: Array(config.pickSize).fill('..'),
        quintilePattern, chunks,
        customConfig: {
            minSum: config.limits.minSum, maxSum: config.limits.maxSum,
            evenMin: config.limits.evenMin, evenMax: config.limits.evenMax,
            primeMin: config.limits.primeMin, primeMax: config.limits.primeMax
        }
      };

      if (!this.simModal) this.simModal = new bootstrap.Modal(document.getElementById('simModal'));
      this.simModal.show();
    },
    startSim() {
      if (this.simState.mode === 'manual') {
        const tgt = this.simState.targetGame;
        const cfg = this.simState.customConfig;
        
        if (tgt.sum < cfg.minSum || tgt.sum > cfg.maxSum) return alert("Erro: Soma do alvo fora do intervalo.");
        if (cfg.evenMin !== '' && tgt.even < parseInt(cfg.evenMin)) return alert("Erro: Pares do alvo abaixo do mínimo.");
        if (cfg.evenMax !== '' && tgt.even > parseInt(cfg.evenMax)) return alert("Erro: Pares do alvo acima do máximo.");
        if (cfg.primeMin !== '' && tgt.primes < parseInt(cfg.primeMin)) return alert("Erro: Primos do alvo abaixo do mínimo.");
        if (cfg.primeMax !== '' && tgt.primes > parseInt(cfg.primeMax)) return alert("Erro: Primos do alvo acima do máximo.");
      }

      this.simState.running = true;
      this.simState.startTime = Date.now();
      this.simState.attempts = 0;
      this.initBitSetSystem();
      this.runSimLoop();
    },
    runSimLoop() {
      if (!this.simState.running) return;

      const { chunks, quintilePattern, targetGame, mode, customConfig } = this.simState;
      const config = this.lotteryConfig;
      const targetStr = targetGame.numbers.join(',');
      const frameStart = performance.now();
      let safetyCounter = 0;

      while (performance.now() - frameStart < 12) {
        if (safetyCounter > 5000) break;

        let candidate = [];

        if (mode === 'random') {
          while (candidate.length < config.pickSize) {
            const rnd = Math.floor(Math.random() * config.totalNumbers) + 1;
            if (!candidate.includes(rnd)) candidate.push(rnd);
          }
          candidate.sort((a, b) => a - b);
        } 
        else if (mode === 'smart') {
           for (let i = 0; i < config.pickSize; i++) {
              const needed = quintilePattern[i];
              if (needed > 0) {
                const chunk = chunks[i];
                const picked = [];
                let safety = 0;
                while(picked.length < needed && safety < 100) {
                  const rnd = chunk[Math.floor(Math.random() * chunk.length)];
                  if (!picked.includes(rnd)) picked.push(rnd);
                  safety++;
                }
                candidate.push(...picked);
              }
            }
            candidate.sort((a, b) => a - b);
        }
        else if (mode === 'manual') {
          let groupIndices = Array.from({ length: config.pickSize }, (_, i) => i);
          for (let i = groupIndices.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [groupIndices[i], groupIndices[j]] = [groupIndices[j], groupIndices[i]];
          }
          if (Math.random() < 0.30) {
             const idxToChange = Math.floor(Math.random() * config.pickSize);
             groupIndices[idxToChange] = Math.floor(Math.random() * chunks.length);
          }
          while (candidate.length < config.pickSize) {
             const chunkIdx = groupIndices.length > 0 ? groupIndices.shift() : Math.floor(Math.random() * chunks.length);
             const chunk = chunks[chunkIdx];
             if (chunk && chunk.length > 0) {
               const rnd = chunk[Math.floor(Math.random() * chunk.length)];
               if (!candidate.includes(rnd)) candidate.push(rnd);
             } else {
               const r = Math.floor(Math.random() * config.totalNumbers) + 1;
               if (!candidate.includes(r)) candidate.push(r);
             }
          }
          candidate.sort((a, b) => a - b);
        }

        // Verificação BitSet (apenas se memória permitiu criar)
        if (this.visitedBitmap) {
            const idx = this.getGameIndex(candidate);
            if (idx !== -1) {
                const byteIdx = Math.floor(idx / 8);
                const bitIdx = idx % 8;
                if ((this.visitedBitmap[byteIdx] & (1 << bitIdx)) !== 0) {
                    safetyCounter++;
                    continue;
                }
                this.visitedBitmap[byteIdx] |= (1 << bitIdx);
            }
        }
        
        this.simState.attempts++;

        let isValid = true;
        if (mode === 'smart') {
          const sum = candidate.reduce((a, b) => a + b, 0);
          if (sum !== targetGame.sum) isValid = false;
          if (isValid && candidate.filter(n => n % 2 === 0).length !== targetGame.even) isValid = false;
          if (isValid && candidate.filter(n => this.primes.includes(n)).length !== targetGame.primes) isValid = false;
        } 
        else if (mode === 'manual') {
          const stats = analyzeGame(candidate, this.primes);
          if (stats.sum < customConfig.minSum || stats.sum > customConfig.maxSum) isValid = false;
          if (isValid && customConfig.evenMin !== '' && stats.even < parseInt(customConfig.evenMin)) isValid = false;
          if (isValid && customConfig.evenMax !== '' && stats.even > parseInt(customConfig.evenMax)) isValid = false;
          if (isValid && customConfig.primeMin !== '' && stats.primes < parseInt(customConfig.primeMin)) isValid = false;
          if (isValid && customConfig.primeMax !== '' && stats.primes > parseInt(customConfig.primeMax)) isValid = false;
        }

        if (!isValid) { safetyCounter++; continue; }
        safetyCounter = 0;

        const formatted = candidate.map(n => n.toString().padStart(2, '0'));
        if (this.simState.attempts % 20 === 0) this.simState.bestTry = formatted;

        if (formatted.join(',') === targetStr) {
          this.simState.bestTry = formatted;
          this.simState.running = false;
          setTimeout(() => alert(`ACERTOU!\nJogos: ${this.simState.attempts.toLocaleString()}\nTempo: ${this.simState.elapsedTime}`), 10);
          return;
        }
      }

      this.simState.elapsedTime = formatTime(Date.now() - this.simState.startTime);
      if (this.simState.running) requestAnimationFrame(this.runSimLoop.bind(this));
    },
    stopSim() { this.simState.running = false; },
    resetSim() {
      this.simState.running = false;
      this.simState.attempts = 0;
      this.simState.elapsedTime = '00:00';
      this.simState.bestTry = Array(this.lotteryConfig.pickSize).fill('..');
    }
  }
};
