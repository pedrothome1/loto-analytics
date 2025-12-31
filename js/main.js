const { createApp } = Vue;

createApp({
  data() {
    return {
      loading: false,
      results: [],
      sortOrder: 'desc',
      filterStartDate: '',
      freqSortColumn: 'count',
      freqSortOrder: 'desc',
      highlightNum: null,
      currentPage: 1,
      pageSize: 50,
      generatedGame: null,
      generatorModal: null,
      genConfig: {
        minSum: 140,
        maxSum: 260,
        evenCount: 'any',
        primeCount: 'any',
      },
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
  },
  watch: {
    sortedResults() {
      this.currentPage = 1;
    },
  },
  computed: {
    sortedResults() {
      let list = [...this.results];
      if (this.filterStartDate) {
        const p = this.filterStartDate.split('-');
        const d = new Date(p[0], p[1] - 1, p[2]);
        d.setHours(0, 0, 0, 0);
        list = list.filter((r) => {
          const pr = r.date.split('/');
          const ds = new Date(pr[2], pr[1] - 1, pr[0]);
          ds.setHours(0, 0, 0, 0);
          return ds >= d;
        });
      }
      return list.sort((a, b) => {
        const nA = parseInt(a.game),
          nB = parseInt(b.game);
        return this.sortOrder === 'asc' ? nA - nB : nB - nA;
      });
    },
    totalPages() {
      return Math.ceil(this.sortedResults.length / this.pageSize);
    },
    paginatedResults() {
      const s = (this.currentPage - 1) * this.pageSize;
      return this.sortedResults.slice(s, s + this.pageSize);
    },
    frequencyTable() {
      if (this.sortedResults.length === 0) return [];
      const c = {};
      for (let i = 1; i <= 80; i++) c[i.toString().padStart(2, '0')] = 0;
      this.sortedResults.forEach((j) =>
        j.numbers.forEach((b) => {
          if (c[b] !== undefined) c[b]++;
        }),
      );

      const vals = Object.values(c);
      const min = Math.min(...vals),
        max = Math.max(...vals),
        rng = max - min || 1;

      return Object.keys(c)
        .map((n) => {
          const v = c[n],
            r = (v - min) / rng;
          let color =
            r < 0.5
              ? `rgb(255, ${Math.round((255 * r) / 0.5)}, ${Math.round((255 * r) / 0.5)})`
              : `rgb(${Math.round(255 * (1 - (r - 0.5) / 0.5))}, ${Math.round(255 - (75 * (r - 0.5)) / 0.5)}, ${Math.round(255 * (1 - (r - 0.5) / 0.5))})`;
          return {
            number: n,
            count: v,
            style: {
              backgroundColor: color,
              color: r < 0.2 || r > 0.8 ? 'white' : 'black',
            },
          };
        })
        .sort((a, b) =>
          this.freqSortOrder === 'asc'
            ? this.freqSortColumn === 'number'
              ? parseInt(a.number) - parseInt(b.number)
              : a.count - b.count
            : this.freqSortColumn === 'number'
              ? parseInt(b.number) - parseInt(a.number)
              : b.count - a.count,
        );
    },
    evenOddStats() {
      return this.genericStats(
        (j) => j.numbers.filter((n) => n % 2 === 0).length,
        (p) => `${p} Pares / ${5 - p} Ímpares`,
        'pares',
      );
    },
    primeStats() {
      const pr = [
        2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67,
        71, 73, 79,
      ];
      return this.genericStats(
        (j) => j.numbers.filter((n) => pr.includes(parseInt(n))).length,
        (q) => (q === 1 ? '1 Primo' : `${q} Primos`),
        'qty',
      );
    },
    decadeStats() {
      if (!this.sortedResults.length) return [];
      const c = Array(9).fill(0);
      this.sortedResults.forEach((j) =>
        j.numbers.forEach((b) => c[Math.floor(parseInt(b) / 10)]++),
      );
      return c.map((cnt, i) => ({
        label: `${i * 10}-${i * 10 + 9}`
          .replace(/^(\d)-/, '0$1-')
          .replace(/-(\d)$/, '-0$1'),
        count: cnt,
      }));
    },
    maxDecadeCount() {
      return Math.max(...(this.decadeStats.map((d) => d.count) || 1));
    },
    sumStats() {
      const s = {};
      const t = this.sortedResults.length;
      this.sortedResults.forEach((j) => {
        const sum = j.numbers.reduce((a, b) => a + parseInt(b), 0);
        const k = Math.floor(sum / 20) * 20;
        if (!s[k])
          s[k] = {
            label: `${k}-${k + 19}`,
            count: 0,
            vi: k,
          };
        s[k].count++;
      });
      const mx = Math.max(...Object.values(s).map((v) => v.count));
      return Object.values(s)
        .map((i) => ({
          ...i,
          percentTotal: ((i.count / t) * 100).toFixed(1),
          percentBar: (i.count / mx) * 100,
        }))
        .sort((a, b) => a.vi - b.vi);
    },
  },
  methods: {
    initBitSetSystem() {
      this.combTable = Array(81)
        .fill(0)
        .map(() => Array(6).fill(0));

      for (let i = 0; i <= 80; i++) {
        this.combTable[i][0] = 1;
        for (let j = 1; j <= Math.min(i, 5); j++) {
          this.combTable[i][j] =
            this.combTable[i - 1][j - 1] + this.combTable[i - 1][j];
        }
      }

      if (!this.visitedBitmap) {
        const totalCombinations = 24040016;
        const byteSize = Math.ceil(totalCombinations / 8);
        this.visitedBitmap = new Uint8Array(byteSize);
      } else {
        this.visitedBitmap.fill(0);
      }
    },
    getGameIndex(nums) {
      let idx = 0;
      for (let i = 0; i < 5; i++) {
        idx += this.combTable[nums[i] - 1][i + 1];
      }
      return idx;
    },
    openDetails(row) {
      const currentGame = parseInt(row.game);

      let filterDateObj = null;
      if (this.filterStartDate) {
        const p = this.filterStartDate.split('-');
        filterDateObj = new Date(p[0], p[1] - 1, p[2]);
        filterDateObj.setHours(0, 0, 0, 0);
      }

      const pastGames = this.results.filter((r) => {
        const rGame = parseInt(r.game);

        if (rGame >= currentGame) return false;

        if (filterDateObj) {
          const pr = r.date.split('/');
          const rDate = new Date(pr[2], pr[1] - 1, pr[0]);
          rDate.setHours(0, 0, 0, 0);
          if (rDate < filterDateObj) return false;
        }
        return true;
      });

      this.previousGamesCount = pastGames.length;

      const counts = {};
      pastGames.forEach((j) =>
        j.numbers.forEach((b) => {
          if (!counts[b]) counts[b] = 0;
          counts[b]++;
        }),
      );

      row.numbers.forEach((n) => {
        if (!counts[n]) counts[n] = 0;
      });

      const vals = Object.values(counts);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const range = max - min || 1;

      const getColor = (val) => {
        const r = (val - min) / range;
        let bg, txt;
        if (r < 0.5) {
          const lr = r / 0.5;
          bg = `rgb(255, ${Math.round(255 * lr)}, ${Math.round(255 * lr)})`;
        } else {
          const lr = (r - 0.5) / 0.5;
          bg = `rgb(${Math.round(255 * (1 - lr))}, ${Math.round(255 - 75 * lr)}, ${Math.round(255 * (1 - lr))})`;
        }
        txt = r < 0.2 || r > 0.8 ? 'white' : 'black';
        return {
          backgroundColor: bg,
          color: txt,
        };
      };

      const nums = row.numbers.map((n) => parseInt(n));
      const primeList = [
        2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67,
        71, 73, 79,
      ];

      this.selectedDetails = {
        game: row.game,
        date: row.date,
        sum: nums.reduce((a, b) => a + b, 0),
        even: nums.filter((n) => n % 2 === 0).length,
        primes: nums.filter((n) => primeList.includes(n)).length,
        numbersWithColor: row.numbers.map((n) => ({
          val: n,
          style: getColor(counts[n] || 0),
        })),
      };

      if (!this.detailsModal)
        this.detailsModal = new bootstrap.Modal(
          document.getElementById('detailsModal'),
        );
      this.detailsModal.show();
    },
    getNumberStyle(numberStr) {
      if (!this.frequencyTable) return {};
      const found = this.frequencyTable.find(
        (item) => item.number === numberStr,
      );

      return found ? found.style : {};
    },
    genericStats(countFn, labelFn, sortKey) {
      if (!this.sortedResults.length) return [];
      const s = {},
        t = this.sortedResults.length;
      this.sortedResults.forEach((j) => {
        const v = countFn(j);
        const k = labelFn(v);
        if (!s[k])
          s[k] = {
            count: 0,
            [sortKey]: v,
          };
        s[k].count++;
      });
      return Object.keys(s)
        .map((k) => ({
          label: k,
          count: s[k].count,
          percent: ((s[k].count / t) * 100).toFixed(1),
          [sortKey]: s[k][sortKey],
        }))
        .sort((a, b) => a[sortKey] - b[sortKey]);
    },
    handleFileUpload(e) {
      const f = e.target.files[0];
      if (!f) return;
      this.loading = true;
      this.results = [];
      this.highlightNum = null;
      Papa.parse(f, {
        header: false,
        skipEmptyLines: true,
        complete: (r) => {
          this.results = r.data
            .slice(1)
            .map((row) => {
              if (row.length < 3) return null;
              return {
                game: row[0],
                date: row[1],
                numbers: row
                  .slice(2, 7)
                  .filter((b) => b && b.trim())
                  .map((b) => parseInt(b))
                  .sort((a, b) => a - b)
                  .map((b) => b.toString().padStart(2, '0')),
              };
            })
            .filter((i) => i);
          this.loading = false;
          this.currentPage = 1;
        },
      });
    },
    toggleSort() {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    },
    sortFrequency(c) {
      if (this.freqSortColumn === c)
        this.freqSortOrder = this.freqSortOrder === 'asc' ? 'desc' : 'asc';
      else {
        this.freqSortColumn = c;
        this.freqSortOrder = 'desc';
      }
    },
    cleanFilters() {
      this.filterStartDate = '';
    },
    toggleHighlight(n) {
      this.highlightNum = this.highlightNum === n ? null : n;
    },
    nextPage() {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        document.getElementById('tabela-topo')?.scrollIntoView({
          behavior: 'smooth',
        });
      }
    },
    prevPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
        document.getElementById('tabela-topo')?.scrollIntoView({
          behavior: 'smooth',
        });
      }
    },
    getProgressBarColor(p) {
      return p > 30 ? 'bg-success' : p > 15 ? 'bg-info' : 'bg-secondary';
    },
    openGenerator() {
      if (!this.generatorModal)
        this.generatorModal = new bootstrap.Modal(
          document.getElementById('generatorModal'),
        );
      this.generateOptimizedGame();
      this.generatorModal.show();
    },
    generateOptimizedGame() {
      this.generatedGame = null;

      setTimeout(() => {
        let sortedNums;
        if (this.frequencyTable && this.frequencyTable.length > 0) {
          const sortedTable = [...this.frequencyTable].sort(
            (a, b) => b.count - a.count,
          );
          sortedNums = sortedTable.map((item) => parseInt(item.number));
        } else {
          sortedNums = Array.from(
            {
              length: 80,
            },
            (_, i) => i + 1,
          );
        }

        const chunks = [];
        const chunkSize = Math.ceil(sortedNums.length / 5);
        for (let i = 0; i < 5; i++) {
          chunks.push(sortedNums.slice(i * chunkSize, (i + 1) * chunkSize));
        }

        let bestGame = null;
        let attempts = 0;
        const maxAttempts = 5000;

        const primeList = [
          2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61,
          67, 71, 73, 79,
        ];

        while (!bestGame && attempts < maxAttempts) {
          attempts++;

          let candidate = chunks.map((chunk) => {
            if (!chunk || chunk.length === 0)
              return Math.floor(Math.random() * 80) + 1;
            return chunk[Math.floor(Math.random() * chunk.length)];
          });

          candidate = [...new Set(candidate)].sort((a, b) => a - b);
          if (candidate.length !== 5) continue;

          const sum = candidate.reduce((a, b) => a + b, 0);
          const evens = candidate.filter((n) => n % 2 === 0).length;
          const primes = candidate.filter((n) => primeList.includes(n)).length;

          if (sum < this.genConfig.minSum || sum > this.genConfig.maxSum)
            continue;

          if (this.genConfig.evenCount !== 'any') {
            if (evens !== parseInt(this.genConfig.evenCount)) continue;
          } else {
            if (evens === 0 || evens === 5) continue;
          }

          if (this.genConfig.primeCount !== 'any') {
            if (primes !== parseInt(this.genConfig.primeCount)) continue;
          } else {
            if (primes > 3) continue;
          }

          bestGame = {
            numbers: candidate.map((n) => n.toString().padStart(2, '0')),
            sum: sum,
            even: evens,
            primes: primes,
          };
        }

        if (bestGame) {
          this.generatedGame = bestGame;
        } else {
          alert(
            'Não foi possível gerar um jogo com essas regras exatas após 5000 tentativas. Tente aumentar a faixa de soma ou mudar os pares/primos.',
          );
        }
      }, 50);
    },
    openSimulation(row) {
      const currentGame = parseInt(row.game);
      let filterDateObj = null;
      if (this.filterStartDate) {
        const p = this.filterStartDate.split('-');
        filterDateObj = new Date(p[0], p[1] - 1, p[2]);
        filterDateObj.setHours(0, 0, 0, 0);
      }
      const pastGames = this.results.filter((r) => {
        const rGame = parseInt(r.game);
        if (rGame >= currentGame) return false;
        if (filterDateObj) {
          const pr = r.date.split('/');
          const rDate = new Date(pr[2], pr[1] - 1, pr[0]);
          rDate.setHours(0, 0, 0, 0);
          if (rDate < filterDateObj) return false;
        }
        return true;
      });

      const counts = {};
      pastGames.forEach((j) =>
        j.numbers.forEach((b) => {
          counts[b] = (counts[b] || 0) + 1;
        }),
      );
      let sortedNums =
        pastGames.length > 0
          ? Array.from(
              {
                length: 80,
              },
              (_, i) => (i + 1).toString().padStart(2, '0'),
            ).sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
          : Array.from(
              {
                length: 80,
              },
              (_, i) => (i + 1).toString().padStart(2, '0'),
            );

      const chunks = [];
      for (let i = 0; i < 5; i++)
        chunks.push(sortedNums.slice(i * 16, (i + 1) * 16));

      const targetNums = row.numbers.map((n) => parseInt(n));
      const sum = targetNums.reduce((a, b) => a + b, 0);
      const even = targetNums.filter((n) => n % 2 === 0).length;
      const primesList = [
        2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67,
        71, 73, 79,
      ];
      const primes = targetNums.filter((n) => primesList.includes(n)).length;

      const quintilePattern = [0, 0, 0, 0, 0];
      targetNums.forEach((n) => {
        const strN = n.toString().padStart(2, '0');
        const chunkIndex = chunks.findIndex((chunk) => chunk.includes(strN));
        if (chunkIndex !== -1) quintilePattern[chunkIndex]++;
      });

      this.simState = {
        running: false,
        mode: 'smart',
        attempts: 0,
        startTime: null,
        elapsedTime: '00:00',
        targetGame: {
          game: row.game,
          numbers: row.numbers,
          sum,
          even,
          primes,
        },
        bestTry: ['..', '..', '..', '..', '..'],
        quintilePattern: quintilePattern,
        chunks: chunks,
      };

      if (!this.simModal)
        this.simModal = new bootstrap.Modal(
          document.getElementById('simModal'),
        );
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
      const primesList = [
        2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67,
        71, 73, 79,
      ];

      const batchSize = mode === 'random' ? 5000 : 2000;
      let batch = 0;

      while (batch < batchSize) {
        batch++;

        let candidate = [];

        if (mode === 'random') {
          while (candidate.length < 5) {
            const rnd = Math.floor(Math.random() * 80) + 1;
            if (!candidate.includes(rnd)) candidate.push(rnd);
          }

          candidate.sort((a, b) => a - b);
        } else {
          for (let i = 0; i < 5; i++) {
            const countNeeded = quintilePattern[i];
            if (countNeeded > 0) {
              const chunk = chunks[i];
              const picked = [];
              while (picked.length < countNeeded) {
                const rnd = chunk[Math.floor(Math.random() * chunk.length)];

                if (!picked.includes(rnd)) picked.push(rnd);
              }
              candidate.push(...picked);
            }
          }
          candidate.sort((a, b) => parseInt(a) - parseInt(b));
        }

        const gameIndex = this.getGameIndex(candidate);

        const byteIndex = Math.floor(gameIndex / 8);
        const bitIndex = gameIndex % 8;

        if ((this.visitedBitmap[byteIndex] & (1 << bitIndex)) !== 0) {
          continue;
        }

        this.visitedBitmap[byteIndex] |= 1 << bitIndex;

        this.simState.attempts++;

        if (mode === 'smart') {
          const sum = candidate.reduce((a, b) => a + parseInt(b), 0);
          if (sum !== targetGame.sum) continue;

          const evens = candidate.filter((n) => parseInt(n) % 2 === 0).length;
          if (evens !== targetGame.even) continue;

          const primes = candidate.filter((n) =>
            primesList.includes(parseInt(n)),
          ).length;
          if (primes !== targetGame.primes) continue;
        }

        const candidateFormatted = candidate.map((n) =>
          n.toString().padStart(2, '0'),
        );

        if (batch % 500 === 0) this.simState.bestTry = candidateFormatted;

        if (candidateFormatted.join(',') === targetStr) {
          this.simState.bestTry = candidateFormatted;
          this.simState.running = false;

          setTimeout(() => {
            alert(
              `ACERTOU (${mode === 'smart' ? 'Inteligente' : 'Aleatório'})!\nJogos Únicos Testados: ${this.simState.attempts.toLocaleString()}\nTempo: ${this.simState.elapsedTime}`,
            );
          }, 10);
          return;
        }
      }

      const diff = Math.floor((Date.now() - this.simState.startTime) / 1000);
      const m = Math.floor(diff / 60)
        .toString()
        .padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      this.simState.elapsedTime = `${m}:${s}`;

      if (this.simState.running) {
        requestAnimationFrame(this.runSimLoop);
      }
    },
    stopSim() {
      this.simState.running = false;
    },
    resetSim() {
      this.simState.running = false;
      this.simState.attempts = 0;

      this.simState.elapsedTime = '00:00';
      this.simState.bestTry = ['..', '..', '..', '..', '..'];
    },
  },
}).mount('#app');
