// -----------------------
// State Management
// -----------------------

// Import sync manager (will be available after initialization)
let syncManager = null;

let state = {
  currentList: 'main', // 'main' | 'daily' | 'weekly' | 'monthly'
  categories: [],
  tags: [],
  tasks: [],
  dailyTasks: [],
  weeklyTasks: [],
  monthlyTasks: [],
  dailyCategories: [],
  weeklyCategories: [],
  monthlyCategories: [],
  dailyTags: [],
  weeklyTags: [],
  monthlyTags: [],
  filters: {
    selectedCategoryId: null,
    selectedTagIds: [],
  },
  uiMode: "list", // "list" | "edit" | "new"
  editingTaskId: null,
  isLoading: true,
  syncStatus: 'offline', // 'offline' | 'syncing' | 'synced' | 'error'
};

/**
 * Initialize the app with IndexedDB and sync
 */
async function initializeApp() {
  try {
    // Show loading state
    updateSyncStatus('syncing');

    // Initialize sync manager
    const { initSync } = await import('./api.js');
    syncManager = await initSync();

    // Load initial data
    await loadState();

    // Set up event listeners
    // Event listeners are set up in DOMContentLoaded

    // Render initial view
    render();

    // Hide loading state
    state.isLoading = false;
    updateSyncStatus('synced');

    console.log('App initialized successfully');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    state.isLoading = false;
    updateSyncStatus('error');

    // Try to load from localStorage as fallback
    loadFromLocalStorageFallback();
  }
}

/**
 * Load state from IndexedDB via sync manager
 */
async function loadState() {
  if (!syncManager) {
    console.warn('SyncManager not available, using fallback');
    loadFromLocalStorageFallback();
    return;
  }

  try {
    // Load main list
    state.categories = await syncManager.getCategories();
    state.tags = await syncManager.getTags();
    state.tasks = await syncManager.getTasks();

    // Load periodic lists
    state.dailyTasks = await syncManager.getTasks('daily');
    state.dailyCategories = await syncManager.getCategories('daily');
    state.dailyTags = await syncManager.getTags('daily');

    state.weeklyTasks = await syncManager.getTasks('weekly');
    state.weeklyCategories = await syncManager.getCategories('weekly');
    state.weeklyTags = await syncManager.getTags('weekly');

    state.monthlyTasks = await syncManager.getTasks('monthly');
    state.monthlyCategories = await syncManager.getCategories('monthly');
    state.monthlyTags = await syncManager.getTags('monthly');

    // Check and reset periodic tasks if needed
    await checkAndResetPeriodicTasks();

    // Ensure all tasks have an order field for stable sorting/reordering
    const tasksMissingOrder = state.tasks.filter(t => typeof t.order !== 'number');
    if (tasksMissingOrder.length > 0) {
      const now = Date.now();
      for (let i = 0; i < tasksMissingOrder.length; i++) {
        const t = tasksMissingOrder[i];
        t.order = now + i;
        t.updated_at = now;
        await syncManager.updateTask(t);
      }

      // Reload tasks after normalizing order
      state.tasks = await syncManager.getTasks();
    }

    // If IndexedDB is empty, sync from server
    if (state.tasks.length === 0 && state.categories.length === 0) {
      await syncManager.forceSync();

      // Reload after sync
      state.categories = await syncManager.getCategories();
      state.tags = await syncManager.getTags();
      state.tasks = await syncManager.getTasks();

      // Reload periodic lists too
      state.dailyTasks = await syncManager.getTasks('daily');
      state.dailyCategories = await syncManager.getCategories('daily');
      state.dailyTags = await syncManager.getTags('daily');

      state.weeklyTasks = await syncManager.getTasks('weekly');
      state.weeklyCategories = await syncManager.getCategories('weekly');
      state.weeklyTags = await syncManager.getTags('weekly');

      state.monthlyTasks = await syncManager.getTasks('monthly');
      state.monthlyCategories = await syncManager.getCategories('monthly');
      state.monthlyTags = await syncManager.getTags('monthly');

    }
  } catch (error) {
    console.error('Failed to load state:', error);
    loadFromLocalStorageFallback();
  }
}

/**
 * Fallback: Load from localStorage if IndexedDB fails
 */
function loadFromLocalStorageFallback() {
  const storedState = localStorage.getItem('tasks-app');
  if (storedState) {
    const parsedState = JSON.parse(storedState);
    state.categories = parsedState.categories || [];
    state.tags = parsedState.tags || [];
    state.tasks = parsedState.tasks || [];
  } else {
    // Use initial example state
    const initialState = getInitialState();
    state.categories = initialState.categories;
    state.tags = initialState.tags;
    state.tasks = initialState.tasks;
  }

  // Event listeners are set up in DOMContentLoaded
  render();
}

/**
 * Generate a unique ID for new items
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Get current list data based on selected list type
 * @returns {Object} - { tasks, categories, tags }
 */
function getCurrentListData() {
  switch (state.currentList) {
    case 'daily':
      return {
        tasks: state.dailyTasks,
        categories: state.dailyCategories,
        tags: state.dailyTags
      };
    case 'weekly':
      return {
        tasks: state.weeklyTasks,
        categories: state.weeklyCategories,
        tags: state.weeklyTags
      };
    case 'monthly':
      return {
        tasks: state.monthlyTasks,
        categories: state.monthlyCategories,
        tags: state.monthlyTags
      };
    default:
      return {
        tasks: state.tasks,
        categories: state.categories,
        tags: state.tags
      };
  }
}

/**
 * Switch to a different list
 * @param {string} listType - 'main', 'daily', 'weekly', 'monthly'
 */
async function switchToList(listType) {
  state.currentList = listType;

  // Reset filters when switching lists
  state.filters = {
    selectedCategoryId: null,
    selectedTagIds: []
  };

  // Update navigation UI immediately
  updateNavigationUI();

  // Re-render with new list data
  render();

  // Load periodic list data if needed and online (non-blocking)
  if (listType !== 'main' && syncManager && syncManager.isOnline) {
    try {
      await syncManager.loadPeriodicList(listType);
      // Reload state after loading
      await loadState();
      // Re-render with fresh data
      render();
    } catch (error) {
      console.error('Failed to load periodic list, using local data:', error);
    }
  }
}

/**
 * Update navigation UI to show active list
 */
function updateNavigationUI() {
  // Update mobile navigation
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.classList.remove('active');
    if (item.dataset.list === state.currentList) {
      item.classList.add('active');
    }
  });

  // Update desktop navigation tabs
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.classList.remove('active');
    if (button.dataset.list === state.currentList) {
      button.classList.add('active');
    }
  });

  // Update page title
  const titles = {
    main: 'One Life One List',
    daily: 'Acciones Diarias',
    weekly: 'Acciones Semanales',
    monthly: 'Acciones Mensuales'
  };
  document.title = titles[state.currentList] || 'One Life One List';

  // Update h1 title
  const h1 = document.querySelector('h1.title');
  if (h1) {
    h1.textContent = titles[state.currentList] || 'One Life One List';
  }
}

/**
 * Check and reset periodic tasks if needed
 */
