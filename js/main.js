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
      let resultList = [...this.results];
      
      if (this.filterStartDate) {
        const dateParts = this.filterStartDate.split('-');
        const filterDateObject = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        filterDateObject.setHours(0, 0, 0, 0);

        resultList = resultList.filter((gameResult) => {
          const resultDateParts = gameResult.date.split('/');
          const resultDateObject = new Date(resultDateParts[2], resultDateParts[1] - 1, resultDateParts[0]);
          resultDateObject.setHours(0, 0, 0, 0);
          return resultDateObject >= filterDateObject;
        });
      }

      return resultList.sort((gameA, gameB) => {
        const gameNumberA = parseInt(gameA.game);
        const gameNumberB = parseInt(gameB.game);
        return this.sortOrder === 'asc' ? gameNumberA - gameNumberB : gameNumberB - gameNumberA;
      });
    },
    totalPages() {
      return Math.ceil(this.sortedResults.length / this.pageSize);
    },
    paginatedResults() {
      const startIndex = (this.currentPage - 1) * this.pageSize;
      return this.sortedResults.slice(startIndex, startIndex + this.pageSize);
    },
    frequencyTable() {
      if (this.sortedResults.length === 0) return [];
      
      const countsMap = {};
      // Inicializa contagem para números de 01 a 80
      for (let i = 1; i <= 80; i++) {
          countsMap[i.toString().padStart(2, '0')] = 0;
      }

      this.sortedResults.forEach((gameResult) =>
        gameResult.numbers.forEach((ballNumber) => {
          if (countsMap[ballNumber] !== undefined) countsMap[ballNumber]++;
        }),
      );

      const countValues = Object.values(countsMap);
      const minCount = Math.min(...countValues);
      const maxCount = Math.max(...countValues);
      const range = maxCount - minCount || 1;

      return Object.keys(countsMap)
        .map((numberKey) => {
          const countValue = countsMap[numberKey];
          const ratio = (countValue - minCount) / range;
          
          let color;
          if (ratio < 0.5) {
             // Gradiente para números menos frequentes (escala de branco para azul/verde claro)
             const normalizedRatio = ratio / 0.5;
             const greenBlue = Math.round(255 * normalizedRatio);
             color = `rgb(255, ${greenBlue}, ${greenBlue})`;
          } else {
             // Gradiente para números mais frequentes (escala para cor mais escura/intensa)
             const normalizedRatio = (ratio - 0.5) / 0.5;
             const red = Math.round(255 * (1 - normalizedRatio));
             const green = Math.round(255 - (75 * normalizedRatio));
             const blue = Math.round(255 * (1 - normalizedRatio));
             color = `rgb(${red}, ${green}, ${blue})`;
          }

          return {
            number: numberKey,
            count: countValue,
            style: {
              backgroundColor: color,
              color: ratio < 0.2 || ratio > 0.8 ? 'white' : 'black',
            },
          };
        })
        .sort((itemA, itemB) => {
          if (this.freqSortOrder === 'asc') {
            return this.freqSortColumn === 'number'
              ? parseInt(itemA.number) - parseInt(itemB.number)
              : itemA.count - itemB.count;
          } else {
            return this.freqSortColumn === 'number'
              ? parseInt(itemB.number) - parseInt(itemA.number)
              : itemB.count - itemA.count;
          }
        });
    },
    evenOddStats() {
      return this.genericStats(
        (gameResult) => gameResult.numbers.filter((n) => n % 2 === 0).length,
        (evenCount) => `${evenCount} Pares / ${5 - evenCount} Ímpares`,
        'evenCount',
      );
    },
    primeStats() {
      const primeNumbersList = [
        2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67,
        71, 73, 79,
      ];
      return this.genericStats(
        (gameResult) => gameResult.numbers.filter((n) => primeNumbersList.includes(parseInt(n))).length,
        (primeCount) => (primeCount === 1 ? '1 Primo' : `${primeCount} Primos`),
        'quantity',
      );
    },
    decadeStats() {
      if (!this.sortedResults.length) return [];
      
      const decadeCounts = Array(9).fill(0);
      
      this.sortedResults.forEach((gameResult) =>
        gameResult.numbers.forEach((ballNumber) => {
            const decadeIndex = Math.floor(parseInt(ballNumber) / 10);
            decadeCounts[decadeIndex]++;
        }),
      );
      
      return decadeCounts.map((count, index) => ({
        label: `${index * 10}-${index * 10 + 9}`
          .replace(/^(\d)-/, '0$1-')
          .replace(/-(\d)$/, '-0$1'),
        count: count,
      }));
    },
    maxDecadeCount() {
      return Math.max(...(this.decadeStats.map((d) => d.count) || 1));
    },
    sumStats() {
      const statsMap = {};
      const totalGames = this.sortedResults.length;
      
      this.sortedResults.forEach((gameResult) => {
        const sumTotal = gameResult.numbers.reduce((acc, curr) => acc + parseInt(curr), 0);
        const intervalKey = Math.floor(sumTotal / 20) * 20;
        
        if (!statsMap[intervalKey])
          statsMap[intervalKey] = {
            label: `${intervalKey}-${intervalKey + 19}`,
            count: 0,
            intervalStart: intervalKey,
          };
        statsMap[intervalKey].count++;
      });

      const maxFrequency = Math.max(...Object.values(statsMap).map((stat) => stat.count));
      
      return Object.values(statsMap)
        .map((statItem) => ({
          ...statItem,
          percentTotal: ((statItem.count / totalGames) * 100).toFixed(1),
          percentBar: (statItem.count / maxFrequency) * 100,
        }))
        .sort((a, b) => a.intervalStart - b.intervalStart);
    },
  },
  methods: {
    initBitSetSystem() {
      // combTable armazena combinações pré-calculadas
      this.combTable = Array(81)
        .fill(0)
        .map(() => Array(6).fill(0));

      // i representa o total de itens (n), j representa o tamanho do subconjunto (k)
      for (let n = 0; n <= 80; n++) {
        this.combTable[n][0] = 1;
        for (let k = 1; k <= Math.min(n, 5); k++) {
          this.combTable[n][k] =
            this.combTable[n - 1][k - 1] + this.combTable[n - 1][k];
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
    getGameIndex(numbersArray) {
      let index = 0;
      for (let i = 0; i < 5; i++) {
        // Usa a lógica combinatória para criar um índice único
        index += this.combTable[numbersArray[i] - 1][i + 1];
      }
      return index;
    },
    openDetails(row) {
      const currentGame = parseInt(row.game);

      let filterDateObj = null;
      if (this.filterStartDate) {
        const dateParts = this.filterStartDate.split('-');
        filterDateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        filterDateObj.setHours(0, 0, 0, 0);
      }

      const pastGames = this.results.filter((gameResult) => {
        const resultGameNumber = parseInt(gameResult.game);

        if (resultGameNumber >= currentGame) return false;

        if (filterDateObj) {
          const resultDateParts = gameResult.date.split('/');
          const resultDate = new Date(resultDateParts[2], resultDateParts[1] - 1, resultDateParts[0]);
          resultDate.setHours(0, 0, 0, 0);
          if (resultDate < filterDateObj) return false;
        }
        return true;
      });

      this.previousGamesCount = pastGames.length;

      const countsMap = {};
      pastGames.forEach((gameResult) =>
        gameResult.numbers.forEach((ballNumber) => {
          if (!countsMap[ballNumber]) countsMap[ballNumber] = 0;
          countsMap[ballNumber]++;
        }),
      );

      // Garante que os números do jogo atual existam no mapa
      row.numbers.forEach((numberStr) => {
        if (!countsMap[numberStr]) countsMap[numberStr] = 0;
      });

      const countValues = Object.values(countsMap);
      const minCount = Math.min(...countValues);
      const maxCount = Math.max(...countValues);
      const range = maxCount - minCount || 1;

      const getColor = (val) => {
        const ratio = (val - minCount) / range;
        let backgroundColor, textColor;
        
        if (ratio < 0.5) {
          const normalizedRatio = ratio / 0.5;
          const greenBlue = Math.round(255 * normalizedRatio);
          backgroundColor = `rgb(255, ${greenBlue}, ${greenBlue})`;
        } else {
          const normalizedRatio = (ratio - 0.5) / 0.5;
          const red = Math.round(255 * (1 - normalizedRatio));
          const green = Math.round(255 - 75 * normalizedRatio);
          const blue = Math.round(255 * (1 - normalizedRatio));
          backgroundColor = `rgb(${red}, ${green}, ${blue})`;
        }
        textColor = ratio < 0.2 || ratio > 0.8 ? 'white' : 'black';
        return {
          backgroundColor: backgroundColor,
          color: textColor,
        };
      };

      const numbersAsInt = row.numbers.map((n) => parseInt(n));
      const primeNumbersList = [
        2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67,
        71, 73, 79,
      ];

      this.selectedDetails = {
        game: row.game,
        date: row.date,
        sum: numbersAsInt.reduce((acc, curr) => acc + curr, 0),
        even: numbersAsInt.filter((n) => n % 2 === 0).length,
        primes: numbersAsInt.filter((n) => primeNumbersList.includes(n)).length,
        numbersWithColor: row.numbers.map((n) => ({
          val: n,
          style: getColor(countsMap[n] || 0),
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
      const foundItem = this.frequencyTable.find(
        (item) => item.number === numberStr,
      );

      return foundItem ? foundItem.style : {};
    },
    genericStats(countFunction, labelFunction, sortKey) {
      if (!this.sortedResults.length) return [];
      
      const statsMap = {};
      const totalGames = this.sortedResults.length;
      
      this.sortedResults.forEach((gameResult) => {
        const value = countFunction(gameResult);
        const key = labelFunction(value);
        
        if (!statsMap[key])
          statsMap[key] = {
            count: 0,
            [sortKey]: value,
          };
        statsMap[key].count++;
      });
      
      return Object.keys(statsMap)
        .map((key) => ({
          label: key,
          count: statsMap[key].count,
          percent: ((statsMap[key].count / totalGames) * 100).toFixed(1),
          [sortKey]: statsMap[key][sortKey],
        }))
        .sort((a, b) => a[sortKey] - b[sortKey]);
    },
    handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      this.loading = true;
      this.results = [];
      this.highlightNum = null;
      
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (parseResult) => {
          this.results = parseResult.data
            .slice(1)
            .map((row) => {
              if (row.length < 3) return null;
              return {
                game: row[0],
                date: row[1],
                numbers: row
                  .slice(2, 7)
                  .filter((cell) => cell && cell.trim())
                  .map((cell) => parseInt(cell))
                  .sort((numA, numB) => numA - numB)
                  .map((num) => num.toString().padStart(2, '0')),
              };
            })
            .filter((item) => item);
            
          this.loading = false;
          this.currentPage = 1;
        },
      });
    },
    toggleSort() {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    },
    sortFrequency(column) {
      if (this.freqSortColumn === column)
        this.freqSortOrder = this.freqSortOrder === 'asc' ? 'desc' : 'asc';
      else {
        this.freqSortColumn = column;
        this.freqSortOrder = 'desc';
      }
    },
    cleanFilters() {
      this.filterStartDate = '';
    },
    toggleHighlight(number) {
      this.highlightNum = this.highlightNum === number ? null : number;
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
    getProgressBarColor(percent) {
      return percent > 30 ? 'bg-success' : percent > 15 ? 'bg-info' : 'bg-secondary';
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
        let sortedNumbersList;
        if (this.frequencyTable && this.frequencyTable.length > 0) {
          const sortedTable = [...this.frequencyTable].sort(
            (a, b) => b.count - a.count,
          );
          sortedNumbersList = sortedTable.map((item) => parseInt(item.number));
        } else {
          sortedNumbersList = Array.from(
            {
              length: 80,
            },
            (_, i) => i + 1,
          );
        }

        const chunks = [];
        const chunkSize = Math.ceil(sortedNumbersList.length / 5);
        for (let i = 0; i < 5; i++) {
          chunks.push(sortedNumbersList.slice(i * chunkSize, (i + 1) * chunkSize));
        }

        let bestGame = null;
        let attempts = 0;
        const maxAttempts = 5000;

        const primeNumbersList = [
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

          const sum = candidate.reduce((acc, curr) => acc + curr, 0);
          const evens = candidate.filter((n) => n % 2 === 0).length;
          const primes = candidate.filter((n) => primeNumbersList.includes(n)).length;

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
        const dateParts = this.filterStartDate.split('-');
        filterDateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        filterDateObj.setHours(0, 0, 0, 0);
      }
      const pastGames = this.results.filter((gameResult) => {
        const resultGameNumber = parseInt(gameResult.game);
        if (resultGameNumber >= currentGame) return false;
        if (filterDateObj) {
          const resultDateParts = gameResult.date.split('/');
          const resultDate = new Date(resultDateParts[2], resultDateParts[1] - 1, resultDateParts[0]);
          resultDate.setHours(0, 0, 0, 0);
          if (resultDate < filterDateObj) return false;
        }
        return true;
      });

      const countsMap = {};
      pastGames.forEach((gameResult) =>
        gameResult.numbers.forEach((ballNumber) => {
          countsMap[ballNumber] = (countsMap[ballNumber] || 0) + 1;
        }),
      );
      
      let sortedNumbersList =
        pastGames.length > 0
          ? Array.from(
              {
                length: 80,
              },
              (_, i) => (i + 1).toString().padStart(2, '0'),
            ).sort((a, b) => (countsMap[b] || 0) - (countsMap[a] || 0))
          : Array.from(
              {
                length: 80,
              },
              (_, i) => (i + 1).toString().padStart(2, '0'),
            );

      const chunks = [];
      for (let i = 0; i < 5; i++)
        chunks.push(sortedNumbersList.slice(i * 16, (i + 1) * 16));

      const targetNums = row.numbers.map((n) => parseInt(n));
      const sum = targetNums.reduce((acc, curr) => acc + curr, 0);
      const even = targetNums.filter((n) => n % 2 === 0).length;
      const primeNumbersList = [
        2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67,
        71, 73, 79,
      ];
      const primes = targetNums.filter((n) => primeNumbersList.includes(n)).length;

      const quintilePattern = [0, 0, 0, 0, 0];
      targetNums.forEach((n) => {
        const numberString = n.toString().padStart(2, '0');
        const chunkIndex = chunks.findIndex((chunk) => chunk.includes(numberString));
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
      const primeNumbersList = [
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
            const randomNumber = Math.floor(Math.random() * 80) + 1;
            if (!candidate.includes(randomNumber)) candidate.push(randomNumber);
          }

          candidate.sort((a, b) => a - b);
        } else {
          for (let i = 0; i < 5; i++) {
            const countNeeded = quintilePattern[i];
            if (countNeeded > 0) {
              const chunk = chunks[i];
              const picked = [];
              while (picked.length < countNeeded) {
                const randomNumber = chunk[Math.floor(Math.random() * chunk.length)];

                if (!picked.includes(randomNumber)) picked.push(randomNumber);
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
          const sum = candidate.reduce((acc, curr) => acc + parseInt(curr), 0);
          if (sum !== targetGame.sum) continue;

          const evens = candidate.filter((n) => parseInt(n) % 2 === 0).length;
          if (evens !== targetGame.even) continue;

          const primes = candidate.filter((n) =>
            primeNumbersList.includes(parseInt(n)),
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
      const minutes = Math.floor(diff / 60)
        .toString()
        .padStart(2, '0');
      const seconds = (diff % 60).toString().padStart(2, '0');
      this.simState.elapsedTime = `${minutes}:${seconds}`;

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
