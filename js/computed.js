export const appComputed = {
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
           const normalizedRatio = ratio / 0.5;
           const greenBlue = Math.round(255 * normalizedRatio);
           color = `rgb(255, ${greenBlue}, ${greenBlue})`;
        } else {
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
};
