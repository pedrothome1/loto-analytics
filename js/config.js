export const LotteryPresets = {
  quina: {
    id: 'quina', name: 'Quina',
    totalNumbers: 80, pickSize: 5,
    limits: { minSum: 140, maxSum: 260, evenMin: '', evenMax: '', primeMin: '', primeMax: '' }
  },
  mega: {
    id: 'mega', name: 'Mega-Sena',
    totalNumbers: 60, pickSize: 6,
    limits: { minSum: 125, maxSum: 245, evenMin: '', evenMax: '', primeMin: '', primeMax: '' }
  },
  dupla: {
    id: 'dupla', name: 'Dupla Sena',
    totalNumbers: 50, pickSize: 6,
    limits: { minSum: 110, maxSum: 200, evenMin: '', evenMax: '', primeMin: '', primeMax: '' }
  },
  lotofacil: {
    id: 'lotofacil', name: 'Lotofácil',
    totalNumbers: 25, pickSize: 15,
    limits: { minSum: 160, maxSum: 230, evenMin: '', evenMax: '', primeMin: '', primeMax: '' }
  },
  diasorte: {
    id: 'diasorte', name: 'Dia de Sorte',
    totalNumbers: 31, pickSize: 7,
    limits: { minSum: 80, maxSum: 150, evenMin: '', evenMax: '', primeMin: '', primeMax: '' }
  }
};

export const AppConfig = {
  pageSize: 50,
  simBatchSize: { random: 5000, smart: 2000 }
};
