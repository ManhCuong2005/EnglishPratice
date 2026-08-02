const DB_NAME = 'vocabloom-db';
const DB_VERSION = 3;

let databasePromise;

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Giao dịch dữ liệu đã bị hủy.'));
  });
}

export function openDatabase() {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('Trình duyệt này không hỗ trợ IndexedDB.'));
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains('sets')) {
          const sets = db.createObjectStore('sets', { keyPath: 'id' });
          sets.createIndex('updatedAt', 'updatedAt');
          sets.createIndex('createdAt', 'createdAt');
        }

        if (!db.objectStoreNames.contains('sessions')) {
          const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
          sessions.createIndex('setId', 'setId');
          sessions.createIndex('completedAt', 'completedAt');
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('listeningLessons')) {
          const lessons = db.createObjectStore('listeningLessons', { keyPath: 'id' });
          lessons.createIndex('updatedAt', 'updatedAt');
          lessons.createIndex('createdAt', 'createdAt');
          lessons.createIndex('exam', 'exam');
        }

        if (!db.objectStoreNames.contains('quizSets')) {
          const quizzes = db.createObjectStore('quizSets', { keyPath: 'id' });
          quizzes.createIndex('updatedAt', 'updatedAt');
          quizzes.createIndex('createdAt', 'createdAt');
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          databasePromise = undefined;
        };
        resolve(db);
      };
      request.onerror = () => {
        databasePromise = undefined;
        reject(request.error);
      };
      request.onblocked = () => {
        databasePromise = undefined;
        reject(new Error('Vui lòng đóng các tab Vocabloom khác rồi thử lại.'));
      };
    });
  }

  return databasePromise;
}

async function withStore(storeName, mode, action) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, mode);
  const result = await action(tx.objectStore(storeName));
  await transactionDone(tx);
  return result;
}

export const db = {
  async getSets() {
    const result = await withStore('sets', 'readonly', (store) => requestToPromise(store.getAll()));
    return result.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  getSet(id) {
    return withStore('sets', 'readonly', (store) => requestToPromise(store.get(id)));
  },

  putSet(set) {
    return withStore('sets', 'readwrite', (store) => requestToPromise(store.put(set)));
  },

  async deleteSet(id) {
    const database = await openDatabase();
    const tx = database.transaction(['sets', 'sessions'], 'readwrite');
    tx.objectStore('sets').delete(id);
    const cursorRequest = tx.objectStore('sessions').index('setId').openCursor(IDBKeyRange.only(id));
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
    await transactionDone(tx);
  },

  getSessions() {
    return withStore('sessions', 'readonly', (store) => requestToPromise(store.getAll()));
  },

  putSession(session) {
    return withStore('sessions', 'readwrite', (store) => requestToPromise(store.put(session)));
  },

  async getListeningLessons() {
    const result = await withStore('listeningLessons', 'readonly', (store) => requestToPromise(store.getAll()));
    return result.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  putListeningLesson(lesson) {
    return withStore('listeningLessons', 'readwrite', (store) => requestToPromise(store.put(lesson)));
  },

  deleteListeningLesson(id) {
    return withStore('listeningLessons', 'readwrite', (store) => requestToPromise(store.delete(id)));
  },

  async getQuizSets() {
    const result = await withStore('quizSets', 'readonly', (store) => requestToPromise(store.getAll()));
    return result.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  putQuizSet(quizSet) {
    return withStore('quizSets', 'readwrite', (store) => requestToPromise(store.put(quizSet)));
  },

  deleteQuizSet(id) {
    return withStore('quizSets', 'readwrite', (store) => requestToPromise(store.delete(id)));
  },

  async getSettings() {
    const rows = await withStore('settings', 'readonly', (store) => requestToPromise(store.getAll()));
    return Object.fromEntries(rows.map(({ key, value }) => [key, value]));
  },

  putSetting(key, value) {
    return withStore('settings', 'readwrite', (store) => requestToPromise(store.put({ key, value })));
  },

  async exportAll() {
    const [sets, sessions, settings, listeningLessons, quizSets] = await Promise.all([
      this.getSets(),
      this.getSessions(),
      this.getSettings(),
      this.getListeningLessons(),
      this.getQuizSets(),
    ]);
    return {
      app: 'Vocabloom',
      version: 3,
      exportedAt: new Date().toISOString(),
      data: { sets, sessions, settings, listeningLessons, quizSets },
    };
  },

  async importAll(backup, replace = false) {
    if (backup?.app !== 'Vocabloom' || !backup?.data || !Array.isArray(backup.data.sets)) {
      throw new Error('File sao lưu không đúng định dạng Vocabloom.');
    }

    const database = await openDatabase();
    const tx = database.transaction(['sets', 'sessions', 'settings', 'listeningLessons', 'quizSets'], 'readwrite');
    const setsStore = tx.objectStore('sets');
    const sessionsStore = tx.objectStore('sessions');
    const settingsStore = tx.objectStore('settings');
    const listeningStore = tx.objectStore('listeningLessons');
    const quizStore = tx.objectStore('quizSets');

    if (replace) {
      setsStore.clear();
      sessionsStore.clear();
      settingsStore.clear();
      listeningStore.clear();
      quizStore.clear();
    }

    backup.data.sets.forEach((item) => setsStore.put(item));
    (backup.data.sessions || []).forEach((item) => sessionsStore.put(item));
    (backup.data.listeningLessons || []).forEach((item) => listeningStore.put(item));
    (backup.data.quizSets || []).forEach((item) => quizStore.put(item));
    Object.entries(backup.data.settings || {}).forEach(([key, value]) => settingsStore.put({ key, value }));
    await transactionDone(tx);
  },

  async clearAll() {
    const database = await openDatabase();
    const tx = database.transaction(['sets', 'sessions', 'settings', 'listeningLessons', 'quizSets'], 'readwrite');
    tx.objectStore('sets').clear();
    tx.objectStore('sessions').clear();
    tx.objectStore('settings').clear();
    tx.objectStore('listeningLessons').clear();
    tx.objectStore('quizSets').clear();
    await transactionDone(tx);
  },
};