async function checkAndResetPeriodicTasks() {
  const now = new Date();
  const today = now.toDateString(); // e.g., "Mon Dec 04 2023"
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const currentDate = now.getDate(); // 1-31
  const isMonday = currentDay === 1;
  const isFirstOfMonth = currentDate === 1;

  // Get last reset times from metadata
  const lastReset = await getLastResetTimes();

  // Check daily reset (every day at 00:00)
  if (lastReset.daily !== today) {
    console.log('Resetting daily tasks');
    await resetPeriodicTasks('daily');
    await updateLastResetTime('daily', today);
  }

  // Check weekly reset (every Monday at 00:00)
  if (isMonday && lastReset.weekly !== today) {
    console.log('Resetting weekly tasks');
    await resetPeriodicTasks('weekly');
    await updateLastResetTime('weekly', today);
  }

  // Check monthly reset (every 1st at 00:00)
  if (isFirstOfMonth && lastReset.monthly !== today) {
    console.log('Resetting monthly tasks');
    await resetPeriodicTasks('monthly');
    await updateLastResetTime('monthly', today);
  }
}

/**
 * Get last reset times from storage
 */
async function getLastResetTimes() {
  if (syncManager) {
    try {
      const metadata = await syncManager.getMetadata();
      return metadata.lastReset || { daily: null, weekly: null, monthly: null };
    } catch (error) {
      console.error('Failed to get last reset times:', error);
    }
  }

  // Fallback to localStorage
  const stored = localStorage.getItem('periodic-reset-times');
  if (stored) {
    return JSON.parse(stored);
  }
  return { daily: null, weekly: null, monthly: null };
}

/**
 * Update last reset time
 */
async function updateLastResetTime(type, date) {
  if (syncManager) {
    try {
      const metadata = await syncManager.getMetadata();
      if (!metadata.lastReset) metadata.lastReset = {};
      metadata.lastReset[type] = date;
      await syncManager.saveMetadata(metadata);
    } catch (error) {
      console.error('Failed to update last reset time:', error);
    }
  }

  // Fallback to localStorage
  const lastReset = await getLastResetTimes();
  lastReset[type] = date;
  localStorage.setItem('periodic-reset-times', JSON.stringify(lastReset));
}

/**
 * Reset completion status of periodic tasks
 */
async function resetPeriodicTasks(type) {
  let tasks;
  switch (type) {
    case 'daily':
      tasks = state.dailyTasks;
      break;
    case 'weekly':
      tasks = state.weeklyTasks;
      break;
    case 'monthly':
      tasks = state.monthlyTasks;
      break;
    default:
      return;
  }

  const now = Date.now();
  let hasChanges = false;

  tasks.forEach(task => {
    if (task.done) {
      task.done = false;
      task.updated_at = now;
      // Reset subtasks too
      if (task.subtasks) {
        task.subtasks.forEach(subtask => {
          if (subtask.done) {
            subtask.done = false;
          }
        });
      }
      hasChanges = true;
    }
  });

  if (hasChanges && syncManager) {
    try {
      // Save all updated tasks
      for (const task of tasks) {
        await syncManager.updateTask(task, type);
      }
      await syncManager.forceSync();

      // Reload the specific list
      await loadPeriodicList(type);
    } catch (error) {
      console.error(`Failed to reset ${type} tasks:`, error);
    }
  }
}

/**
 * Load a specific periodic list
 */
async function loadPeriodicList(type) {
  if (!syncManager) return;

  try {
    switch (type) {
      case 'daily':
        state.dailyTasks = await syncManager.getTasks('daily');
        state.dailyCategories = await syncManager.getCategories('daily');
        state.dailyTags = await syncManager.getTags('daily');
        break;
      case 'weekly':
        state.weeklyTasks = await syncManager.getTasks('weekly');
        state.weeklyCategories = await syncManager.getCategories('weekly');
        state.weeklyTags = await syncManager.getTags('weekly');
        break;
      case 'monthly':
        state.monthlyTasks = await syncManager.getTasks('monthly');
        state.monthlyCategories = await syncManager.getCategories('monthly');
        state.monthlyTags = await syncManager.getTags('monthly');
        break;
    }
  } catch (error) {
    console.error(`Failed to load ${type} list:`, error);
  }
}

/**
 * Get contrasting text color for background color
 * @param {string} hexColor - Hex color code
 * @returns {string} - 'white' or 'black'
 */
function getContrastColor(hexColor) {
  // If no color provided, default to black
  if (!hexColor) return 'black';

  // Remove # if present
  const color = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black for light colors, white for dark colors
  return luminance > 0.5 ? 'black' : 'white';
}

/**
 * Update sync status in UI and button
 * @param {string} status - 'offline', 'syncing', 'synced', 'error'
 */
function updateSyncStatus(status) {
  state.syncStatus = status;

  const syncButton = document.getElementById('sync-button');
  if (!syncButton) return;

  // Remove all status classes
  syncButton.classList.remove('synced', 'syncing', 'error');

  // Add appropriate class and update tooltip
  switch (status) {
    case 'synced':
      syncButton.classList.add('synced');
      syncButton.title = 'Synced - Click to force sync';
      break;
    case 'syncing':
      syncButton.classList.add('syncing');
      syncButton.title = 'Syncing...';
      break;
    case 'error':
      syncButton.classList.add('error');
      syncButton.title = 'Sync Error - Click to retry';
      break;
    default:
      syncButton.title = 'Sync Status - Click to sync';
  }
}

/**
 * Get human-readable status text
 * @param {string} status 
 * @returns {string}
 */
function getStatusText(status) {
  switch (status) {
    case 'syncing': return 'Syncing...';
    case 'synced': return 'Synced';
    case 'offline': return 'Offline';
    case 'error': return 'Sync Error';
    default: return 'Unknown';
  }
}

// -----------------------
// Task Operations
// -----------------------

/**
 * Save a task (create or update) using sync manager
 * @param {object} task - Task object
 * @param {string} listType - List type ('main', 'daily', 'weekly', 'monthly')
 */
async function saveTask(task, listType = 'main') {
  if (!syncManager) {
    // Fallback to localStorage
    saveToLocalStorage();
    return;
  }

  try {
    // Get the appropriate task list
    let taskList;
    switch (listType) {
      case 'daily':
        taskList = state.dailyTasks;
        break;
      case 'weekly':
        taskList = state.weeklyTasks;
        break;
      case 'monthly':
        taskList = state.monthlyTasks;
        break;
      default:
        taskList = state.tasks;
    }

    if (task.id && taskList.find(t => t.id === task.id)) {
      // Update existing task
      await syncManager.updateTask(task, listType);
    } else {
      // Create new task
      if (!task.id) {
        task.id = generateId();
      }
      await syncManager.createTask(task, listType);
    }

    // Reload state to reflect changes
    await loadState();
    render();
  } catch (error) {
    console.error('Failed to save task:', error);
    // Fallback to localStorage
    saveToLocalStorage();
  }
}

/**
 * Delete a task using sync manager
 * @param {string} taskId - Task ID
 */
async function deleteTask(taskId) {
  if (!syncManager) {
    // Fallback to localStorage
    state.tasks = state.tasks.filter(task => task.id !== taskId);
    saveToLocalStorage();
    render();
    return;
  }

  try {
    await syncManager.deleteTask(taskId);

    // Reload state to reflect changes
    await loadState();
    render();
  } catch (error) {
    console.error('Failed to delete task:', error);
    // Fallback to localStorage
    state.tasks = state.tasks.filter(task => task.id !== taskId);
    saveToLocalStorage();
    render();
  }
}

/**
 * Save a category using sync manager
 * @param {object} category - Category object
 * @param {string} listType - List type ('main', 'daily', 'weekly', 'monthly')
 */
