(function () {
  const memory = new Map();
  let nativeStorage = null;
  let failureReported = false;

  function reportFailure(error) {
    if (failureReported) return;
    failureReported = true;
    console.warn('O navegador bloqueou o armazenamento local. O Prisma manterá um cache temporário e sincronizará a conta pelo Firestore.', error);
  }

  try {
    nativeStorage = window.localStorage;
    const probe = `__prisma_storage_probe_${Date.now()}`;
    nativeStorage.setItem(probe, '1');
    nativeStorage.removeItem(probe);
  } catch (error) {
    nativeStorage = null;
    reportFailure(error);
  }

  const storage = {
    get length() {
      try {
        if (nativeStorage) return nativeStorage.length;
      } catch (error) {
        nativeStorage = null;
        reportFailure(error);
      }
      return memory.size;
    },
    key(index) {
      try {
        if (nativeStorage) {
          const value = nativeStorage.key(index);
          if (value !== null) return value;
        }
      } catch (error) {
        nativeStorage = null;
        reportFailure(error);
      }
      return Array.from(memory.keys())[index] || null;
    },
    getItem(key) {
      const normalizedKey = String(key);
      try {
        if (nativeStorage) {
          const value = nativeStorage.getItem(normalizedKey);
          if (value !== null) memory.set(normalizedKey, value);
          return value;
        }
      } catch (error) {
        nativeStorage = null;
        reportFailure(error);
      }
      return memory.has(normalizedKey) ? memory.get(normalizedKey) : null;
    },
    setItem(key, value) {
      const normalizedKey = String(key);
      const normalizedValue = String(value);
      memory.set(normalizedKey, normalizedValue);
      try {
        if (nativeStorage) nativeStorage.setItem(normalizedKey, normalizedValue);
      } catch (error) {
        nativeStorage = null;
        reportFailure(error);
      }
      window.dispatchEvent(new CustomEvent('prisma-storage-changed', { detail: { key: normalizedKey } }));
    },
    removeItem(key) {
      const normalizedKey = String(key);
      memory.delete(normalizedKey);
      try {
        if (nativeStorage) nativeStorage.removeItem(normalizedKey);
      } catch (error) {
        nativeStorage = null;
        reportFailure(error);
      }
    },
    clear() {
      memory.clear();
      try {
        if (nativeStorage) nativeStorage.clear();
      } catch (error) {
        nativeStorage = null;
        reportFailure(error);
      }
    }
  };

  window.PrismaStorage = storage;
})();
