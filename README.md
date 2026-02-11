# One Life One List

A comprehensive task management PWA with categories, tags, and periodic task lists. Offline-first architecture with IndexedDB and background sync.

## Features

- **Task Management**: Create, update, and delete tasks with descriptions and subtasks
- **Fast-Task Input**: Quick-add bar at the bottom of the task list — type and press Enter to create tasks with active filters
- **Categories**: Organize tasks by categories with color coding
- **Tags**: Apply multiple tags to tasks for better organization
- **Periodic Lists**: Separate daily, weekly, and monthly task lists with auto-reset
- **Filtering**: Filter tasks by category and tags
- **Completed Tasks**: Automatic separation of completed tasks
- **Authentication**: Optional token-based auth via `AUTH_TOKEN` environment variable
- **Offline-First**: IndexedDB storage with sync queue for offline operation
- **Data Persistence**: Server-side JSON file storage with automatic backups
- **Responsive Design**: Desktop and mobile PWA with bottom navigation
- **Real-time Sync**: Bidirectional synchronization between client and server
- **SPA Deep-Linking**: Client-side routing with full deep-link support (no 404s on refresh)
- **Docker Support**: Full containerization for easy deployment

## Instructions

### Getting Started

Choose one of the following methods to run the application:

#### Method 1: Docker (Recommended)
```bash
# Clone the repository
git clone <repository-url>
cd one-life-one-list

# Build and start all services
docker-compose up --build

# Access the application
# Frontend: http://localhost:80
# Backend API: http://localhost:5005

# Stop the application
docker-compose down
```

#### Method 2: Local Development
```bash
# Clone the repository
git clone <repository-url>
cd one-life-one-list

# Backend Setup
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py

# In another terminal, Frontend Setup
cd frontend
python -m http.server 8000
# Or open index.html directly in browser
```

### Docker Instructions

#### Prerequisites
- Docker installed on your system
- Docker Compose (included with Docker Desktop)

#### Basic Commands
```bash
# Start all services
docker-compose up --build

# Start in detached mode (background)
docker-compose up -d --build

# View logs
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop services
docker-compose down

# Stop and remove volumes (clean data)
docker-compose down -v

# Rebuild specific service
docker-compose up --build backend
docker-compose up --build frontend
```

#### Port Configuration
To change external ports, edit `docker-compose.yml`:
```yaml
services:
  backend:
    ports:
      - "8080:5005"  # Backend on port 8080
  frontend:
    ports:
      - "3000:80"    # Frontend on port 3000
```

#### Data Persistence
- Application data is stored in Docker volume `backend_data`
- Backups are automatically created in the volume
- To backup data externally:
```bash
docker cp one-life-one-list-backend:/app/data ./backup
```

#### Health Checks
Both services include health checks:
```bash
# Check service status
docker-compose ps

# Health check endpoints
curl http://localhost:5005/api/health  # Backend
curl http://localhost:80              # Frontend
```

#### Troubleshooting
```bash
# Check container logs for errors
docker-compose logs backend

# Access container shell
docker-compose exec backend sh
docker-compose exec frontend sh

# Reset everything (remove containers, networks, volumes)
docker-compose down -v --rmi all
```

### Application Usage

#### First Time Setup
1. Access the application at http://localhost:80
2. The application will initialize with sample data
3. Categories and tags are pre-configured for demonstration

#### Daily Usage
1. **Create Tasks**: Click the + button to add new tasks
2. **Organize**: Assign categories and tags to tasks
3. **Subtasks**: Add subtasks for complex items
4. **Filter**: Use category/tag filters to focus on specific tasks
5. **Complete**: Mark tasks as done to move them to completed list

#### Periodic Lists
1. **Switch Lists**: Use navigation tabs or mobile bottom nav
2. **Daily Tasks**: Create routine tasks that reset daily
3. **Weekly Tasks**: Plan weekly activities
4. **Monthly Tasks**: Set monthly goals
5. **Reset**: Use reset buttons to clear completed periodic tasks

#### Data Management
- **Automatic Sync**: Changes are automatically saved
- **Backups**: Previous versions are backed up automatically
- **Export**: Data can be exported from the backend data directory

### Development Instructions

#### Backend Development
```bash
cd backend
source venv/bin/activate
python app.py

# API will be available at http://localhost:5005
# Health check: http://localhost:5005/api/health
```

#### Frontend Development
```bash
cd frontend
# Use any static server
python -m http.server 8000
# Or use live-server for auto-reload
npx live-server
```

