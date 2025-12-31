import { AppConfig } from './config.js';
import { getHeatMapColor, analyzeGame } from './utils.js';

export const UiModule = {
  data() {
    return {
      currentPage: 1,
      pageSize: AppConfig.pageSize,
      highlightNum: null,
      detailsModal: null,
      selectedDetails: null,
      previousGamesCount: 0,
      freqSortColumn: 'count',
      freqSortOrder: 'desc',
    };
  },
  watch: {
    sortedResults() { this.currentPage = 1; }
  },
  computed: {
    totalPages() {
      return Math.ceil(this.sortedResults.length / this.pageSize) || 1;
    },
    paginatedResults() {
      const start = (this.currentPage - 1) * this.pageSize;
      return this.sortedResults.slice(start, start + this.pageSize);
    }
  },
  methods: {
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

      const stats = analyzeGame(row.numbers, this.primes);

      this.selectedDetails = {
        ...row, ...stats,
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
    toggleHighlight(num) { this.highlightNum = this.highlightNum === num ? null : num; },
    nextPage() { if (this.currentPage < this.totalPages) this.changePage(1); },
    prevPage() { if (this.currentPage > 1) this.changePage(-1); },
    changePage(dir) {
      this.currentPage += dir;
      document.getElementById('tabela-topo')?.scrollIntoView({ behavior: 'smooth' });
    },
    sortFrequency(col) {
      if (this.freqSortColumn === col) {
        this.freqSortOrder = this.freqSortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        this.freqSortColumn = col;
        this.freqSortOrder = 'desc';
      }
    },
    getProgressBarColor(p) { return p > 30 ? 'bg-success' : p > 15 ? 'bg-info' : 'bg-secondary'; }
  }
};
