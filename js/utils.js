// Gera lista de primos até o número máximo da loteria
export const generatePrimes = (max) => {
  const sieve = Array(max + 1).fill(true);
  sieve[0] = sieve[1] = false;
  for (let i = 2; i * i <= max; i++) {
    if (sieve[i]) {
      for (let j = i * i; j <= max; j += i) sieve[j] = false;
    }
  }
  return sieve.map((isPrime, i) => isPrime ? i : null).filter(n => n);
};

// Lógica de Cor (Heatmap) - Extraída de computed e methods
export const getHeatMapColor = (value, min, max) => {
  const range = max - min || 1;
  const ratio = (value - min) / range;
  
  if (ratio < 0.5) {
    const normalized = ratio / 0.5;
    const gb = Math.round(255 * normalized);
    return { bg: `rgb(255, ${gb}, ${gb})`, text: 'black' };
  } 
  
  const normalized = (ratio - 0.5) / 0.5;
  const r = Math.round(255 * (1 - normalized));
  const g = Math.round(255 - (75 * normalized));
  const b = Math.round(255 * (1 - normalized));
  return { 
    bg: `rgb(${r}, ${g}, ${b})`, 
    text: ratio > 0.8 ? 'white' : 'black' 
  };
};

// Estatísticas comuns de um jogo (Soma, Pares, Primos)
export const analyzeGame = (numbers, primeList) => {
  const nums = numbers.map(n => parseInt(n));
  return {
    sum: nums.reduce((a, b) => a + b, 0),
    even: nums.filter(n => n % 2 === 0).length,
    primes: nums.filter(n => primeList.includes(n)).length
  };
};

// Formata data e hora
export const formatTime = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};