#### API Testing
```bash
# Test backend health
curl http://localhost:5005/api/health

# Get all tasks
curl http://localhost:5005/api/tasks

# Create a task
curl -X POST http://localhost:5005/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"name":"Test task","description":"Test description"}'
```

### Production Deployment

#### Environment Variables
Create `.env` file for production:
```bash
FLASK_ENV=production
FLASK_APP=app.py
AUTH_TOKEN=your-secret-token-here
```

#### Authentication
Set the `AUTH_TOKEN` environment variable to enable token-based authentication:
```bash
# Docker
AUTH_TOKEN=mysecrettoken docker-compose up --build

# Local
export AUTH_TOKEN=mysecrettoken
python app.py
```
When set, all `/api/` endpoints (except `/api/health` and `/api/auth/verify`) require a `Authorization: Bearer <token>` header. The frontend shows a login screen to collect the token.

When `AUTH_TOKEN` is not set, authentication is disabled.

#### Security Considerations
- Set `AUTH_TOKEN` in production to protect your data
- Change default ports if needed
- Add reverse proxy for SSL termination
- Regular backups of Docker volumes

#### Scaling
- Use Docker Swarm or Kubernetes for multi-instance deployment
- Consider external database for large-scale deployments
- Implement load balancing for high availability

## Quick Start with Docker

1. **Build and run:**
   ```bash
   docker-compose up --build
   ```

2. **Access the application:**
   - Frontend: http://localhost:80
   - Backend API: http://localhost:5005

3. **Stop:**
   ```bash
   docker-compose down
   ```

## Development Setup

### Backend (Flask)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### Frontend
```bash
cd frontend
# Serve with any static server, e.g.:
python -m http.server 8000
# Or open index.html directly in browser
```

## API Endpoints

### Tasks
- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/<id>` - Update task
- `DELETE /api/tasks/<id>` - Delete task

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category
- `PUT /api/categories/<id>` - Update category
- `DELETE /api/categories/<id>` - Delete category

### Tags
- `GET /api/tags` - Get all tags
- `POST /api/tags` - Create tag
- `PUT /api/tags/<id>` - Update tag
- `DELETE /api/tags/<id>` - Delete tag

### Periodic Tasks
- `GET /api/periodic-tasks/<type>` - Get daily/weekly/monthly tasks
- `POST /api/periodic-tasks/<type>` - Create periodic task
- `PUT /api/periodic-tasks/<type>/<id>` - Update periodic task
- `DELETE /api/periodic-tasks/<type>/<id>` - Delete periodic task
- `POST /api/periodic-tasks/<type>/reset` - Reset completion status

### Sync
- `GET /api/sync` - Pull data changes
- `POST /api/sync` - Push batch updates

### Authentication
- `POST /api/auth/verify` - Verify a token (public endpoint)

### Health
- `GET /api/health` - Health check (public endpoint)

## Data Storage

- **Backend**: JSON files in `data/users/default/` directory
- **Automatic Backups**: Created before any write operation
- **Frontend**: IndexedDB for offline-first storage with sync queue
- **Sync**: Bidirectional sync between client and server with conflict resolution

## Architecture

- **Backend**: Flask REST API with JSON file storage
- **Frontend**: Vanilla JavaScript PWA with Bulma CSS
- **Storage**: IndexedDB (client) + JSON files (server)
- **Auth**: Optional Bearer token via `AUTH_TOKEN` env var
- **Routing**: Client-side SPA router with deep-link support
- **Service Worker**: SPA-aware fetch handler, background sync, offline caching
- **CORS**: Enabled for cross-origin requests
- **Docker**: Multi-container setup with Nginx and Python

## Periodic Lists

The application supports four types of task lists with independent data:

- **Main**: General tasks that persist until manually completed
- **Daily**: Tasks designed for daily routines that can be reset automatically
- **Weekly**: Tasks for weekly planning and recurring weekly activities  
- **Monthly**: Tasks for monthly goals and monthly recurring items

### Features per List Type:
- **Independent Categories**: Each list type has its own category system
- **Independent Tags**: Separate tag management for each list type
- **Auto-reset Functionality**: Daily/weekly/monthly lists can reset completion status
- **Filtered Views**: Switch between list types with dedicated navigation
- **Mobile Navigation**: Bottom navigation bar for easy switching on mobile devices

### Reset Behavior:
- **Daily Tasks**: Reset all completed tasks to uncompleted status
- **Weekly Tasks**: Reset weekly task completion for new week
- **Monthly Tasks**: Reset monthly task completion for new month
- **Subtasks**: All subtasks within periodic tasks are also reset

Each list type maintains complete separation of data, allowing users to organize different aspects of their task management without interference between categories and tags across different time periods.