async function saveCategory(category, listType = 'main') {
  if (!syncManager) {
    // Fallback to localStorage
    saveToLocalStorage();
    return;
  }

  try {
    if (!category.id) {
      category.id = generateId();
    }
    await syncManager.createCategory(category, listType);

    // Reload state
    await loadState();
    render();
  } catch (error) {
    console.error('Failed to save category:', error);
    // Fallback to localStorage
    saveToLocalStorage();
  }
}

/**
 * Save a tag using sync manager
 * @param {object} tag - Tag object
 * @param {string} listType - List type ('main', 'daily', 'weekly', 'monthly')
 */
async function saveTag(tag, listType = 'main') {
  if (!syncManager) {
    // Fallback to localStorage
    saveToLocalStorage();
    return;
  }

  try {
    if (!tag.id) {
      tag.id = generateId();
    }
    await syncManager.createTag(tag, listType);

    // Reload state
    await loadState();
    render();
  } catch (error) {
    console.error('Failed to save tag:', error);
    // Fallback to localStorage
    saveToLocalStorage();
  }
}

/**
 * Fallback: Save state to localStorage
 */
function saveToLocalStorage() {
  const stateToSave = {
    categories: state.categories,
    tags: state.tags,
    tasks: state.tasks
  };
  localStorage.setItem('tasks-app', JSON.stringify(stateToSave));
}

/**
 * Force sync with server
 */
async function forceSync() {
  if (!syncManager) {
    console.warn('Sync manager not available');
    return;
  }

  try {
    updateSyncStatus('syncing');
    await syncManager.forceSync();
    await loadState();
    render();
    updateSyncStatus('synced');
  } catch (error) {
    console.error('Force sync failed:', error);
    updateSyncStatus('error');
  }
}

function getInitialState() {
  return {
    categories: [
      { id: 'cat1', name: 'Personal', color: '#e8e5ff' },
      { id: 'cat2', name: 'Work', color: '#ffebee' },
      { id: 'cat3', name: 'Hobby', color: '#fff3e0' },
    ],
    tags: [
      { id: 'tag1', name: 'urgent', color: '#ff6b6b' },
      { id: 'tag2', name: 'learning', color: '#4ecdc4' },
      { id: 'tag3', name: 'health', color: '#45b7d1' },
      { id: 'tag4', name: 'home', color: '#96ceb4' },
      { id: 'tag5', name: 'work', color: '#ffeaa7' },
      { id: 'tag6', name: 'personal', color: '#dfe6e9' }
    ],
    tasks: [
      {
        id: 'task1',
        name: 'Buy groceries',
        description: 'Milk, Bread, Cheese',
        categoryId: 'cat1',
        tagIds: ['tag4'],
        subtasks: [{ id: 'sub1', name: 'Buy milk', done: false }],
        done: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'task2',
        name: 'Finish report for work',
        description: 'Complete the Q3 sales report.',
        categoryId: 'cat2',
        tagIds: ['tag4'],
        subtasks: [],
        done: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'task3',
        name: 'Play Super Mario Odyssey',
        description: 'Defeat Bowser!',
        categoryId: 'cat3',
        tagIds: ['tag1', 'tag3'],
        subtasks: [],
        done: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'task4',
        name: 'Read a book',
        description: 'The new sci-fi novel.',
        categoryId: 'cat1',
        tagIds: ['tag5'],
        subtasks: [],
        done: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'task5',
        name: 'Watch a movie',
        description: 'The latest action movie.',
        categoryId: 'cat1',
        tagIds: ['tag6'],
        subtasks: [],
        done: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
    ]
  };
}

// -----------------------
// DOM Elements
// -----------------------
const listView = document.getElementById('list-view');
const newTaskView = document.getElementById('new-task-view');
const taskList = document.getElementById('task-list');
const completedTaskList = document.getElementById('completed-task-list');
const categoryFilters = document.getElementById('category-filters');
const tagFilters = document.getElementById('tag-filters');

// Categories management elements
const backToListFromCategoriesButton = document.getElementById('back-to-list-from-categories');
const newCategoryInput = document.getElementById('new-category-input');
const categoriesList = document.getElementById('categories-list');
const addCategoryButton = document.getElementById('add-category-button');
const addCategoryManageButton = document.getElementById('add-category-manage-button');

// View elements
const categoriesView = document.getElementById('categories-view');
const newTaskError = document.getElementById('new-task-error');
const newTaskNameInput = document.getElementById('new-task-name');
const newTaskDescriptionInput = document.getElementById('new-task-description');
const newTaskCategorySelect = document.getElementById('new-task-category');
const newTaskNewCategoryInput = document.getElementById('new-task-new-category');
const newTaskTagsContainer = document.getElementById('new-task-tags');
const newTaskNewTagInput = document.getElementById('new-task-new-tag');
const newTaskSubtasksContainer = document.getElementById('new-task-subtasks');
const newSubtaskInput = document.getElementById('new-task-new-subtask');
const addSubtaskButton = document.getElementById('add-subtask-button');
const resetFiltersButton = document.getElementById('reset-filters-button');
const addTagButton = document.getElementById('add-tag-button');
const syncButton = document.getElementById('sync-button');
const newTaskButton = document.getElementById('new-task-button');
const saveTaskButton = document.getElementById('save-task-button');
const cancelButton = document.getElementById('cancel-button');
const deleteTaskButton = document.getElementById('delete-task-button');

// -----------------------
// Router Setup
// -----------------------

// Wait for router to be available
function setupRouter() {
  if (setupRouter._initialized) return;
  if (window.router) {
    console.log('Router available, setting up routes');
    setupRouter._initialized = true;

    // Register routes
    window.router.register('/', () => {
      console.log('Router: Home route');
      state.uiMode = 'list';
      state.editingTaskId = null;
      render();
    });

    window.router.register('/new', () => {
      console.log('Router: New task route');
      openNew();
    });

    window.router.register('/edit/:id', (params) => {
      console.log('Router: Edit task route with ID:', params.id);

      // Ensure data is loaded before trying to edit
      if (state.tasks.length === 0) {
        console.log('Router: No tasks loaded, loading data first...');
        loadState().then(() => {
          console.log('Router: Data loaded, retrying edit...');
          const task = state.tasks.find(t => t.id === params.id);
          if (task) {
            openEdit(task.id);
          } else {
            console.error('Router: Task still not found after loading:', params.id);
            window.router.navigate('/');
          }
        }).catch(error => {
          console.error('Router: Failed to load data:', error);
          window.router.navigate('/');
        });
      } else {
        const task = state.tasks.find(t => t.id === params.id);
        console.log('Router: Found task:', task);
        if (task) {
          console.log('Router: Calling openEdit with task ID:', task.id);
          openEdit(task.id);
        } else {
          console.error('Router: Task not found:', params.id);
          window.router.navigate('/');
        }
      }
    });

    window.router.register('/categories', () => {
      console.log('Router: Categories route');
      openCategoriesView();
    });

    console.log('Router setup completed');
  } else {
    console.log('Router not available yet, retrying in 10ms');
    setTimeout(setupRouter, 10);
  }
}

// Setup router when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupRouter);
} else {
  setupRouter();
}

// -----------------------
// Main Render Function
// -----------------------

function render() {
  renderTaskList();
  renderFilters();
  renderUI();
}

// -----------------------
// UI Rendering
// -----------------------

