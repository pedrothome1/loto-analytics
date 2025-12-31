const {
  createApp
} = Vue;

createApp( {
  data() {
    return {
      loading: false, results: [], sortOrder: 'desc', filterStartDate: '',
      freqSortColumn: 'count', freqSortOrder: 'desc', highlightNum: null,
      currentPage: 1, pageSize: 50,
      generatedGame: null, // Armazena o jogo gerado
      generatorModal: null, // Referência ao modal
      genConfig: {
        minSum: 140, maxSum: 260, evenCount: 'any', primeCount: 'any'
      },
      detailsModal: null, // Referência ao modal do Bootstrap
      selectedDetails: null, // Dados do jogo selecionado para exibição
      previousGamesCount: 0, // Contador de quantos jogos serviram de base para a estatística
      simModal: null,
      simState: {
        running: false,
        attempts: 0,
        startTime: null,
        elapsedTime: '00:00',
        targetGame: null, // O jogo que queremos acertar
        bestTry: null, // A tentativa atual
        quintilePattern: [], // O padrão de quintis (ex: [2, 1, 1, 0, 1])
        chunks: [] // Os grupos de números usados na simulação
      },
      visitedBitmap: null, // Ocupará apenas 3MB
      combTable: null, // Tabela para cálculo rápido de combinações
    }
  },
  watch: {
    sortedResults() {
      this.currentPage = 1;
    }
  },
  computed: {
    sortedResults() {
      let lista = [...this.results];
      if (this.filterStartDate) {
        const p = this.filterStartDate.split('-');
        const d = new Date(p[0], p[1]-1, p[2]); d.setHours(0, 0, 0, 0);
        lista = lista.filter(r => {
          const pr = r.data.split('/');
          const ds = new Date(pr[2], pr[1]-1, pr[0]); ds.setHours(0, 0, 0, 0);
          return ds >= d;
        });
      }
      return lista.sort((a, b) => {
        const nA = parseInt(a.concurso), nB = parseInt(b.concurso);
        return this.sortOrder === 'asc' ? nA - nB: nB - nA;
      });
    },
    totalPages() {
      return Math.ceil(this.sortedResults.length / this.pageSize);
    },
    paginatedResults() {
      const s = (this.currentPage - 1) * this.pageSize;
      return this.sortedResults.slice(s, s + this.pageSize);
    },
    // Frequency Table para alimentar o gerador
    frequencyTable() {
      if (this.sortedResults.length === 0) return [];
      const c = {}; for (let i = 1; i <= 80; i++) c[i.toString().padStart(2, '0')] = 0;
      this.sortedResults.forEach(j => j.dezenas.forEach(b => {
        if (c[b] !== undefined) c[b]++
      }));

      const vals = Object.values(c);
      const min = Math.min(...vals), max = Math.max(...vals), rng = max-min || 1;

      return Object.keys(c).map(n => {
        const v = c[n], r = (v-min)/rng;
        let color = r < 0.5 ? `rgb(255, ${Math.round(255*r/0.5)}, ${Math.round(255*r/0.5)})`: `rgb(${Math.round(255*(1-(r-0.5)/0.5))}, ${Math.round(255-(75*(r-0.5)/0.5))}, ${Math.round(255*(1-(r-0.5)/0.5))})`;
        return {
          numero: n, count: v, style: {
            backgroundColor: color, color: (r < 0.2 || r > 0.8)?'white': 'black'
          }
        };
      }).sort((a,
        b) => this.freqSortOrder === 'asc' ? (this.freqSortColumn === 'numero'?parseInt(a.numero)-parseInt(b.numero): a.count-b.count): (this.freqSortColumn === 'numero'?parseInt(b.numero)-parseInt(a.numero): b.count-a.count));
    },
    // Estatísticas auxiliares (Resumidas para economizar espaço)
    parImparStats() {
      return this.genericStats((j)=>j.dezenas.filter(n => n%2 === 0).length, (p)=>`${p} Pares / ${5-p} Ímpares`, 'pares');
    },
    primosStats() {
      const pr = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79];
      return this.genericStats((j)=>j.dezenas.filter(n => pr.includes(parseInt(n))).length, (q)=>q === 1?'1 Primo': `${q} Primos`, 'qtd');
    },
    decadeStats() {
      if (!this.sortedResults.length) return [];
      const c = Array(9).fill(0);
      this.sortedResults.forEach(j => j.dezenas.forEach(b => c[Math.floor(parseInt(b)/10)]++));
      return c.map((cnt, i) => ({
        label: `${i*10}-${i*10+9}`.replace(/^(\d)-/, '0$1-').replace(/-(\d)$/, '-0$1'), count: cnt
      }));
    },
    maxDecadeCount() {
      return Math.max(...this.decadeStats.map(d => d.count) || 1);
    },
    sumStats() {
      const s = {}; const t = this.sortedResults.length;
      this.sortedResults.forEach(j => {
        const sum = j.dezenas.reduce((a, b)=>a+parseInt(b), 0);
        const k = Math.floor(sum/20)*20;
        if (!s[k]) s[k] = {
          label: `${k}-${k+19}`,
          count: 0,
          vi: k
        }; s[k].count++;
      });
      const mx = Math.max(...Object.values(s).map(v => v.count));
      return Object.values(s).map(i => ({
        ...i, percentTotal: ((i.count/t)*100).toFixed(1), percentBarra: (i.count/mx)*100
      })).sort((a, b)=>a.vi-b.vi);
    }
  },
  methods: {
    // Adicione em methods:
    initBitSetSystem() {
      // 1. Pré-calcula combinações (C(n, k)) para mapeamento rápido
      // Precisamos de n até 80 e k até 5
      this.combTable = Array(81).fill(0).map(() => Array(6).fill(0));

      for (let i = 0; i <= 80; i++) {
        this.combTable[i][0] = 1;
        for (let j = 1; j <= Math.min(i, 5); j++) {
          this.combTable[i][j] = this.combTable[i-1][j-1] + this.combTable[i-1][j];
        }
      }

      // 2. Aloca memória para 24.040.016 bits (aprox 3MB)
      // Se já existir, zera ele (fill 0) em vez de recriar para poupar Garbage Collection
      if (!this.visitedBitmap) {
        const totalCombinations = 24040016;
        const byteSize = Math.ceil(totalCombinations / 8);
        this.visitedBitmap = new Uint8Array(byteSize);
      } else {
        this.visitedBitmap.fill(0);
      }
    },

    // Função que transforma [1, 2, 3, 4, 5] em um ID único (0 a 24 milhões)
    getGameIndex(nums) {
      // nums deve estar ordenado e ser inteiros (ex: [1, 2, 3, 4, 5])
      // Fórmula: Combinatorial Number System
      let idx = 0;
      for (let i = 0; i < 5; i++) {
        // Ajustamos para 0-based index na lógica combinatorial (n-1)
        // Usamos a tabela pré-calculada: C(valor-1, posição+1)
        idx += this.combTable[nums[i] - 1][i + 1];
      }
      return idx;
    },

    openDetails(row) {
      const currentConcurso = parseInt(row.concurso);

      // 1. Identificar Data Inicial do Filtro Global (se houver)
      let filterDateObj = null;
      if (this.filterStartDate) {
        const p = this.filterStartDate.split('-');
        filterDateObj = new Date(p[0], p[1]-1, p[2]);
        filterDateObj.setHours(0, 0, 0, 0);
      }

      // 2. Filtrar jogos do Passado (Anteriores ao selecionado + Respeitando filtro)
      const pastGames = this.results.filter(r => {
        const rConcurso = parseInt(r.concurso);
        // Deve ser estritamente anterior ao concurso atual
        if (rConcurso >= currentConcurso) return false;

        // Se tiver filtro de data, deve respeitar
        if (filterDateObj) {
          const pr = r.data.split('/');
          const rDate = new Date(pr[2], pr[1]-1, pr[0]);
          rDate.setHours(0, 0, 0, 0);
          if (rDate < filterDateObj) return false;
        }
        return true;
      });

      this.previousGamesCount = pastGames.length;

      // 3. Calcular Frequência baseada APENAS nesse passado
      const counts = {};
      pastGames.forEach(j => j.dezenas.forEach(b => {
        if (!counts[b]) counts[b] = 0;
        counts[b]++;
      }));

      // Garante que os números do jogo atual existam no mapa (mesmo se for a 1ª vez saindo)
      row.dezenas.forEach(n => {
        if (!counts[n]) counts[n] = 0;
      });

      // 4. Gerar Cores (Recalcula Min/Max localmente para essa amostra)
      const vals = Object.values(counts);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const range = max - min || 1;

      const getColor = (val) => {
        const r = (val - min) / range;
        let bg, txt;
        if (r < 0.5) {
          const lr = r / 0.5;
          bg = `rgb(255, ${Math.round(255*lr)}, ${Math.round(255*lr)})`;
        } else {
          const lr = (r - 0.5) / 0.5;
          bg = `rgb(${Math.round(255*(1-lr))}, ${Math.round(255-(75*lr))}, ${Math.round(255*(1-lr))})`;
        }
        txt = (r < 0.2 || r > 0.8) ? 'white': 'black';
        return {
          backgroundColor: bg,
          color: txt
        };
      };

      // 5. Montar Objeto de Detalhes
      const nums = row.dezenas.map(n => parseInt(n));
      const primosList = [2,
        3,
        5,
        7,
        11,
        13,
        17,
        19,
        23,
        29,
        31,
        37,
        41,
        43,
        47,
        53,
        59,
        61,
        67,
        71,
        73,
        79];

      this.selectedDetails = {
        concurso: row.concurso,
        data: row.data,
        sum: nums.reduce((a, b)=>a+b, 0),
        even: nums.filter(n => n%2 === 0).length,
        primes: nums.filter(n => primosList.includes(n)).length,
        numbersWithColor: row.dezenas.map(n => ({
          val: n,
          style: getColor(counts[n] || 0)
        }))
      };

      // Abre o Modal
      if (!this.detailsModal) this.detailsModal = new bootstrap.Modal(document.getElementById('detailsModal'));
      this.detailsModal.show();
    },

    getNumberStyle(numeroStr) {
      // Procura o número na tabela de frequência já calculada
      if (!this.frequencyTable) return {};
      const encontrado = this.frequencyTable.find(item => item.numero === numeroStr);

      // Se achar, retorna o estilo (cor de fundo e cor do texto)
      return encontrado ? encontrado.style: {};
    },
    genericStats(countFn,
      labelFn,
      sortKey) {
      if (!this.sortedResults.length) return [];
      const s = {},
      t = this.sortedResults.length;
      this.sortedResults.forEach(j => {
        const v = countFn(j); const k = labelFn(v);
        if (!s[k]) s[k] = {
          count: 0,
          [sortKey]: v
        }; s[k].count++;
      });
      return Object.keys(s).map(k => ({
        label: k, count: s[k].count, percent: ((s[k].count/t)*100).toFixed(1), [sortKey]: s[k][sortKey]
      })).sort((a, b)=>a[sortKey]-b[sortKey]);
    },
    handleFileUpload(e) {
      const f = e.target.files[0]; if (!f) return;
      this.loading = true; this.results = []; this.highlightNum = null;
      Papa.parse(f, {
        header: false, skipEmptyLines: true, complete: (r) => {
          this.results = r.data.slice(1).map(row => {
            if (row.length < 3) return null;
            return {
              concurso: row[0],
              data: row[1],
              dezenas: row.slice(2, 7).filter(b => b && b.trim()).map(b => parseInt(b)).sort((a, b)=>a-b).map(b => b.toString().padStart(2, '0'))
            };
          }).filter(i => i);
          this.loading = false; this.currentPage = 1;
        }});
    },
    toggleSort() {
      this.sortOrder = this.sortOrder === 'asc'?'desc': 'asc';
    },
    sortFrequency(c) {
      if (this.freqSortColumn === c) this.freqSortOrder = this.freqSortOrder === 'asc'?'desc': 'asc'; else {
        this.freqSortColumn = c; this.freqSortOrder = 'desc'
      }
    },
    limparFiltros() {
      this.filterStartDate = '';
    },
    toggleHighlight(n) {
      this.highlightNum = this.highlightNum === n?null: n;
    },
    nextPage() {
      if (this.currentPage < this.totalPages) {
        this.currentPage++; document.getElementById('tabela-topo')?.scrollIntoView({
          behavior: 'smooth'
        });
      }},
    prevPage() {
      if (this.currentPage > 1) {
        this.currentPage--; document.getElementById('tabela-topo')?.scrollIntoView({
          behavior: 'smooth'
        });
      }},
    getProgressBarColor(p) {
      return p > 30?'bg-success': p > 15?'bg-info': 'bg-secondary';
    },

    openGenerator() {
      if (!this.generatorModal) this.generatorModal = new bootstrap.Modal(document.getElementById('generatorModal'));
      this.generateOptimizedGame();
      this.generatorModal.show();
    },
    generateOptimizedGame() {
      this.generatedGame = null; // Limpa para mostrar que está processando

      // Pequeno delay para a UI não travar
      setTimeout(() => {
        // 1. Obtém os números ordenados pela frequência (usando sua computed 'frequencyTable' já existente)
        // Se a tabela estiver vazia (sem arquivo), cria array de 1 a 80
        let sortedNums;
        if (this.frequencyTable && this.frequencyTable.length > 0) {
          // Ordena do mais frequente para o menos frequente
          const sortedTable = [...this.frequencyTable].sort((a, b) => b.count - a.count);
          sortedNums = sortedTable.map(item => parseInt(item.numero));
        } else {
          sortedNums = Array.from({
            length: 80
          }, (_, i) => i + 1);
        }

        // 2. Divide em 5 pedaços (Quintis) - Estratégia de espalhamento
        const chunks = [];
        const chunkSize = Math.ceil(sortedNums.length / 5);
        for (let i = 0; i < 5; i++) {
          chunks.push(sortedNums.slice(i * chunkSize, (i + 1) * chunkSize));
        }

        let bestGame = null;
        let attempts = 0;
        const maxAttempts = 5000; // Tenta 5000 vezes encontrar um jogo que obedeça as regras
        const primosList = [2,
          3,
          5,
          7,
          11,
          13,
          17,
          19,
          23,
          29,
          31,
          37,
          41,
          43,
          47,
          53,
          59,
          61,
          67,
          71,
          73,
          79];

        while (!bestGame && attempts < maxAttempts) {
          attempts++;

          // Sorteia 1 número de cada pedaço (garante espalhamento de frequência)
          let candidate = chunks.map(chunk => {
            if (!chunk || chunk.length === 0) return Math.floor(Math.random() * 80) + 1;
            return chunk[Math.floor(Math.random() * chunk.length)]
          });

          // Ordena e remove duplicatas (caso raro)
          candidate = [...new Set(candidate)].sort((a, b) => a - b);
          if (candidate.length !== 5) continue;

          // --- VALIDAÇÕES CONFIGURÁVEIS ---
          const sum = candidate.reduce((a, b) => a + b, 0);
          const evens = candidate.filter(n => n % 2 === 0).length;
          const primes = candidate.filter(n => primosList.includes(n)).length;

          // 1. Valida Soma (Input do usuário)
          if (sum < this.genConfig.minSum || sum > this.genConfig.maxSum) continue;

          // 2. Valida Pares
          if (this.genConfig.evenCount !== 'any') {
            // Se usuário escolheu um número exato
            if (evens !== parseInt(this.genConfig.evenCount)) continue;
          } else {
            // Lógica automática: Evita 0 pares ou 5 pares (extremos)
            if (evens === 0 || evens === 5) continue;
          }

          // 3. Valida Primos
          if (this.genConfig.primeCount !== 'any') {
            // Se usuário escolheu número exato
            if (primes !== parseInt(this.genConfig.primeCount)) continue;
          } else {
            // Lógica automática: Máximo 3 primos
            if (primes > 3) continue;
          }

          // Se passou por tudo, temos um vencedor!
          bestGame = {
            numbers: candidate.map(n => n.toString().padStart(2, '0')),
            sum: sum,
            even: evens,
            primes: primes
          };
        }

        if (bestGame) {
          this.generatedGame = bestGame;
        } else {
          alert("Não foi possível gerar um jogo com essas regras exatas após 5000 tentativas. Tente aumentar a faixa de soma ou mudar os pares/primos.");
        }
      },
        50);
    },

    openSimulation(row) {
      // 1. Preparar dados (Igual anterior)
      const currentConcurso = parseInt(row.concurso);
      let filterDateObj = null;
      if (this.filterStartDate) {
        const p = this.filterStartDate.split('-');
        filterDateObj = new Date(p[0], p[1]-1, p[2]);
        filterDateObj.setHours(0, 0, 0, 0);
      }
      const pastGames = this.results.filter(r => {
        const rConcurso = parseInt(r.concurso);
        if (rConcurso >= currentConcurso) return false;
        if (filterDateObj) {
          const pr = r.data.split('/');
          const rDate = new Date(pr[2], pr[1]-1, pr[0]);
          rDate.setHours(0, 0, 0, 0);
          if (rDate < filterDateObj) return false;
        }
        return true;
      });

      // 2. Calcular Frequência
      const counts = {};
      pastGames.forEach(j => j.dezenas.forEach(b => {
        counts[b] = (counts[b] || 0) + 1
      }));
      let sortedNums = pastGames.length > 0
      ? Array.from({
        length: 80
      },
        (_, i)=>(i+1).toString().padStart(2, '0')).sort((a, b) => (counts[b] || 0) - (counts[a] || 0)): Array.from({
          length: 80
        },
        (_, i)=>(i+1).toString().padStart(2, '0'));

      const chunks = [];
      for (let i = 0; i < 5; i++) chunks.push(sortedNums.slice(i*16, (i+1)*16));

      // 3. Analisar Alvo
      const targetNums = row.dezenas.map(n => parseInt(n));
      const sum = targetNums.reduce((a, b)=>a+b, 0);
      const even = targetNums.filter(n => n%2 === 0).length;
      const primesList = [2,
        3,
        5,
        7,
        11,
        13,
        17,
        19,
        23,
        29,
        31,
        37,
        41,
        43,
        47,
        53,
        59,
        61,
        67,
        71,
        73,
        79];
      const primes = targetNums.filter(n => primesList.includes(n)).length;

      const quintilePattern = [0,
        0,
        0,
        0,
        0];
      targetNums.forEach(n => {
        const strN = n.toString().padStart(2, '0');
        const chunkIndex = chunks.findIndex(chunk => chunk.includes(strN));
        if (chunkIndex !== -1) quintilePattern[chunkIndex]++;
      });

      // 4. Configura Estado Inicial (SEM RODAR AINDA)
      this.simState = {
        running: false, // MUDANÇA: Começa parado
        mode: 'smart', // MUDANÇA: Padrão inteligente
        attempts: 0,
        startTime: null,
        elapsedTime: '00:00',
        targetGame: {
          concurso: row.concurso, dezenas: row.dezenas, sum, even, primes
        },
        bestTry: ['..', '..', '..', '..', '..'],
        quintilePattern: quintilePattern,
        chunks: chunks
      };

      if (!this.simModal) this.simModal = new bootstrap.Modal(document.getElementById('simModal'));
      this.simModal.show();
    },

    // NOVO MÉTODO PARA O BOTÃO "INICIAR"
    startSim() {
      this.simState.running = true;
      this.simState.startTime = Date.now();
      this.simState.attempts = 0;

      // INICIA O SISTEMA DE 3MB
      this.initBitSetSystem();

      this.runSimLoop();
    },


    runSimLoop() {
      if (!this.simState.running) return;

      const {
        chunks,
        quintilePattern,
        targetGame,
        mode
      } = this.simState;
      const targetStr = targetGame.dezenas.join(',');
      const primesList = [2,
        3,
        5,
        7,
        11,
        13,
        17,
        19,
        23,
        29,
        31,
        37,
        41,
        43,
        47,
        53,
        59,
        61,
        67,
        71,
        73,
        79];

      // Define o tamanho do lote por frame
      // Modo aleatório é mais rápido de gerar, então processamos mais por vez
      const batchSize = mode === 'random' ? 5000: 2000;
      let batch = 0;

      while (batch < batchSize) {
        batch++;

        let candidate = [];

        // --- 1. GERAÇÃO DOS NÚMEROS ---
        if (mode === 'random') {
          // Modo Aleatório: Sorteia 5 números únicos de 1 a 80
          while (candidate.length < 5) {
            const rnd = Math.floor(Math.random() * 80) + 1;
            if (!candidate.includes(rnd)) candidate.push(rnd);
          }
          // Ordena numéricamente para o cálculo do índice funcionar
          candidate.sort((a, b) => a - b);

        } else {
          // Modo Inteligente: Respeita os Quintis (Frequência)
          for (let i = 0; i < 5; i++) {
            const countNeeded = quintilePattern[i];
            if (countNeeded > 0) {
              const chunk = chunks[i];
              const picked = [];
              while (picked.length < countNeeded) {
                const rnd = chunk[Math.floor(Math.random() * chunk.length)];
                // Garante unicidade dentro da seleção
                if (!picked.includes(rnd)) picked.push(rnd);
              }
              candidate.push(...picked);
            }
          }
          candidate.sort((a, b) => parseInt(a) - parseInt(b));
        }

        // --- 2. OTIMIZAÇÃO DE MEMÓRIA (BITSET) ---
        // Calcula o ID único deste jogo (0 a 24 milhões)
        const gameIndex = this.getGameIndex(candidate);

        // Localiza o bit exato na memória de 3MB
        const byteIndex = Math.floor(gameIndex / 8);
        const bitIndex = gameIndex % 8;

        // Se o bit já estiver ligado (1), já tentamos esse jogo. Pula.
        if ((this.visitedBitmap[byteIndex] & (1 << bitIndex)) !== 0) {
          continue;
        }

        // Marca como tentado (liga o bit)
        this.visitedBitmap[byteIndex] |= (1 << bitIndex);

        // Incrementa tentativas (agora garantidamente únicas)
        this.simState.attempts++;


        // --- 3. FILTROS ESTATÍSTICOS (Apenas Modo Inteligente) ---
        if (mode === 'smart') {
          // Como sabemos o futuro, descartamos o que não bate com o alvo
          const sum = candidate.reduce((a, b)=>a+parseInt(b), 0);
          if (sum !== targetGame.sum) continue;

          const evens = candidate.filter(n => parseInt(n)%2 === 0).length;
          if (evens !== targetGame.even) continue;

          const primes = candidate.filter(n => primesList.includes(parseInt(n))).length;
          if (primes !== targetGame.primes) continue;
        }


        // --- 4. VERIFICAÇÃO DE VITÓRIA ---
        // Formata para string ("01", "05"...) para comparar visualmente e com o alvo
        const candidateFormatted = candidate.map(n => n.toString().padStart(2, '0'));

        // Atualiza a visualização a cada 500 iterações (para não travar a tela)
        if (batch % 500 === 0) this.simState.bestTry = candidateFormatted;

        // Se acertou
        if (candidateFormatted.join(',') === targetStr) {
          this.simState.bestTry = candidateFormatted;
          this.simState.running = false;

          // Pequeno delay para a UI atualizar antes do alerta
          setTimeout(() => {
            alert(`ACERTOU (${mode === 'smart' ? 'Inteligente': 'Aleatório'})!\nJogos Únicos Testados: ${this.simState.attempts.toLocaleString()}\nTempo: ${this.simState.elapsedTime}`);
          }, 10);
          return; // Sai do loop e da função
        }
      }

      // --- 5. ATUALIZAÇÃO DE TEMPO E LOOP ---
      const diff = Math.floor((Date.now() - this.simState.startTime) / 1000);
      const m = Math.floor(diff / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      this.simState.elapsedTime = `${m}:${s}`;

      // Chama o próximo quadro de animação
      if (this.simState.running) {
        requestAnimationFrame(this.runSimLoop);
      }
    },

    stopSim() {
      this.simState.running = false;
    },

    resetSim() {
      this.simState.running = false;
      this.simState.attempts = 0; // Isso faz voltar para a tela 1
      this.simState.elapsedTime = '00:00';
      this.simState.bestTry = ['..',
        '..',
        '..',
        '..',
        '..'];
    },
  }
}).mount('#app');