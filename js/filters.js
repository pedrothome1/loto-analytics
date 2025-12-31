export const FiltersModule = {
  data() {
    return {
      sortOrder: 'desc',
      filters: {
        startDate: '', endDate: '', day: '', month: '', year: '', leapYear: false, 
        evenMin: '', evenMax: '', primeMin: '', primeMax: '', sumMin: '', sumMax: ''
      }
    };
  },
  computed: {
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
      if (f.evenMin !== '' || f.evenMax !== '') c++;
      if (f.primeMin !== '' || f.primeMax !== '') c++;
      if (f.sumMin !== '' || f.sumMax !== '') c++;
      return c;
    }
  },
  methods: {
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

      if (f.evenMin !== '' && s.even < parseInt(f.evenMin)) return false;
      if (f.evenMax !== '' && s.even > parseInt(f.evenMax)) return false;
      if (f.primeMin !== '' && s.primes < parseInt(f.primeMin)) return false;
      if (f.primeMax !== '' && s.primes > parseInt(f.primeMax)) return false;
      if (f.sumMin !== '' && s.sum < parseInt(f.sumMin)) return false;
      if (f.sumMax !== '' && s.sum > parseInt(f.sumMax)) return false;

      return true;
    },
    cleanFilters() {
      this.filters = {
        startDate: '', endDate: '', day: '', month: '', year: '', 
        leapYear: false, 
        evenMin: '', evenMax: '', primeMin: '', primeMax: '', 
        sumMin: '', sumMax: ''
      };
    },
    filterPastGames(currentGameId) {
      return this.results.filter(r => {
        if (parseInt(r.game) >= currentGameId) return false;
        return this.checkFilters(r);
      });
    },
    toggleSort() { this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc'; }
  }
};