function renderUI() {
  if (state.uiMode === 'list') {
    listView.classList.remove('is-hidden');
    newTaskView.classList.add('is-hidden');
    categoriesView.classList.add('is-hidden');
  } else if (state.uiMode === 'new') {
    listView.classList.add('is-hidden');
    newTaskView.classList.remove('is-hidden');
    categoriesView.classList.add('is-hidden');
  } else if (state.uiMode === 'edit') {
    listView.classList.add('is-hidden');
    newTaskView.classList.remove('is-hidden');
    categoriesView.classList.add('is-hidden');
  } else if (state.uiMode === 'categories') {
    listView.classList.add('is-hidden');
    newTaskView.classList.add('is-hidden');
    categoriesView.classList.remove('is-hidden');
  }

  // New Task FAB should only be visible on root route
  if (newTaskButton) {
    const isRootRoute = window.location.pathname === '/';
    if (isRootRoute && state.uiMode === 'list') {
      newTaskButton.classList.remove('is-hidden');
    } else {
      newTaskButton.classList.add('is-hidden');
    }
  }

  // Sync FAB should only be visible on root route
  if (syncButton) {
    const isRootRoute = window.location.pathname === '/';
    if (isRootRoute && state.uiMode === 'list') {
      syncButton.classList.remove('is-hidden');
    } else {
      syncButton.classList.add('is-hidden');
    }
  }
}

function renderTaskList() {
  taskList.innerHTML = '';
  completedTaskList.innerHTML = '';

  const listData = getCurrentListData();
  const filteredTasks = getFilteredTasks(state.filters, listData.tasks);

  filteredTasks.forEach(task => {
    const taskItem = document.createElement('li');
    taskItem.className = `task-item ${task.done ? 'done' : ''}`;
    taskItem.dataset.id = task.id;
    taskItem.draggable = true;

    const dragHandle = document.createElement('span');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
    dragHandle.style.cursor = 'grab';
    dragHandle.style.color = '#dbdbdb';
    dragHandle.style.marginRight = '8px';
    dragHandle.style.fontSize = '14px';

    const checkbox = document.createElement('button');
    checkbox.className = 'checkbox';
    checkbox.setAttribute('role', 'checkbox');
    checkbox.setAttribute('aria-checked', task.done);
    checkbox.dataset.id = task.id;
    checkbox.addEventListener('click', () => toggleTaskDone(task.id));

    const taskName = document.createElement('button');
    taskName.className = 'task-name';
    taskName.textContent = task.name;
    taskName.dataset.id = task.id;
    taskName.addEventListener('click', () => {
      if (window.router) {
        window.router.navigate(`/edit/${task.id}`);
      } else {
        openEdit(task.id);
      }
    });

    taskItem.appendChild(dragHandle);
    taskItem.appendChild(checkbox);
    taskItem.appendChild(taskName);

    if (task.categoryId) {
      const category = listData.categories.find(c => c.id === task.categoryId);
      if (category) {
        const categoryPill = document.createElement('span');
        categoryPill.className = 'pill category is-small';
        categoryPill.textContent = category.name;
        categoryPill.style.marginRight = '4px';
        categoryPill.style.cursor = 'default';
        categoryPill.style.pointerEvents = 'none'; // Disable all mouse events
        taskItem.appendChild(categoryPill);
      }
    }

    // Ensure tagIds exists
    const tagIds = task.tagIds || [];

    tagIds.forEach(tagId => {
      const tag = listData.tags.find(t => t.id === tagId);
      if (tag) {
        const tagPill = document.createElement('span');
        tagPill.className = 'pill tag is-small';
        tagPill.textContent = tag.name;
        tagPill.style.marginRight = '4px';
        tagPill.style.cursor = 'default';
        tagPill.style.pointerEvents = 'none'; // Disable all mouse events
        taskItem.appendChild(tagPill);
      }
    });

    if (task.done) {
      completedTaskList.appendChild(taskItem);
    } else {
      taskList.appendChild(taskItem);
    }
  });
}

function renderFilters() {
  const listData = getCurrentListData();

  // Render Categories
  categoryFilters.innerHTML = '';

  // Add "Otros" button for tasks without category
  const othersButton = document.createElement('button');
  const isOthersSelected = state.filters.selectedCategoryId === 'others';
  othersButton.className = `button category-pill ${isOthersSelected ? 'is-selected' : ''}`;
  othersButton.textContent = 'Otros';
  othersButton.addEventListener('click', () => {
    if (isOthersSelected) {
      state.filters.selectedCategoryId = null;
    } else {
      state.filters.selectedCategoryId = 'others';
    }
    state.filters.selectedTagIds = [];
    render();
  });
  categoryFilters.appendChild(othersButton);

  listData.categories.forEach(category => {
    const button = document.createElement('button');
    const isSelected = state.filters.selectedCategoryId === category.id;
    button.className = `button category-pill ${isSelected ? 'is-selected' : ''}`;
    button.textContent = category.name;
    button.addEventListener('click', () => {
      if (isSelected) {
        state.filters.selectedCategoryId = null;
      } else {
        state.filters.selectedCategoryId = category.id;
      }
      state.filters.selectedTagIds = [];
      render();
    });
    categoryFilters.appendChild(button);
  });

  // Add Manage Categories button at the end
  const manageCategoriesButton = document.createElement('button');
  manageCategoriesButton.className = 'button category-manage';
  manageCategoriesButton.innerHTML = '<span class="icon"><i class="fas fa-edit"></i></span>';
  manageCategoriesButton.title = 'Manage Categories';
  manageCategoriesButton.addEventListener('click', () => {
    console.log('Manage Categories button clicked!');
    if (window.router) {
      window.router.navigate('/categories');
    } else {
      openCategoriesView();
    }
  });
  categoryFilters.appendChild(manageCategoriesButton);

  // Add Reset Filters button at the end only if there are active filters
  const hasActiveFilters = state.filters.selectedCategoryId || state.filters.selectedTagIds.length > 0;
  if (hasActiveFilters) {
    const resetFiltersButton = document.createElement('button');
    resetFiltersButton.className = 'button is-light';
    resetFiltersButton.textContent = 'Reset Filters';
    resetFiltersButton.addEventListener('click', resetFilters);
    categoryFilters.appendChild(resetFiltersButton);
  }

  // Render Tags
  tagFilters.innerHTML = '';
  const filteredTasks = getFilteredTasks(state.filters, listData.tasks);
  const visibleTags = computeVisibleTags(filteredTasks, listData.tags);
  visibleTags.forEach(tag => {
    const button = document.createElement('button');
    const isSelected = state.filters.selectedTagIds.includes(tag.id);
    button.className = `button tag-pill ${isSelected ? 'is-selected' : ''}`;
    button.textContent = tag.name;
    button.addEventListener('click', () => {
      if (isSelected) {
        state.filters.selectedTagIds = state.filters.selectedTagIds.filter(id => id !== tag.id);
      } else {
        state.filters.selectedTagIds.push(tag.id);
      }
      render();
    });
    tagFilters.appendChild(button);
  });
}

// -----------------------
// Data Manipulation
// -----------------------
async function createCategory(name, listType = 'main') {
  const newCategory = { id: generateId(), name };
  await saveCategory(newCategory, listType);
  return newCategory;
}

