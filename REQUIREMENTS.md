# Project Requirements: Task App PWA with Python Backend

## Overview
Create a task management application (Task App) that works as a Progressive Web App (PWA) with a simple Python backend, no database, using file system for multi-device synchronization.

## General Architecture

### Frontend (PWA)
- **Technology**: HTML5, CSS3, vanilla JavaScript
- **Storage**: IndexedDB for local data and sync queue
- **Offline-first**: Works completely without connection
- **PWA Features**: Service Worker, Manifest, Installable
- **CSS Framework**: Bulma CSS (already existing)

### Backend (Python)
- **Framework**: Flask (lightweight, simple)
- **Storage**: JSON file system
- **API**: REST endpoints for CRUD operations
- **No database**: JSON files only
- **Authentication**: Option 1 - No users (default user)

## Functional Requirements

### Task Management
- [x] Create tasks with name, description
- [x] Assign categories to tasks
- [x] Assign multiple tags to tasks
- [x] Create subtasks within tasks
- [x] Mark tasks as completed
- [x] Edit existing tasks
- [x] Delete tasks
- [x] Filter tasks by category and tags
- [x] Separate view for completed tasks
- [x] Filter uncategorized tasks (button "Otros")
- [ ] Drag and drop task reordering with visual drag handle
  - [ ] Drag handle icon to the left of task checkbox
  - [ ] Make tasks draggable
  - [ ] Save order locally (IndexedDB) and sync to backend
  - [ ] Smart relative order sync:
    - Use dropped-on task's order unless it's last in filtered list
    - If last in filtered list, use order of task above
  - [ ] Reordering works correctly even when list is filtered

### Mobile Icon Navigation
- [ ] Mobile-style icon navigation with 4 main sections
- [ ] Icon 1: Lista Principal (main task list)
- [ ] Icon 2: Acciones Diarias (daily recurring tasks)
- [ ] Icon 3: Acciones Semanales (weekly recurring tasks)  
- [ ] Icon 4: Acciones Mensuales (monthly recurring tasks)
- [ ] Visual icon-based navigation suitable for mobile devices
- [ ] Each section maintains its own separate task list

### Periodic Task Lists
- [ ] Daily tasks list that resets automatically each day at 00:00
- [ ] Weekly tasks list that resets automatically every Monday at 00:00
- [ ] Monthly tasks list that resets automatically on the 1st of each month at 00:00
- [ ] Tasks in periodic lists are separate from main list
- [ ] Each periodic list has its own categories, tags, and subtasks
- [ ] Completed periodic tasks remain completed until reset
- [ ] Reset functionality clears completion status but keeps tasks

### Categories and Tags
- [x] Create categories dynamically
- [x] Create tags dynamically
- [x] Assign multiple tags per task
- [x] Combined filters (category + tags)

### Filters
- [x] Category filters (clickable buttons)
- [x] Tag filters (multiple tags)
- [x] Reset filters (clear all filters)
- [x] "Otros" button for uncategorized tasks
- [x] Visual integration with existing category buttons

### Multi-device Synchronization
- [ ] Automatic sync when connection available
- [ ] Offline-first with pending operations queue
- [ ] Background Sync with Service Worker
- [ ] Conflict resolution (last-write-wins)
- [ ] Access from mobile and Mac with same data

## Technical Requirements

### Python Backend
```
backend/
├── app.py              # Flask server
├── requirements.txt   # Flask + Flask-CORS
└── data/
    ├── users/default/  # Default user
    │   ├── tasks.json
    │   ├── daily_tasks.json
    │   ├── weekly_tasks.json
    │   ├── monthly_tasks.json
    │   ├── categories.json
    │   ├── daily_categories.json
    │   ├── weekly_categories.json
    │   ├── monthly_categories.json
    │   ├── tags.json
    │   ├── daily_tags.json
    │   ├── weekly_tags.json
    │   ├── monthly_tags.json
    │   └── last_reset.json
    └── backups/        # Automatic backups
```

#### API Endpoints
- `GET/POST /api/tasks` - List/create tasks
- `PUT/DELETE /api/tasks/{id}` - Update/delete task
- `GET/POST /api/categories` - Category management
- `GET/POST /api/tags` - Tag management
- `GET /api/sync?since=timestamp` - Pull changes
- `POST /api/sync` - Batch sync operations
- `GET /api/health` - Health check
- `GET/POST /api/periodic-tasks/{type}` - Periodic tasks (daily/weekly/monthly)
- `POST /api/periodic-tasks/{type}/reset` - Reset periodic tasks

#### JSON Data Structure
```json
{
  "version": "1.0",
  "last_modified": 1640995200000,
  "data": [
    {
      "id": "task1",
      "name": "Buy groceries",
      "description": "Milk, Bread, Cheese",
      "categoryId": "cat1",
      "tagIds": ["tag4"],
      "subtasks": [{"id": "sub1", "name": "Buy milk", "done": false}],
      "done": false,
      "created_at": 1640995200000,
      "updated_at": 1640995200000
    }
  ]
}
```

