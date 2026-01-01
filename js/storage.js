export const StorageService = {
  dbName: 'LotteryAnalystDB',
  version: 1,
  db: null,

  async init() {
    if (this.db) return;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        // Store para os resultados dos jogos (CSV processado)
        if (!db.objectStoreNames.contains('results')) {
          db.createObjectStore('results');
        }
        // Store para configurações e filtros
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };

      request.onerror = (e) => reject(e);
    });
  },

  async set(storeName, key, value) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      // Usamos JSON.parse(JSON.stringify) para remover Proxies do Vue
      const request = store.put(JSON.parse(JSON.stringify(value)), key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async get(storeName, key) {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  }
};