async function createTag(name, listType = 'main') {
  const newTag = { id: generateId(), name };
  await saveTag(newTag, listType);
  return newTag;
}
async function createTask({ name, description, categoryId, tagIds, subtasks }, listType = 'main') {
  const newTask = {
    id: generateId(),
    name,
    description,
    categoryId,
    tagIds,
    subtasks,
    order: Date.now(), // Use timestamp as initial order
    done: false,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  await saveTask(newTask, listType);
  return newTask;
}

async function updateTask(id, patch, listType = 'main') {
  const listData = listType === 'main' ? { tasks: state.tasks } : getCurrentListData();
  const task = listData.tasks.find(t => t.id === id);
  if (!task) {
    throw new Error('Task not found');
  }
  Object.assign(task, patch, { updatedAt: Date.now() });
  await saveTask(task, listType);
}
async function toggleTaskDone(id) {
  const listData = getCurrentListData();
  const task = listData.tasks.find(t => t.id === id);
  if (task) {
    task.done = !task.done;
    task.updated_at = Date.now();
    await saveTask(task, state.currentList);
    render();
  }
}
function toggleSubtaskDone(taskId, subtaskId) { }
function getFilteredTasks({ selectedCategoryId, selectedTagIds = [] }, tasks = null) {
  const tasksToFilter = tasks || state.tasks;
  return tasksToFilter.filter(task => {
    let categoryMatch = true;

    if (selectedCategoryId === 'others') {
      // Special case: tasks without category
      categoryMatch = !task.categoryId;
    } else if (selectedCategoryId) {
      categoryMatch = task.categoryId === selectedCategoryId;
    }

    const tagMatch = selectedTagIds.every(tagId => {
      const taskTagIds = task.tagIds || [];
      return taskTagIds.includes(tagId);
    });
    return categoryMatch && tagMatch;
  }).sort((a, b) => (a.order || 0) - (b.order || 0));
}

function computeVisibleTags(filteredTasks, tags = null) {
  const tagsToSearch = tags || state.tags;
  const visibleTagIds = new Set();
  filteredTasks.forEach(task => {
    const tagIds = task.tagIds || [];
    tagIds.forEach(tagId => visibleTagIds.add(tagId));
  });
  return tagsToSearch.filter(tag => visibleTagIds.has(tag.id));
}

let newSubtasks = [];
let newCategoryId = null;
let newTagIds = [];

const newTaskCategoryPills = document.getElementById('new-task-category-pills');
const newTaskTagPills = document.getElementById('new-task-tag-pills');

function renderCategoryPillsForEdit(selectedCategoryId) {
  newTaskCategoryPills.innerHTML = '';
  state.categories.forEach(category => {
    const button = document.createElement('button');
    const isSelected = selectedCategoryId === category.id;
    button.className = `button category-pill ${isSelected ? 'is-selected' : ''}`;
    button.textContent = category.name;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      if (state.uiMode === 'edit') {
        const task = state.tasks.find(t => t.id === state.editingTaskId);
        if (task) {
          if (task.categoryId === category.id) {
            task.categoryId = null;
          } else {
            task.categoryId = category.id;
          }
          renderCategoryPillsForEdit(task.categoryId);
        }
      } else { // new mode
        if (newCategoryId === category.id) {
          newCategoryId = null;
        } else {
          newCategoryId = category.id;
        }
        renderCategoryPillsForEdit(newCategoryId);
      }
    });
    newTaskCategoryPills.appendChild(button);
  });
}

function renderTagPillsForEdit(selectedTagIds) {
  newTaskTagPills.innerHTML = '';
  state.tags.forEach(tag => {
    const button = document.createElement('button');
    const isSelected = selectedTagIds.includes(tag.id);
    button.className = `button tag-pill ${isSelected ? 'is-selected' : ''}`;
    button.textContent = tag.name;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      if (state.uiMode === 'edit') {
        const task = state.tasks.find(t => t.id === state.editingTaskId);
        if (task) {
          if (task.tagIds.includes(tag.id)) {
            task.tagIds = task.tagIds.filter(id => id !== tag.id);
          } else {
            task.tagIds.push(tag.id);
          }
          renderTagPillsForEdit(task.tagIds);
        }
      } else { // new mode
        if (newTagIds.includes(tag.id)) {
          newTagIds = newTagIds.filter(id => id !== tag.id);
        } else {
          newTagIds.push(tag.id);
        }
        renderTagPillsForEdit(newTagIds);
      }
    });
    newTaskTagPills.appendChild(button);
  });
}

function openEdit(taskId) {
  console.log('openEdit called with ID:', taskId);
  console.log('Available tasks:', state.tasks.map(t => ({ id: t.id, name: t.name })));

  const task = state.tasks.find(t => t.id === taskId);
  console.log('Found task:', task);
  if (!task) {
    console.error('Task not found, returning');
    return;
  }

  console.log('Setting uiMode to edit');
  state.uiMode = 'edit';
  state.editingTaskId = taskId;

  // Don't update URL here - router already handled it
  console.log('Router already handled URL, not updating again');

  console.log('Populating form');
  // Populate form
  newTaskNameInput.value = task.name;
  newTaskDescriptionInput.value = task.description;
  newCategoryId = task.categoryId;
  newTagIds = task.tagIds || [];

  // Render form elements
  renderCategoryPillsForEdit(task.categoryId);
  renderTagPillsForEdit(task.tagIds);

  console.log('Showing edit view');
  // Show edit view
  console.log('listView element:', listView);
  console.log('newTaskView element:', newTaskView);

  listView.classList.add('is-hidden');
  newTaskView.classList.remove('is-hidden');
  deleteTaskButton.classList.remove('is-hidden');

  console.log('Views updated - list hidden:', listView.classList.contains('is-hidden'));
  console.log('Views updated - edit visible:', !newTaskView.classList.contains('is-hidden'));

  // Subtasks
  renderSubtasksForEdit(task.subtasks);

  deleteTaskButton.classList.remove('is-hidden');
  render();

  console.log('openEdit completed');
}
function openNew() {
  console.log('openNew called');
  state.uiMode = 'new';
  state.editingTaskId = null;
  if (deleteTaskButton) {
    deleteTaskButton.classList.add('is-hidden');
  }

  // Clear form
  newTaskNameInput.value = '';
  newTaskDescriptionInput.value = '';

  // Preserve selected filters
  newCategoryId = state.filters.selectedCategoryId;
  newTagIds = [...state.filters.selectedTagIds];

  // Render form elements with preserved selections
  renderCategoryPillsForEdit(newCategoryId);
  renderTagPillsForEdit(newTagIds);

  render();

  // Focus on task name input
  newTaskNameInput.focus();
}

// -----------------------
// Categories Management
// -----------------------

function openCategoriesView() {
  console.log('openCategoriesView called');
  state.uiMode = 'categories';

  // Hide list view and show categories view
  listView.classList.add('is-hidden');
  categoriesView.classList.remove('is-hidden');

  // Render categories list
  renderCategoriesList();

  // Add event listener to back button (ensure it's registered when button is visible)
  const backBtn = document.getElementById('back-to-list-from-categories');
  console.log('Back button found:', backBtn);

  if (backBtn) {
    // Clone the button to remove any existing event listeners
    const newBackBtn = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(newBackBtn, backBtn);

    console.log('New back button created:', newBackBtn);
    newBackBtn.addEventListener('click', (e) => {
      console.log('Back to Tasks button clicked!', e);
      e.preventDefault();
      e.stopPropagation();
      closeCategoriesView();
    });

    console.log('Event listener added to back button');
  } else {
    console.error('Back button not found!');
  }

  // Add event listener to new category input (ensure it's registered when input is visible)
  const categoryInput = document.getElementById('new-category-input');
  console.log('Category input found:', categoryInput);

  if (categoryInput) {
    // Remove any existing event listeners by cloning
    const newInput = categoryInput.cloneNode(true);
    categoryInput.parentNode.replaceChild(newInput, categoryInput);

    console.log('New category input created:', newInput);
    newInput.addEventListener('keydown', (e) => {
      console.log('Key pressed on new category input:', e.key);
      if (e.key === 'Enter') {
        console.log('Enter key detected, calling addCategory');
        e.preventDefault();
        addCategory();
      }
    });

    console.log('Event listener added to category input');
  } else {
    console.error('Category input not found!');
  }

  // Add event listener to add category button (ensure it's registered when button is visible)
  const addBtn = document.getElementById('add-category-button');
  console.log('Add category button found:', addBtn);

  if (addBtn) {
    // Remove any existing event listeners by cloning
    const newAddBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newAddBtn, addBtn);

    console.log('New add category button created:', newAddBtn);
    newAddBtn.addEventListener('click', (e) => {
      console.log('Add category button clicked!', e);
      e.preventDefault();
      addCategory();
    });

    console.log('Event listener added to add category button');
  } else {
    console.error('Add category button not found!');
  }
}