### PWA Frontend
```
frontend/
├── index.html         # Main app
├── app.js            # Updated UI logic
├── db.js             # IndexedDB wrapper
├── api.js            # API client + sync manager
├── sw.js             # Service Worker
├── manifest.json     # PWA manifest
└── styles.css        # Styles + sync indicators
```

#### IndexedDB Schema
- **tasks**: Local task storage
- **dailyTasks**: Daily recurring tasks
- **weeklyTasks**: Weekly recurring tasks  
- **monthlyTasks**: Monthly recurring tasks
- **categories**: Local categories
- **dailyCategories**: Daily task categories
- **weeklyCategories**: Weekly task categories
- **monthlyCategories**: Monthly task categories
- **tags**: Local tags
- **dailyTags**: Daily task tags
- **weeklyTags**: Weekly task tags
- **monthlyTags**: Monthly task tags
- **syncQueue**: Pending operations queue
- **metadata**: Last sync timestamps and last reset times

#### Service Worker Features
- Cache static files (app shell)
- Network-first for API requests
- Background sync registration
- Offline fallbacks

## Synchronization Flow

### 1. Local Operation (Offline)
1. User creates/edits/deletes task
2. Saves to IndexedDB immediately
3. Adds operation to syncQueue
4. UI updates instantly

### 2. Automatic Synchronization
1. Service Worker detects online connection
2. Processes pending syncQueue
3. Batch operations to backend API
4. Backend resolves conflicts
5. Client updates local state

### 3. Conflict Resolution
- **Strategy**: Last-write-wins by timestamp
- **Server version** > Client version = conflict
- **Client version** > Server version = accept change
- **Merge**: Specific fields if needed

## UX/UI Requirements

### Sync Indicators
- [ ] Visual sync status indicator (Offline/Syncing/Synced/Error)
- [ ] Loading states during operations
- [ ] Conflict notifications if they occur

### PWA Features
- [ ] Installable as native app
- [ ] Icon and splash screen
- [ ] Fullscreen mode
- [ ] Responsive mobile/tablet/desktop design

## Multi-device Use Cases

### Scenario 1: Create on mobile, view on Mac
1. User creates task on mobile (offline)
2. Task saves locally and queues for sync
3. When connected, syncs with backend
4. User opens app on Mac, changes sync

### Scenario 2: Simultaneous editing
1. User edits same task on two devices
2. Last modification by timestamp wins
3. Both devices reflect final state

## Deployment Requirements

### Backend
- **Python 3.8+**
- **Flask + Flask-CORS**
- **Development server**: `python app.py`
- **Production**: gunicorn/nginx (optional)

### Frontend
- **Static server**: Any web server
- **HTTPS required** for Service Workers
- **Configurable domain** for API

## Technical Considerations

### Performance
- **IndexedDB**: Efficient offline storage
- **Batch operations**: Reduce API calls
- **Lazy loading**: For large data volumes

### Security
- **CORS**: Configured for frontend domain
- **Input validation**: In backend endpoints
- **File permissions**: Backend write-only

### Scalability
- **File-based**: Easy backup and migration
- **Upgrade path**: To real database if grows
- **Multi-user**: Easy to add auth later

## Testing Strategy

### Backend Tests
- [ ] Unit tests for API endpoints
- [ ] Synchronization tests
- [ ] Error handling tests

### Frontend Tests
- [ ] IndexedDB operations
- [ ] Service Worker registration
- [ ] Sync queue management

### Integration Tests
- [ ] Complete offline->online flow
- [ ] Multi-device simulation
- [ ] Conflict resolution

## Deliverables

### Minimum Viable Product (MVP)
1. Flask backend with CRUD endpoints
2. Frontend migrated to IndexedDB + API
3. Basic functional synchronization
4. Service Worker for offline

### Additional Features (Post-MVP)
- [ ] Simple authentication
- [ ] Push notifications
- [ ] Data export/import
- [ ] Advanced conflict resolution
- [ ] Real-time updates (WebSocket)

## Implementation Notes

### Existing Code
- **app.js**: 742 lines, complete functionality with localStorage
- **index.html**: Bulma CSS structure, already responsive
- **styles.css**: CSS variables, custom styles

### Migration Strategy
1. **Backend**: Create from scratch with Flask
2. **Frontend**: Migrate localStorage → IndexedDB gradually
3. **Sync**: Add sync layer without breaking changes
4. **PWA**: Service Worker and manifest at the end

### Dependencies
```python
# requirements.txt
Flask==2.3.3
Flask-CORS==4.0.0
```

```javascript
// No new dependencies - vanilla JS
// Existing: Bulma CSS (CDN)
```

## Success Metrics

### Functional
- [ ] App works completely offline
- [ ] Automatic sync works
- [ ] Multi-device synchronized
- [ ] PWA installs correctly

### Technical
- [ ] <2s initial load time
- [ ] <100ms offline UI response
- [ ] <5s complete synchronization
- [ ] 99.9% backend uptime

This document completely defines the requirements for a generative AI to implement the project from scratch.
