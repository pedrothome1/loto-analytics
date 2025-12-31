export const LotteryConfig = {
  name: 'Quina',
  totalNumbers: 80, // Total de bolas (1-80)
  pickSize: 5,      // Quantos números são sorteados
  
  // Configurações padrão para o gerador
  defaultGenConfig: {
    minSum: 140,
    maxSum: 260,
    evenMin: '', 
    evenMax: '', 
    primeMin: '', 
    primeMax: '', 
  },

  // Para paginação e performance
  pageSize: 50,
  
  // Simulação
  simBatchSize: {
    random: 5000,
    smart: 2000
  }
};