function closeCategoriesView() {
  console.log('closeCategoriesView called');
  if (window.router) {
    window.router.navigate('/');
  } else {
    window.history.pushState({}, '', '/');
    state.uiMode = 'list';
    state.editingTaskId = null;
    render();
  }
}

function renderCategoriesList() {
  categoriesList.innerHTML = '';

  if (state.categories.length === 0) {
    categoriesList.innerHTML = '<p class="has-text-grey">No categories yet. Create your first one above!</p>';
    return;
  }

  state.categories.forEach(category => {
    const categoryItem = document.createElement('div');
    categoryItem.className = 'category-item';
    categoryItem.dataset.categoryId = category.id;

    // Create name span
    const nameSpan = document.createElement('span');
    nameSpan.className = 'category-name';
    nameSpan.textContent = category.name;

    // Create actions div
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'category-actions';

    // Create edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'button is-small is-info edit-category-btn';
    editBtn.textContent = 'Edit';

    // Create delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'button is-small is-danger delete-category-btn';
    deleteBtn.textContent = 'Delete';

    // Assemble the item
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    categoryItem.appendChild(nameSpan);
    categoryItem.appendChild(actionsDiv);

    // Add event listeners
    editBtn.addEventListener('click', () => startEditCategory(category.id));
    deleteBtn.addEventListener('click', () => deleteCategory(category.id));

    categoriesList.appendChild(categoryItem);
  });
}

async function addCategory() {
  console.log('addCategory function called');
  console.log('syncManager available:', !!syncManager);

  // Get the current input element (in case it was cloned)
  const currentInput = document.getElementById('new-category-input');
  console.log('Current input element:', currentInput);

  // Add a small delay to ensure input value is updated
  await new Promise(resolve => setTimeout(resolve, 10));

  const name = currentInput.value.trim();
  console.log('Category name from current input:', name);
  console.log('Current input element value:', currentInput.value);

  if (!name) {
    console.log('Empty category name, returning');
    return;
  }

  try {
    console.log('Creating new category object...');
    const newCategory = {
      id: generateId(),
      name: name,
      color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0') // Random color with proper format
    };
    console.log('New category object:', newCategory);

    console.log('Calling syncManager.createCategory...');
    await syncManager.createCategory(newCategory);
    console.log('Category created successfully');

    // Force sync to ensure changes are saved
    await syncManager.forceSync();
    console.log('Force sync completed');

    // Reload state from IndexedDB to get updated data
    await loadState();
    console.log('State reloaded after creating category');

    // Clear input using the current input element
    currentInput.value = '';
    console.log('Input cleared');

    // Re-render categories list
    renderCategoriesList();
    console.log('Categories list re-rendered');

  } catch (error) {
    console.error('Failed to add category:', error);
    alert('Failed to add category: ' + error.message);
  }
}

function startEditCategory(categoryId) {
  const category = state.categories.find(c => c.id === categoryId);
  if (!category) return;

  const categoryItem = document.querySelector(`[data-category-id="${categoryId}"]`);
  const nameSpan = categoryItem.querySelector('.category-name');
  const actionsDiv = categoryItem.querySelector('.category-actions');

  // Create edit input with proper styling
  const editInput = document.createElement('input');
  editInput.type = 'text';
  editInput.className = 'category-edit-input';
  editInput.value = category.name;
  editInput.style.cssText = `
    padding: 0.25rem 0.5rem;
    border: 1px solid #dbdbdb;
    border-radius: 4px;
    font-size: 0.875rem;
    min-width: 150px;
    max-width: 200px;
    display: inline-block;
    margin-right: 0.5rem;
  `;

  // Create save/cancel buttons
  const saveBtn = document.createElement('button');
  saveBtn.className = 'button is-small is-success';
  saveBtn.textContent = 'Save';
  saveBtn.style.marginRight = '0.25rem';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'button is-small is-light';
  cancelBtn.textContent = 'Cancel';

  // Replace content - clear everything and rebuild
  categoryItem.innerHTML = '';

  // Add input first
  categoryItem.appendChild(editInput);

  // Then add actions div with buttons
  const newActionsDiv = document.createElement('div');
  newActionsDiv.className = 'category-actions';
  newActionsDiv.style.cssText = `
    display: inline-flex;
    gap: 0.25rem;
    align-items: center;
  `;
  newActionsDiv.appendChild(saveBtn);
  newActionsDiv.appendChild(cancelBtn);

  categoryItem.appendChild(newActionsDiv);

  // Focus input and select text
  editInput.focus();
  editInput.select();

  // Add event listeners
  const saveEdit = async () => {
    const newName = editInput.value.trim();
    if (newName && newName !== category.name) {
      try {
        // Check if syncManager is available
        if (!syncManager) {
          console.error('SyncManager not available');
          alert('Sync is not available. Please refresh the page and try again.');
          return;
        }

        // Update category
        const categoryToUpdate = { ...category, name: newName };
        await syncManager.updateCategory(categoryToUpdate);

        // Update all tasks that have this category
        const tasksToUpdate = state.tasks.filter(task => task.categoryId === categoryId);

        for (const task of tasksToUpdate) {
          const updatedTask = { ...task, categoryId: categoryId, updatedAt: Date.now() };
          await syncManager.updateTask(updatedTask);
        }

        // Force sync to ensure changes are saved
        await syncManager.forceSync();

        // Wait a bit for sync to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Reload state from IndexedDB to get updated data
        await loadState();

        // Re-render UI
        renderCategoriesList();
        if (state.uiMode === 'list') {
          render();
        }

      } catch (error) {
        console.error('Failed to update category:', error);
        alert('Failed to update category: ' + error.message);
      }
    } else {
      cancelEdit();
    }
  };

  const cancelEdit = () => {
    // Restore original view
    renderCategoriesList();
  };

  saveBtn.addEventListener('click', saveEdit);
  cancelBtn.addEventListener('click', cancelEdit);

  editInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
  });
}

