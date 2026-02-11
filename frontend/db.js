// IndexedDB wrapper for offline storage and sync queue management
class TaskDB {
  constructor() {
    this.dbName = 'TaskAppDB';
    this.dbVersion = 4; // Increment version for new stores
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Tasks store
        if (!db.objectStoreNames.contains('tasks')) {
          const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
          taskStore.createIndex('categoryId', 'categoryId', { unique: false });
          taskStore.createIndex('done', 'done', { unique: false });
          taskStore.createIndex('updated_at', 'updated_at', { unique: false });
          taskStore.createIndex('order', 'order', { unique: false });
        }

        // Categories store
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }

        // Tags store
        if (!db.objectStoreNames.contains('tags')) {
          db.createObjectStore('tags', { keyPath: 'id' });
        }

        // Sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('status', 'status', { unique: false });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Metadata store for sync timestamps
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }

        // Periodic tasks stores
        if (!db.objectStoreNames.contains('dailyTasks')) {
          const dailyTaskStore = db.createObjectStore('dailyTasks', { keyPath: 'id' });
          dailyTaskStore.createIndex('categoryId', 'categoryId', { unique: false });
          dailyTaskStore.createIndex('done', 'done', { unique: false });
          dailyTaskStore.createIndex('updated_at', 'updated_at', { unique: false });
          dailyTaskStore.createIndex('order', 'order', { unique: false });
        }

        if (!db.objectStoreNames.contains('weeklyTasks')) {
          const weeklyTaskStore = db.createObjectStore('weeklyTasks', { keyPath: 'id' });
          weeklyTaskStore.createIndex('categoryId', 'categoryId', { unique: false });
          weeklyTaskStore.createIndex('done', 'done', { unique: false });
          weeklyTaskStore.createIndex('updated_at', 'updated_at', { unique: false });
          weeklyTaskStore.createIndex('order', 'order', { unique: false });
        }

        if (!db.objectStoreNames.contains('monthlyTasks')) {
          const monthlyTaskStore = db.createObjectStore('monthlyTasks', { keyPath: 'id' });
          monthlyTaskStore.createIndex('categoryId', 'categoryId', { unique: false });
          monthlyTaskStore.createIndex('done', 'done', { unique: false });
          monthlyTaskStore.createIndex('updated_at', 'updated_at', { unique: false });
          monthlyTaskStore.createIndex('order', 'order', { unique: false });
        }

        // Periodic categories stores
        if (!db.objectStoreNames.contains('dailyCategories')) {
          db.createObjectStore('dailyCategories', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('weeklyCategories')) {
          db.createObjectStore('weeklyCategories', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('monthlyCategories')) {
          db.createObjectStore('monthlyCategories', { keyPath: 'id' });
        }

        // Periodic tags stores
        if (!db.objectStoreNames.contains('dailyTags')) {
          db.createObjectStore('dailyTags', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('weeklyTags')) {
          db.createObjectStore('weeklyTags', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('monthlyTags')) {
          db.createObjectStore('monthlyTags', { keyPath: 'id' });
        }
      };
    });
  }

  // Tasks CRUD operations
  async getAllTasks(listType = 'main') {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'tasks' : `${listType}Tasks`;
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getTask(id, listType = 'main') {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'tasks' : `${listType}Tasks`;
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveTask(task, listType = 'main') {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'tasks' : `${listType}Tasks`;
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      // Ensure timestamps
      const now = Date.now();
      if (!task.created_at) task.created_at = now;
      task.updated_at = now;

      const request = store.put(task);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTask(id, listType = 'main') {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'tasks' : `${listType}Tasks`;
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // Categories CRUD operations
  async getAllCategories(listType = 'main') {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'categories' : `${listType}Categories`;
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveCategory(category, listType = 'main') {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'categories' : `${listType}Categories`;
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(category);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async createCategory(category, listType = 'main') {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'categories' : `${listType}Categories`;
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(category);

      request.onsuccess = () => {
        console.log('Category created in IndexedDB:', category);
        resolve(request.result);
      };
      request.onerror = () => {
        console.error('Failed to create category in IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  async getCategory(id, listType = 'main') {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'categories' : `${listType}Categories`;
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateCategory(category, listType = 'main') {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'categories' : `${listType}Categories`;
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(category);

      request.onsuccess = () => {
        console.log('Category updated in IndexedDB:', category);
        resolve(request.result);
      };
      request.onerror = () => {
        console.error('Failed to update category in IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  async deleteCategory(id, listType = 'main') {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'categories' : `${listType}Categories`;
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // Tags CRUD operations
  async getAllTags(listType = 'main') {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'tags' : `${listType}Tags`;
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveTag(tag, listType = 'main') {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'tags' : `${listType}Tags`;
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(tag);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async createTag(tag, listType = 'main') {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'tags' : `${listType}Tags`;
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(tag);

      request.onsuccess = () => {
        console.log('Tag created in IndexedDB:', tag);
        resolve(request.result);
      };
      request.onerror = () => {
        console.error('Failed to create tag in IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  async getTag(id, listType = 'main') {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'tags' : `${listType}Tags`;
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateTag(tag, listType = 'main') {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'tags' : `${listType}Tags`;
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(tag);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTag(id, listType = 'main') {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'tags' : `${listType}Tags`;
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // Sync queue operations
  async addToSyncQueue(operation) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');

      const syncItem = {
        id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        operation: operation,
        status: 'pending',
        timestamp: Date.now()
      };

      const request = store.add(syncItem);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getSyncQueue() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onsuccess = () => {
        const operations = (request.result || []).map(item => ({
          id: item.id,
          ...item.operation
        }));
        resolve(operations);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async removeSyncOperation(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingSyncItems() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async markSyncItemCompleted(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');

      const request = store.get(id);
      request.onsuccess = () => {
        const item = request.result;
        if (item) {
          item.status = 'completed';
          const updateRequest = store.put(item);
          updateRequest.onsuccess = () => resolve(true);
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve(false);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async markSyncItemFailed(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');

      const request = store.get(id);
      request.onsuccess = () => {
        const item = request.result;
        if (item) {
          item.status = 'failed';
          const updateRequest = store.put(item);
          updateRequest.onsuccess = () => resolve(true);
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve(false);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearCompletedSyncItems() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const index = store.index('status');
      const request = index.openCursor(IDBKeyRange.only('completed'));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve(true);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearOldSyncOperations(olderThanTimestamp = Date.now() - 300000) { // 5 minutes ago
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const index = store.index('timestamp');
      const request = index.openCursor(IDBKeyRange.upperBound(olderThanTimestamp));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve(true);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Metadata operations
  async getMetadata(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['metadata'], 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result ? request.result.value : null);
      request.onerror = () => reject(request.error);
    });
  }

  async setMetadata(key, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['metadata'], 'readwrite');
      const store = transaction.objectStore('metadata');
      const request = store.put({ key, value });

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllMetadata() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['metadata'], 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.getAll();

      request.onsuccess = () => {
        const metadata = {};
        (request.result || []).forEach(item => {
          metadata[item.key] = item.value;
        });
        resolve(metadata);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Bulk operations for sync
  async bulkSaveTasks(tasks) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tasks'], 'readwrite');
      const store = transaction.objectStore('tasks');

      let completed = 0;
      const total = tasks.length;

      tasks.forEach(task => {
        const request = store.put(task);
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve(true);
          }
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async bulkSaveCategories(categories) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['categories'], 'readwrite');
      const store = transaction.objectStore('categories');

      let completed = 0;
      const total = categories.length;

      categories.forEach(category => {
        const request = store.put(category);
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve(true);
          }
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async bulkSaveTags(tags) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tags'], 'readwrite');
      const store = transaction.objectStore('tags');

      let completed = 0;
      const total = tags.length;

      tags.forEach(tag => {
        const request = store.put(tag);
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve(true);
          }
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  // Bulk operations for specific list types
  async bulkSaveTasksToList(tasks, listType) {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'tasks' : `${listType}Tasks`;
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      let completed = 0;
      const total = tasks.length;

      tasks.forEach(task => {
        const request = store.put(task);
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve(true);
          }
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async clearTasksList(listType) {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'tasks' : `${listType}Tasks`;
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async bulkSaveCategoriesToList(categories, listType) {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'categories' : `${listType}Categories`;
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      let completed = 0;
      const total = categories.length;

      categories.forEach(category => {
        const request = store.put(category);
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve(true);
          }
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async bulkSaveTagsToList(tags, listType) {
    return new Promise((resolve, reject) => {
      const storeName = listType === 'main' ? 'tags' : `${listType}Tags`;
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      let completed = 0;
      const total = tags.length;

      tags.forEach(tag => {
        const request = store.put(tag);
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve(true);
          }
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  // Migration from localStorage
  async migrateFromLocalStorage() {
    try {
      const storedState = localStorage.getItem('tasks-app');
      if (!storedState) return false;

      const state = JSON.parse(storedState);

      // Migrate categories
      if (state.categories && state.categories.length > 0) {
        await this.bulkSaveCategories(state.categories);
      }

      // Migrate tags
      if (state.tags && state.tags.length > 0) {
        await this.bulkSaveTags(state.tags);
      }

      // Migrate tasks
      if (state.tasks && state.tasks.length > 0) {
        await this.bulkSaveTasks(state.tasks);
      }

      // Clear localStorage after successful migration
      localStorage.removeItem('tasks-app');

      console.log('Migration from localStorage completed');
      return true;
    } catch (error) {
      console.error('Migration failed:', error);
      return false;
    }
  }
}

// Export singleton instance
const taskDB = new TaskDB();

export { taskDB };
