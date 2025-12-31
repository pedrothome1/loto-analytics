export const LotteryConfig = {
  // Metadados
  name: 'Quina',
  totalNumbers: 80, // Total de bolas
  pickSize: 5,      // Quantos números sortear
  
  // Limites para filtros e validações
  limits: {
    minSum: 140, // Soma mínima viável estatisticamente
    maxSum: 260, // Soma máxima viável estatisticamente
    
    // Intervalos padrão para o gerador e simulação
    // Deixamos 'null' ou strings vazias para indicar "sem filtro"
    evenMin: '', evenMax: '',
    primeMin: '', primeMax: ''
  },

  // Configurações de UI e Performance
  pageSize: 50,
  simBatchSize: {
    random: 5000,
    smart: 2000 // ou baseado em tempo (12ms) como alteramos no methods
  }
};