async function deleteCategory(categoryId) {
  console.log('deleteCategory called with ID:', categoryId);

  if (!confirm('Are you sure you want to delete this category? Tasks in this category will become uncategorized.')) {
    console.log('User cancelled category deletion');
    return;
  }

  try {
    console.log('Finding tasks with category:', categoryId);
    // Find all tasks that have this category
    const tasksToUpdate = state.tasks.filter(task => task.categoryId === categoryId);
    console.log('Tasks to update:', tasksToUpdate.length);

    // Update all tasks to remove the category
    for (const task of tasksToUpdate) {
      const updatedTask = { ...task, categoryId: null, updatedAt: Date.now() };
      console.log('Updating task to remove category:', task.id);
      await syncManager.updateTask(updatedTask);
    }
    console.log('All tasks updated');

    // Delete the category
    console.log('Deleting category:', categoryId);
    await syncManager.deleteCategory(categoryId);
    console.log('Category deleted successfully');

    // Force sync to ensure changes are saved
    await syncManager.forceSync();
    console.log('Force sync completed');

    // Wait a bit for sync to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Reload state from IndexedDB to get updated data
    await loadState();
    console.log('State reloaded after deleting category');

    // Debug: Check if category was actually removed
    const deletedCategory = state.categories.find(c => c.id === categoryId);
    console.log('Deleted category still in state:', deletedCategory);
    console.log('All categories after deletion:', state.categories.map(c => ({ id: c.id, name: c.name })));

    // Re-render categories list
    renderCategoriesList();
    console.log('Categories list re-rendered');

    // If we're in the list view, re-render to show updated tasks
    if (state.uiMode === 'list') {
      render();
      console.log('Task list re-rendered');
    }

  } catch (error) {
    console.error('Failed to delete category:', error);
    alert('Failed to delete category: ' + error.message);
  }
}

function closeEdit() {
  state.uiMode = 'list';
  state.editingTaskId = null;
  render();

  if (window.router) {
    window.router.navigate('/');
  } else {
    window.history.pushState({}, '', '/');
  }
}

function showValidationError(msg) {
  newTaskError.textContent = msg;
  newTaskError.classList.remove('is-hidden');
}
function resetFilters() {
  state.filters.selectedCategoryId = null;
  state.filters.selectedTagIds = [];
  render();
}

function renderSubtasksForEdit(subtasks) {
  newTaskSubtasksContainer.innerHTML = '';
  const activeSubtasks = subtasks.filter(s => !s.done);
  const completedSubtasks = subtasks.filter(s => s.done);

  activeSubtasks.forEach(subtask => {
    newTaskSubtasksContainer.appendChild(createSubtaskElement(subtask));
  });

  if (completedSubtasks.length > 0) {
    const divider = document.createElement('h4');
    divider.className = 'title is-6 mt-4';
    divider.textContent = 'Completed Subtasks';
    newTaskSubtasksContainer.appendChild(divider);
    completedSubtasks.forEach(subtask => {
      newTaskSubtasksContainer.appendChild(createSubtaskElement(subtask));
    });
  }
}

function createSubtaskElement(subtask) {
  const subtaskEl = document.createElement('div');
  subtaskEl.className = 'subtask-row';
  subtaskEl.dataset.subtaskId = subtask.id;

  const checkbox = document.createElement('button');
  checkbox.className = 'checkbox subtask-checkbox';
  checkbox.setAttribute('role', 'checkbox');
  checkbox.setAttribute('aria-checked', subtask.done);
  checkbox.addEventListener('click', () => {
    if (state.uiMode === 'edit') {
      const task = state.tasks.find(t => t.id === state.editingTaskId);
      if (task) {
        const st = task.subtasks.find(s => s.id === subtask.id);
        if (st) {
          st.done = !st.done;
          renderSubtasksForEdit(task.subtasks);
        }
      }
    } else {
      const st = newSubtasks.find(s => s.id === subtask.id);
      if (st) {
        st.done = !st.done;
        renderSubtasksForEdit(newSubtasks);
      }
    }
  });

  const input = document.createElement('input');
  input.className = 'input subtask-input';
  input.type = 'text';
  input.value = subtask.name;
  if (subtask.done) {
    input.style.textDecoration = 'line-through';
  }
  input.addEventListener('change', (e) => {
    if (state.uiMode === 'edit') {
      const task = state.tasks.find(t => t.id === state.editingTaskId);
      if (task) {
        const st = task.subtasks.find(s => s.id === subtask.id);
        if (st) {
          st.name = e.target.value;
        }
      }
    } else {
      const st = newSubtasks.find(s => s.id === subtask.id);
      if (st) {
        st.name = e.target.value;
      }
    }
  });

  const deleteButton = document.createElement('button');
  deleteButton.className = 'button is-danger is-light subtask-remove';
  deleteButton.textContent = 'Remove';
  deleteButton.addEventListener('click', () => {
    if (state.uiMode === 'edit') {
      const task = state.tasks.find(t => t.id === state.editingTaskId);
      if (task) {
        task.subtasks = task.subtasks.filter(s => s.id !== subtask.id);
        renderSubtasksForEdit(task.subtasks);
      }
    } else {
      newSubtasks = newSubtasks.filter(s => s.id !== subtask.id);
      renderSubtasksForEdit(newSubtasks);
    }
  });

  subtaskEl.appendChild(checkbox);
  subtaskEl.appendChild(input);
  subtaskEl.appendChild(deleteButton);

  return subtaskEl;
}

// -----------------------
// Event Listeners
// -----------------------

