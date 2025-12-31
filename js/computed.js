import { LotteryConfig } from './config.js';
import { getHeatMapColor, generatePrimes } from './utils.js';

const PRIMES = generatePrimes(LotteryConfig.totalNumbers);

export const appComputed = {
  sortedResults() {
    let list = this.results.filter(r => this.checkFilters(r));

    return list.sort((a, b) => {
      const diff = parseInt(a.game) - parseInt(b.game);
      return this.sortOrder === 'asc' ? diff : -diff;
    });
  },

  activeFiltersCount() {
    let c = 0;
    const f = this.filters;
    if (f.startDate) c++;
    if (f.day) c++;
    if (f.month) c++;
    if (f.year) c++;
    if (f.leapYear) c++;
    if (f.evenCount !== '') c++;
    if (f.primeCount !== '') c++;
    if (f.sumMin !== '' || f.sumMax !== '') c++;
    return c;
  },

  totalPages() {
    return Math.ceil(this.sortedResults.length / this.pageSize) || 1;
  },

  paginatedResults() {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.sortedResults.slice(start, start + this.pageSize);
  },

  frequencyTable() {
    if (!this.sortedResults.length) return [];
    
    const counts = {};
    for (let i = 1; i <= LotteryConfig.totalNumbers; i++) {
      counts[i.toString().padStart(2, '0')] = 0;
    }

    this.sortedResults.forEach(r => r.numbers.forEach(n => counts[n]++));

    const vals = Object.values(counts);
    const min = Math.min(...vals);
    const max = Math.max(...vals);

    return Object.keys(counts).map(num => {
      const count = counts[num];
      const { bg, text } = getHeatMapColor(count, min, max);
      
      return {
        number: num,
        count,
        style: { backgroundColor: bg, color: text }
      };
    }).sort((a, b) => {
      if (this.freqSortColumn === 'number') {
        const diff = parseInt(a.number) - parseInt(b.number);
        return this.freqSortOrder === 'asc' ? diff : -diff;
      }
      return this.freqSortOrder === 'asc' ? a.count - b.count : b.count - a.count;
    });
  },

  evenOddStats() {
    return this.genericStats(
      r => r.numbers.filter(n => n % 2 === 0).length,
      c => `${c} Pares / ${LotteryConfig.pickSize - c} Ímpares`,
      'even'
    );
  },

  primeStats() {
    return this.genericStats(
      r => r.numbers.filter(n => PRIMES.includes(parseInt(n))).length,
      c => c === 1 ? '1 Primo' : `${c} Primos`,
      'qty'
    );
  },

  decadeStats() {
    if (!this.sortedResults.length) return [];
    const decadesCount = Math.ceil(LotteryConfig.totalNumbers / 10);
    const counts = Array(decadesCount).fill(0);
    
    this.sortedResults.forEach(r => 
      r.numbers.forEach(n => counts[Math.floor((parseInt(n) - 1) / 10)]++)
    );
    
    return counts.map((count, i) => {
      const start = i * 10;
      const label = `${start}-${start + 9}`.replace(/\b\d\b/g, '0$&'); 
      return { label, count };
    });
  },

  maxDecadeCount() {
    return Math.max(...(this.decadeStats.map(d => d.count) || [1]));
  },

  sumStats() {
    const stats = {};
    const total = this.sortedResults.length;
    
    this.sortedResults.forEach(r => {
      const sum = r.numbers.reduce((acc, n) => acc + parseInt(n), 0);
      const interval = Math.floor(sum / 20) * 20;
      
      if (!stats[interval]) {
        stats[interval] = { 
          label: `${interval}-${interval + 19}`, 
          count: 0, 
          start: interval 
        };
      }
      stats[interval].count++;
    });

    const max = Math.max(...Object.values(stats).map(s => s.count));
    
    return Object.values(stats)
      .map(s => ({
        ...s,
        percentTotal: ((s.count / total) * 100).toFixed(1),
        percentBar: (s.count / max) * 100
      }))
      .sort((a, b) => a.start - b.start);
  }
};
