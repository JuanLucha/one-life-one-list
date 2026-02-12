// API client for backend communication
import { taskDB } from './db.js';

class TaskAPI {
  constructor(baseURL = 'http://localhost:5005') {
    this.baseURL = baseURL;
  }

  getToken() {
    return localStorage.getItem('auth_token') || '';
  }

  setToken(token) {
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  async verifyToken(token) {
    const res = await fetch(`${this.baseURL}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return res.json();
  }

  async request(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const finalOptions = { ...options, headers: { ...headers, ...(options.headers || {}) } };

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, finalOptions);

      if (response.status === 401) {
        // Dispatch auth failure event for the UI to handle
        window.dispatchEvent(new CustomEvent('auth-required'));
        throw new Error('Authentication required');
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseText = await response.text();
      if (responseText.trim() === '') return null;

      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Failed to parse JSON response');
      }
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Health check
  async health() {
    return this.request('/api/health');
  }

  // Tasks API
  async getTasks(listType = 'main') {
    if (listType === 'main') {
      return this.request('/api/tasks');
    } else {
      return this.request(`/api/periodic-tasks/${listType}`);
    }
  }

  async createTask(task, listType = 'main') {
    if (listType === 'main') {
      return this.request('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(task)
      });
    } else {
      return this.request(`/api/periodic-tasks/${listType}`, {
        method: 'POST',
        body: JSON.stringify(task)
      });
    }
  }

  async updateTask(id, task, listType = 'main') {
    try {
      if (listType === 'main') {
        return this.request(`/api/tasks/${id}`, {
          method: 'PUT',
          body: JSON.stringify(task)
        });
      } else {
        return this.request(`/api/periodic-tasks/${listType}/${id}`, {
          method: 'PUT',
          body: JSON.stringify(task)
        });
      }
    } catch (error) {
      // If task doesn't exist (404), try to create it
      if (error.message.includes('HTTP error! status: 404')) {
        return this.createTask(task, listType);
      }
      throw error;
    }
  }

  async deleteTask(id, listType = 'main') {
    if (listType === 'main') {
      return this.request(`/api/tasks/${id}`, {
        method: 'DELETE'
      });
    } else {
      return this.request(`/api/periodic-tasks/${listType}/${id}`, {
        method: 'DELETE'
      });
    }
  }

  // Categories API
  async getCategories(listType = 'main') {
    if (listType === 'main') {
      return this.request('/api/categories');
    } else {
      return this.request(`/api/periodic-categories/${listType}`);
    }
  }

  async createCategory(category, listType = 'main') {
    if (listType === 'main') {
      return this.request('/api/categories', {
        method: 'POST',
        body: JSON.stringify(category)
      });
    } else {
      return this.request(`/api/periodic-categories/${listType}`, {
        method: 'POST',
        body: JSON.stringify(category)
      });
    }
  }

  // Tags API
  async getTags(listType = 'main') {
    if (listType === 'main') {
      return this.request('/api/tags');
    } else {
      return this.request(`/api/periodic-tags/${listType}`);
    }
  }

  async createTag(tag, listType = 'main') {
    if (listType === 'main') {
      return this.request('/api/tags', {
        method: 'POST',
        body: JSON.stringify(tag)
      });
    } else {
      return this.request(`/api/periodic-tags/${listType}`, {
        method: 'POST',
        body: JSON.stringify(tag)
      });
    }
  }

  // Reset periodic tasks
  async resetPeriodicTasks(listType) {
    return this.request(`/api/periodic-tasks/${listType}/reset`, {
      method: 'POST'
    });
  }

  // Sync API
  async syncPull(since = 0) {
    return this.request(`/api/sync?since=${since}`);
  }

  async syncPush(operations, clientVersion = 0) {
    return this.request('/api/sync', {
      method: 'POST',
      body: JSON.stringify({
        operations: operations,
        client_version: clientVersion
      })
    });
  }
}

// Sync manager for handling offline/online synchronization
class SyncManager {
  constructor(db, api) {
    this.db = db;
    this.api = api;
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.lastSyncTimestamp = 0;

    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.sync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  async init() {
    // Clear old sync operations (older than 5 minutes)
    await this.db.clearOldSyncOperations();

    // Get last sync timestamp
    this.lastSyncTimestamp = await this.db.getMetadata('lastSync') || 0;

    // Initial sync if online
    if (this.isOnline) {
      await this.sync();
    }
  }

  async sync() {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;

    try {
      // Step 1: Push pending changes to server
      await this.pushChanges();

      // Step 2: Pull changes from server
      await this.pullChanges();

      // Step 3: Update last sync timestamp
      this.lastSyncTimestamp = Date.now();
      await this.db.setMetadata('lastSync', this.lastSyncTimestamp);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  async pullChanges() {
    try {
      const serverData = await this.api.syncPull(this.lastSyncTimestamp);

      // Update local data with server changes
      if (serverData.tasks && serverData.tasks.length > 0) {
        await this.db.bulkSaveTasks(serverData.tasks);
      }

      if (serverData.categories && serverData.categories.length > 0) {
        await this.db.bulkSaveCategories(serverData.categories);
      }

      if (serverData.tags && serverData.tags.length > 0) {
        await this.db.bulkSaveTags(serverData.tags);
      }

      // Update current version
      if (serverData.current_version) {
        await this.db.setMetadata('serverVersion', serverData.current_version);
        this.lastSyncTimestamp = serverData.current_version;
      }
    } catch (error) {
      console.error('Failed to pull changes:', error);
      throw error;
    }
  }

  async pushChanges() {
    const operations = await this.db.getSyncQueue();
    if (operations.length === 0) {
      return { success: true, synced: 0 };
    }

    let synced = 0;
    let errors = [];

    for (const operation of operations) {
      try {
        let response;

        switch (operation.type) {
          case 'CREATE':
            if (operation.entity === 'task') {
              response = await this.api.createTask(operation.data, operation.listType);
            } else if (operation.entity === 'category') {
              response = await this.api.createCategory(operation.data, operation.listType);
            } else if (operation.entity === 'tag') {
              response = await this.api.createTag(operation.data, operation.listType);
            }
            break;
          case 'UPDATE':
            if (operation.entity === 'task') {
              response = await this.api.updateTask(operation.data.id, operation.data, operation.listType);
            } else if (operation.entity === 'category') {
              response = await this.api.updateCategory(operation.data.id, operation.data, operation.listType);
            } else if (operation.entity === 'tag') {
              response = await this.api.updateTag(operation.data.id, operation.data, operation.listType);
            }
            break;
          case 'DELETE':
            if (operation.entity === 'task') {
              response = await this.api.deleteTask(operation.data.id, operation.listType);
            } else if (operation.entity === 'category') {
              response = await this.api.deleteCategory(operation.data.id, operation.listType);
            } else if (operation.entity === 'tag') {
              response = await this.api.deleteTag(operation.data.id, operation.listType);
            }
            break;
          default:
            throw new Error(`Unknown operation type: ${operation.type}`);
        }

        await this.db.removeSyncOperation(operation.id);
        synced++;
      } catch (error) {
        console.error(`❌ Failed to sync operation:`, operation.type, error.message);
        errors.push({ operation, error: error.message });
      }
    }

    return { success: errors.length === 0, synced, errors };
  }

  // Queue operations for sync
  async queueOperation(type, entity, data, listType = 'main') {
    const operation = {
      type: type,
      entity: entity,
      data: data,
      listType: listType,
      timestamp: Date.now()
    };

    const syncId = await this.db.addToSyncQueue(operation);

    // Register background sync if available
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-tasks');
      } catch (error) {
        console.log('Background sync registration failed:', error);
      }
    }

    // Try to sync immediately if online
    if (this.isOnline && !this.syncInProgress) {
      setTimeout(() => this.sync(), 100);
    }

    return syncId;
  }

  // Task operations with sync
  async createTask(task, listType = 'main') {
    // Save locally first
    await this.db.saveTask(task, listType);

    // Queue for sync
    await this.queueOperation('CREATE', 'task', task, listType);
  }

  async updateTask(task, listType = 'main') {
    // Save locally first
    await this.db.saveTask(task, listType);

    // Queue for sync
    await this.queueOperation('UPDATE', 'task', task, listType);
  }

  async deleteTask(taskId, listType = 'main') {
    // Get task data before deleting
    const task = await this.db.getTask(taskId, listType);

    // Delete locally
    await this.db.deleteTask(taskId, listType);

    // Queue for sync
    await this.queueOperation('DELETE', 'task', { id: taskId }, listType);
  }

  // Category operations with sync
  async createCategory(category, listType = 'main') {
    // Save locally
    await this.db.createCategory(category, listType);

    // Queue for sync
    await this.queueOperation('CREATE', 'category', category, listType);
  }

  async updateCategory(category, listType = 'main') {
    // Update locally
    await this.db.updateCategory(category, listType);

    // Queue for sync
    await this.queueOperation('UPDATE', 'category', category, listType);
  }

  async deleteCategory(categoryId, listType = 'main') {
    // Get category data before deleting
    const category = await this.db.getCategory(categoryId, listType);

    // Delete locally
    await this.db.deleteCategory(categoryId, listType);

    // Queue for sync
    await this.queueOperation('DELETE', 'category', { id: categoryId }, listType);
  }

  // Tag operations with sync
  async createTag(tag, listType = 'main') {
    await this.db.saveTag(tag, listType);
    await this.queueOperation('CREATE', 'tag', tag, listType);
  }

  // Get data methods (read from local DB)
  async getTasks(listType = 'main') {
    if (listType === 'main') {
      return this.db.getAllTasks();
    } else {
      return this.db.getAllTasks(listType);
    }
  }

  async getCategories(listType = 'main') {
    if (listType === 'main') {
      return this.db.getAllCategories();
    } else {
      return this.db.getAllCategories(listType);
    }
  }

  async getTags(listType = 'main') {
    if (listType === 'main') {
      return this.db.getAllTags();
    } else {
      return this.db.getAllTags(listType);
    }
  }

  // Force sync
  async forceSync() {
    await this.sync();
  }

  // Get metadata
  async getMetadata(key = null) {
    if (key) {
      return await this.db.getMetadata(key);
    } else {
      return await this.db.getAllMetadata();
    }
  }

  // Save metadata
  async saveMetadata(metadata) {
    if (typeof metadata === 'object' && metadata.key !== undefined) {
      // Single key-value pair
      await this.db.setMetadata(metadata.key, metadata.value);
    } else {
      // Multiple key-value pairs
      for (const [key, value] of Object.entries(metadata)) {
        await this.db.setMetadata(key, value);
      }
    }
  }

  // Load periodic list data specifically
  async loadPeriodicList(listType) {
    if (!this.isOnline) {
      return;
    }

    try {
      // Clear local tasks first to ensure clean sync
      await this.db.clearTasksList(listType);

      // Fetch tasks, categories, and tags for this list type
      const [tasks, categories, tags] = await Promise.all([
        this.api.getTasks(listType),
        this.api.getCategories(listType),
        this.api.getTags(listType)
      ]);

      // Save to local DB
      await Promise.all([
        this.db.bulkSaveTasksToList(tasks, listType),
        this.db.bulkSaveCategoriesToList(categories, listType),
        this.db.bulkSaveTagsToList(tags, listType)
      ]);

      console.log(`✅ Loaded ${listType} list: ${tasks.length} tasks, ${categories.length} categories, ${tags.length} tags`);
    } catch (error) {
      console.error(`❌ Failed to load ${listType} list:`, error);
    }
  }
}

// Export instances
const api = new TaskAPI();
let syncManager = null;

// Initialize sync manager when DB is ready
export async function initSync() {
  try {
    await taskDB.init();

    // Try migration from localStorage
    const migrated = await taskDB.migrateFromLocalStorage();
    if (migrated) {
      console.log('Successfully migrated from localStorage');
    }

    syncManager = new SyncManager(taskDB, api);
    await syncManager.init();

    return syncManager;
  } catch (error) {
    console.error('Failed to initialize sync:', error);
    throw error;
  }
}

export { TaskAPI, api, syncManager };