document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM Content Loaded - Initializing app');

  // Initialize sync manager first
  try {
    console.log('Initializing sync manager...');
    const { initSync } = await import('./api.js');
    syncManager = await initSync();
    console.log('Sync manager initialized:', !!syncManager);
  } catch (error) {
    console.error('Failed to initialize sync manager:', error);
  }

  // Load initial data
  await loadState();
  console.log('Initial state loaded. Tasks:', state.tasks.length, 'Categories:', state.categories.length);

  // Render initial view
  render();

  // Router handles browser navigation (popstate) in router.js
  if (window.router) {
    window.router.handleRoute();
  }

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration);

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'SYNC_TRIGGERED') {
            console.log('Received sync trigger from service worker');
            if (syncManager) {
              syncManager.sync();
            }
          }
        });
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  }

  newTaskButton.addEventListener('click', () => {
    if (window.router) window.router.navigate('/new');
  });
  cancelButton.addEventListener('click', () => {
    if (window.router) window.router.navigate('/');
  });

  // Categories management (button is created dynamically in renderFilters)
  console.log('addCategoryButton element:', addCategoryButton);
  if (addCategoryButton) {
    console.log('addCategoryButton found but event listener will be added in openCategoriesView');
  } else {
    console.log('addCategoryButton not found (will be registered in openCategoriesView)');
  }

  // Sync button
  syncButton.addEventListener('click', async () => {
    if (syncManager) {
      try {
        await syncManager.forceSync();
      } catch (error) {
        console.error('Manual sync failed:', error);
      }
    }
  });
  saveTaskButton.addEventListener('click', async () => {
    const name = newTaskNameInput.value.trim();
    if (!name) {
      showValidationError('Task name is required.');
      return;
    }
    newTaskError.classList.add('is-hidden');

    const description = newTaskDescriptionInput.value.trim();

    let categoryId, selectedTagIds;

    if (state.uiMode === 'edit') {
      const listData = getCurrentListData();
      const task = listData.tasks.find(t => t.id === state.editingTaskId);
      categoryId = task.categoryId;
      selectedTagIds = task.tagIds;
    } else { // new mode
      categoryId = newCategoryId;
      selectedTagIds = newTagIds;
    }

    let subtasks = [];
    if (state.uiMode === 'edit') {
      const listData = getCurrentListData();
      const task = listData.tasks.find(t => t.id === state.editingTaskId);
      if (task) {
        subtasks = task.subtasks;
      }
    } else {
      subtasks = newSubtasks;
    }

    try {
      if (state.uiMode === 'new') {
        await createTask({ name, description, categoryId, tagIds: selectedTagIds, subtasks }, state.currentList);
      } else if (state.uiMode === 'edit') {
        await updateTask(state.editingTaskId, { name, description, categoryId, tagIds: selectedTagIds, subtasks }, state.currentList);
      }

      state.uiMode = 'list';
      state.editingTaskId = null;
      render();

      if (window.router) {
        window.router.navigate('/');
      } else {
        window.history.pushState({}, '', '/');
      }
    } catch (error) {
      console.error('Failed to save task:', error);
    }
  });

  deleteTaskButton.addEventListener('click', async () => {
    if (state.editingTaskId) {
      await deleteTask(state.editingTaskId);
      closeEdit();
    }
  });

  if (addCategoryManageButton) {
    addCategoryManageButton.addEventListener('click', () => {
      const categoryName = newCategoryInput.value.trim();
      if (categoryName) {
        createCategory(categoryName);
        newCategoryInput.value = '';
        renderCategoriesList();
        renderFilters();
      }
    });
  }

  addSubtaskButton.addEventListener('click', () => {
    const subtaskName = newSubtaskInput.value.trim();
    if (subtaskName) {
      const newSubtask = { id: generateId(), name: subtaskName, done: false };
      if (state.uiMode === 'edit') {
        const task = state.tasks.find(t => t.id === state.editingTaskId);
        if (task) {
          task.subtasks.push(newSubtask);
          renderSubtasksForEdit(task.subtasks);
        }
      } else {
        newSubtasks.push(newSubtask);
        renderSubtasksForEdit(newSubtasks);
      }
      newSubtaskInput.value = '';
    }
  });

  addCategoryButton.addEventListener('click', async () => {
    const categoryName = newTaskNewCategoryInput.value.trim();
    if (categoryName) {
      const newCategory = await createCategory(categoryName, state.currentList);
      if (state.uiMode === 'edit') {
        const listData = getCurrentListData();
        const task = listData.tasks.find(t => t.id === state.editingTaskId);
        if (task) {
          task.categoryId = newCategory.id;
          renderCategoryPillsForEdit(task.categoryId);
        }
      } else {
        newCategoryId = newCategory.id;
        renderCategoryPillsForEdit(newCategoryId);
      }
      newTaskNewCategoryInput.value = '';
    }
  });

  addTagButton.addEventListener('click', async () => {
    const tagName = newTaskNewTagInput.value.trim();
    if (tagName) {
      const newTag = await createTag(tagName, state.currentList);
      if (state.uiMode === 'edit') {
        const listData = getCurrentListData();
        const task = listData.tasks.find(t => t.id === state.editingTaskId);
        if (task) {
          if (!task.tagIds.includes(newTag.id)) {
            task.tagIds.push(newTag.id);
          }
          renderTagPillsForEdit(task.tagIds);
        }
      } else {
        if (!newTagIds.includes(newTag.id)) {
          newTagIds.push(newTag.id);
        }
        renderTagPillsForEdit(newTagIds);
      }
      newTaskNewTagInput.value = '';
    }
  });

  // Drag and drop handlers
  let draggedTask = null;
  let draggedTaskId = null;

  function handleDragStart(e) {
    const taskItem = e.target.closest('.task-item');
    if (!taskItem) return;

    draggedTaskId = taskItem.dataset.id;
    draggedTask = state.tasks.find(t => t.id === draggedTaskId);

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', taskItem.innerHTML);
    taskItem.style.opacity = '0.5';
  }

  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';

    // Clear previous visual indicators so only one insertion line is visible
    const taskItems = document.querySelectorAll('.task-item');
    taskItems.forEach(item => {
      item.style.borderTop = '';
    });

    const taskItem = e.target.closest('.task-item');
    if (taskItem && taskItem.dataset.id !== draggedTaskId) {
      taskItem.style.borderTop = '2px solid #485fc7';
    }

    return false;
  }

  async function handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    e.preventDefault();

    // Clear insertion line indicator
    const taskItems = document.querySelectorAll('.task-item');
    taskItems.forEach(item => {
      item.style.borderTop = '';
    });

    const targetTaskItem = e.target.closest('.task-item');
    if (!targetTaskItem || !draggedTask) return;

    const targetTaskId = targetTaskItem.dataset.id;
    const targetTask = state.tasks.find(t => t.id === targetTaskId);

    if (!targetTask || targetTaskId === draggedTaskId) return;

    // Get current filtered tasks to determine position
    const filteredTasks = getFilteredTasks(state.filters);
    const draggedIndex = filteredTasks.findIndex(t => t.id === draggedTaskId);
    const targetIndex = filteredTasks.findIndex(t => t.id === targetTaskId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Calculate new order based on relative position
    let newOrder;
    const isLastInFiltered = targetIndex === filteredTasks.length - 1;

    if (isLastInFiltered) {
      // If dropping on last item, use order of the task above
      const taskAbove = filteredTasks[targetIndex - 1];
      if (taskAbove) {
        newOrder = taskAbove.order + 1;
      } else {
        newOrder = 0;
      }
    } else {
      // Use order of the task we're dropping on
      newOrder = targetTask.order;
    }

    // Update the dragged task's order
    draggedTask.order = newOrder;
    draggedTask.updated_at = Date.now();

    // Reorder other tasks if needed
    const tasksToUpdate = [];
    filteredTasks.forEach((task, index) => {
      if (task.id !== draggedTaskId && task.order >= newOrder) {
        task.order += 1;
        task.updated_at = Date.now();
        tasksToUpdate.push(task);
      }
    });

    // Save changes locally
    if (syncManager) {
      try {
        await syncManager.updateTask(draggedTask);
        for (const task of tasksToUpdate) {
          await syncManager.updateTask(task);
        }
        await syncManager.forceSync();
        await loadState();
      } catch (error) {
        console.error('Failed to persist reordered tasks:', error);
      }
    }

    // Re-render to show new order
    render();

    return false;
  }

  function handleDragEnd(e) {
    const taskItems = document.querySelectorAll('.task-item');
    taskItems.forEach(item => {
      item.style.opacity = '';
      item.style.borderTop = '';
    });

    draggedTask = null;
    draggedTaskId = null;
  }

  [taskList, completedTaskList].forEach(list => {
    list.addEventListener('dragstart', handleDragStart);
    list.addEventListener('dragover', handleDragOver);
    list.addEventListener('drop', handleDrop);
    list.addEventListener('dragend', handleDragEnd);
  });

  // Initialize navigation UI
  updateNavigationUI();

  // Setup navigation event listeners
  setupNavigationListeners();
});

// Setup navigation event listeners
function setupNavigationListeners() {
  if (setupNavigationListeners._initialized) {
    return;
  }
  setupNavigationListeners._initialized = true;

  const desktopContainer = document.querySelector('.desktop-nav-tabs');
  if (desktopContainer) {
    desktopContainer.addEventListener('click', async (e) => {
      const button = e.target.closest('.tab-button');
      if (!button || !desktopContainer.contains(button)) {
        return;
      }

      const listType = button.dataset.list;
      if (!listType) {
        return;
      }

      try {
        await switchToList(listType);
      } catch (error) {
        console.error('❌ Error in switchToList:', error);
      }
    });
  }

  const mobileContainer = document.querySelector('.mobile-nav');
  if (mobileContainer) {
    mobileContainer.addEventListener('click', async (e) => {
      const item = e.target.closest('.nav-item');
      if (!item || !mobileContainer.contains(item)) {
        return;
      }

      const listType = item.dataset.list;
      if (!listType) {
        return;
      }

      try {
        await switchToList(listType);
      } catch (error) {
        console.error('❌ Error in switchToList:', error);
      }
    });
  }
}
