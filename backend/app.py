from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
from datetime import datetime
import uuid

app = Flask(__name__)
CORS(app)

# Configuration
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
BACKUP_DIR = os.path.join(DATA_DIR, 'backups')
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend')  # Frontend directory

# Ensure data directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(os.path.join(DATA_DIR, 'users'), exist_ok=True)
os.makedirs(os.path.join(DATA_DIR, 'users', 'default'), exist_ok=True)
os.makedirs(BACKUP_DIR, exist_ok=True)

# File paths
TASKS_FILE = os.path.join(DATA_DIR, 'users', 'default', 'tasks.json')
DAILY_TASKS_FILE = os.path.join(DATA_DIR, 'users', 'default', 'daily_tasks.json')
WEEKLY_TASKS_FILE = os.path.join(DATA_DIR, 'users', 'default', 'weekly_tasks.json')
MONTHLY_TASKS_FILE = os.path.join(DATA_DIR, 'users', 'default', 'monthly_tasks.json')
CATEGORIES_FILE = os.path.join(DATA_DIR, 'users', 'default', 'categories.json')
DAILY_CATEGORIES_FILE = os.path.join(DATA_DIR, 'users', 'default', 'daily_categories.json')
WEEKLY_CATEGORIES_FILE = os.path.join(DATA_DIR, 'users', 'default', 'weekly_categories.json')
MONTHLY_CATEGORIES_FILE = os.path.join(DATA_DIR, 'users', 'default', 'monthly_categories.json')
TAGS_FILE = os.path.join(DATA_DIR, 'users', 'default', 'tags.json')
DAILY_TAGS_FILE = os.path.join(DATA_DIR, 'users', 'default', 'daily_tags.json')
WEEKLY_TAGS_FILE = os.path.join(DATA_DIR, 'users', 'default', 'weekly_tags.json')
MONTHLY_TAGS_FILE = os.path.join(DATA_DIR, 'users', 'default', 'monthly_tags.json')
METADATA_FILE = os.path.join(DATA_DIR, 'users', 'default', 'metadata.json')
LAST_RESET_FILE = os.path.join(DATA_DIR, 'users', 'default', 'last_reset.json')

def read_json_file(filepath):
    """Read JSON file with error handling"""
    try:
        if os.path.exists(filepath):
            with open(filepath, 'r') as f:
                return json.load(f)
        return {"version": "1.0", "last_modified": 0, "data": []}
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error reading {filepath}: {e}")
        return {"version": "1.0", "last_modified": 0, "data": []}

def write_json_file(filepath, data):
    """Write JSON file with error handling"""
    try:
        # Create backup before writing
        if os.path.exists(filepath):
            backup_path = os.path.join(BACKUP_DIR, f"{os.path.basename(filepath)}.backup")
            with open(filepath, 'r') as original, open(backup_path, 'w') as backup:
                backup.write(original.read())
        
        # Add metadata
        file_data = {
            "version": "1.0",
            "last_modified": int(datetime.now().timestamp() * 1000),
            "data": data
        }
        
        with open(filepath, 'w') as f:
            json.dump(file_data, f, indent=2)
        return True
    except (IOError, json.JSONDecodeError) as e:
        print(f"Error writing {filepath}: {e}")
        return False

def generate_id():
    """Generate unique ID"""
    return str(uuid.uuid4())

# Routes
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "timestamp": datetime.now().isoformat()})

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    file_data = read_json_file(TASKS_FILE)
    return jsonify(file_data['data'])

@app.route('/api/tasks', methods=['POST'])
def create_task():
    task_data = request.json
    task_data['id'] = generate_id()
    task_data['created_at'] = int(datetime.now().timestamp() * 1000)
    task_data['updated_at'] = task_data['created_at']
    
    file_data = read_json_file(TASKS_FILE)
    file_data['data'].append(task_data)
    
    if write_json_file(TASKS_FILE, file_data['data']):
        return jsonify(task_data), 201
    else:
        return jsonify({"error": "Failed to save task"}), 500

@app.route('/api/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    file_data = read_json_file(TASKS_FILE)
    tasks = file_data['data']
    
    task_index = next((i for i, task in enumerate(tasks) if task['id'] == task_id), None)
    
    if task_index is None:
        return jsonify({"error": "Task not found"}), 404
    
    updated_task = request.json
    updated_task['id'] = task_id
    updated_task['updated_at'] = int(datetime.now().timestamp() * 1000)
    
    # Preserve created_at if not provided
    if 'created_at' not in updated_task:
        updated_task['created_at'] = tasks[task_index]['created_at']
    
    tasks[task_index] = updated_task
    
    if write_json_file(TASKS_FILE, tasks):
        return jsonify(updated_task)
    else:
        return jsonify({"error": "Failed to update task"}), 500

@app.route('/api/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    file_data = read_json_file(TASKS_FILE)
    tasks = file_data['data']
    
    task_index = next((i for i, task in enumerate(tasks) if task['id'] == task_id), None)
    
    if task_index is None:
        return jsonify({"error": "Task not found"}), 404
    
    deleted_task = tasks.pop(task_index)
    
    if write_json_file(TASKS_FILE, tasks):
        return jsonify(deleted_task)
    else:
        return jsonify({"error": "Failed to delete task"}), 500

@app.route('/api/categories', methods=['GET'])
def get_categories():
    file_data = read_json_file(CATEGORIES_FILE)
    return jsonify(file_data['data'])

@app.route('/api/categories', methods=['POST'])
def create_category():
    category_data = request.json
    category_data['id'] = generate_id()
    
    file_data = read_json_file(CATEGORIES_FILE)
    file_data['data'].append(category_data)
    
    if write_json_file(CATEGORIES_FILE, file_data['data']):
        return jsonify(category_data), 201
    else:
        return jsonify({"error": "Failed to save category"}), 500

@app.route('/api/categories/<string:category_id>', methods=['PUT'])
def update_category(category_id):
    category_data = request.json
    
    file_data = read_json_file(CATEGORIES_FILE)
    
    # Find and update the category
    for i, category in enumerate(file_data['data']):
        if category['id'] == category_id:
            file_data['data'][i] = category_data
            break
    else:
        return jsonify({"error": "Category not found"}), 404
    
    if write_json_file(CATEGORIES_FILE, file_data['data']):
        return jsonify(category_data)
    else:
        return jsonify({"error": "Failed to update category"}), 500

@app.route('/api/categories/<string:category_id>', methods=['DELETE'])
def delete_category(category_id):
    file_data = read_json_file(CATEGORIES_FILE)
    
    # Find and remove the category
    for i, category in enumerate(file_data['data']):
        if category['id'] == category_id:
            del file_data['data'][i]
            break
    else:
        return jsonify({"error": "Category not found"}), 404
    
    if write_json_file(CATEGORIES_FILE, file_data['data']):
        return jsonify({"message": "Category deleted successfully"})
    else:
        return jsonify({"error": "Failed to delete category"}), 500

@app.route('/api/tags', methods=['GET'])
def get_tags():
    file_data = read_json_file(TAGS_FILE)
    return jsonify(file_data['data'])

@app.route('/api/tags', methods=['POST'])
def create_tag():
    tag_data = request.json
    tag_data['id'] = generate_id()
    
    file_data = read_json_file(TAGS_FILE)
    file_data['data'].append(tag_data)
    
    if write_json_file(TAGS_FILE, file_data['data']):
        return jsonify(tag_data), 201
    else:
        return jsonify({"error": "Failed to save tag"}), 500

@app.route('/api/tags/<string:tag_id>', methods=['PUT'])
def update_tag(tag_id):
    tag_data = request.json
    
    file_data = read_json_file(TAGS_FILE)
    
    # Find and update the tag
    for i, tag in enumerate(file_data['data']):
        if tag['id'] == tag_id:
            file_data['data'][i] = tag_data
            break
    else:
        return jsonify({"error": "Tag not found"}), 404
    
    if write_json_file(TAGS_FILE, file_data['data']):
        return jsonify(tag_data)
    else:
        return jsonify({"error": "Failed to update tag"}), 500

@app.route('/api/tags/<string:tag_id>', methods=['DELETE'])
def delete_tag(tag_id):
    file_data = read_json_file(TAGS_FILE)
    
    # Find and remove the tag
    for i, tag in enumerate(file_data['data']):
        if tag['id'] == tag_id:
            del file_data['data'][i]
            break
    else:
        return jsonify({"error": "Tag not found"}), 404
    
    if write_json_file(TAGS_FILE, file_data['data']):
        return jsonify({"message": "Tag deleted successfully"})
    else:
        return jsonify({"error": "Failed to delete tag"}), 500

# Periodic Tasks Routes
@app.route('/api/periodic-tasks/<task_type>', methods=['GET'])
def get_periodic_tasks(task_type):
    """Get tasks for a specific periodic list (daily, weekly, monthly)"""
    if task_type not in ['daily', 'weekly', 'monthly']:
        return jsonify({"error": "Invalid task type"}), 400
    
    file_map = {
        'daily': DAILY_TASKS_FILE,
        'weekly': WEEKLY_TASKS_FILE,
        'monthly': MONTHLY_TASKS_FILE
    }
    
    file_data = read_json_file(file_map[task_type])
    return jsonify(file_data['data'])

@app.route('/api/periodic-tasks/<task_type>', methods=['POST'])
def create_periodic_task(task_type):
    """Create a new task in a specific periodic list"""
    if task_type not in ['daily', 'weekly', 'monthly']:
        return jsonify({"error": "Invalid task type"}), 400
    
    file_map = {
        'daily': DAILY_TASKS_FILE,
        'weekly': WEEKLY_TASKS_FILE,
        'monthly': MONTHLY_TASKS_FILE
    }
    
    task_data = request.json
    task_data['id'] = generate_id()
    task_data['created_at'] = int(datetime.now().timestamp() * 1000)
    task_data['updated_at'] = task_data['created_at']
    
    file_data = read_json_file(file_map[task_type])
    file_data['data'].append(task_data)
    
    if write_json_file(file_map[task_type], file_data['data']):
        return jsonify(task_data), 201
    else:
        return jsonify({"error": "Failed to save task"}), 500

@app.route('/api/periodic-tasks/<task_type>/<task_id>', methods=['PUT'])
def update_periodic_task(task_type, task_id):
    """Update a task in a specific periodic list"""
    if task_type not in ['daily', 'weekly', 'monthly']:
        return jsonify({"error": "Invalid task type"}), 400
    
    file_map = {
        'daily': DAILY_TASKS_FILE,
        'weekly': WEEKLY_TASKS_FILE,
        'monthly': MONTHLY_TASKS_FILE
    }
    
    file_data = read_json_file(file_map[task_type])
    tasks = file_data['data']
    
    task_index = next((i for i, task in enumerate(tasks) if task['id'] == task_id), None)
    
    if task_index is None:
        return jsonify({"error": "Task not found"}), 404
    
    updated_task = request.json
    updated_task['id'] = task_id
    updated_task['updated_at'] = int(datetime.now().timestamp() * 1000)
    
    # Preserve created_at if not provided
    if 'created_at' not in updated_task:
        updated_task['created_at'] = tasks[task_index]['created_at']
    
    tasks[task_index] = updated_task
    
    if write_json_file(file_map[task_type], tasks):
        return jsonify(updated_task)
    else:
        return jsonify({"error": "Failed to update task"}), 500

@app.route('/api/periodic-tasks/<task_type>/<task_id>', methods=['DELETE'])
def delete_periodic_task(task_type, task_id):
    """Delete a task from a specific periodic list"""
    if task_type not in ['daily', 'weekly', 'monthly']:
        return jsonify({"error": "Invalid task type"}), 400
    
    file_map = {
        'daily': DAILY_TASKS_FILE,
        'weekly': WEEKLY_TASKS_FILE,
        'monthly': MONTHLY_TASKS_FILE
    }
    
    file_data = read_json_file(file_map[task_type])
    tasks = file_data['data']
    
    task_index = next((i for i, task in enumerate(tasks) if task['id'] == task_id), None)
    
    if task_index is None:
        return jsonify({"error": "Task not found"}), 404
    
    deleted_task = tasks.pop(task_index)
    
    if write_json_file(file_map[task_type], tasks):
        return jsonify(deleted_task)
    else:
        return jsonify({"error": "Failed to delete task"}), 500

@app.route('/api/periodic-tasks/<task_type>/reset', methods=['POST'])
def reset_periodic_tasks(task_type):
    """Reset completion status of all tasks in a periodic list"""
    if task_type not in ['daily', 'weekly', 'monthly']:
        return jsonify({"error": "Invalid task type"}), 400
    
    file_map = {
        'daily': DAILY_TASKS_FILE,
        'weekly': WEEKLY_TASKS_FILE,
        'monthly': MONTHLY_TASKS_FILE
    }
    
    file_data = read_json_file(file_map[task_type])
    tasks = file_data['data']
    
    now = int(datetime.now().timestamp() * 1000)
    has_changes = False
    
    for task in tasks:
        if task.get('done', False):
            task['done'] = False
            task['updated_at'] = now
            # Reset subtasks too
            if 'subtasks' in task:
                for subtask in task['subtasks']:
                    if subtask.get('done', False):
                        subtask['done'] = False
            has_changes = True
    
    if has_changes:
        if write_json_file(file_map[task_type], tasks):
            # Update last reset time
            update_last_reset_time(task_type)
            return jsonify({"message": f"Reset {task_type} tasks", "reset_count": len(tasks)})
        else:
            return jsonify({"error": "Failed to reset tasks"}), 500
    else:
        return jsonify({"message": "No tasks needed reset", "reset_count": 0})

# Periodic Categories Routes
@app.route('/api/periodic-categories/<task_type>', methods=['GET'])
def get_periodic_categories(task_type):
    """Get categories for a specific periodic list"""
    if task_type not in ['daily', 'weekly', 'monthly']:
        return jsonify({"error": "Invalid task type"}), 400
    
    file_map = {
        'daily': DAILY_CATEGORIES_FILE,
        'weekly': WEEKLY_CATEGORIES_FILE,
        'monthly': MONTHLY_CATEGORIES_FILE
    }
    
    file_data = read_json_file(file_map[task_type])
    return jsonify(file_data['data'])

@app.route('/api/periodic-categories/<task_type>', methods=['POST'])
def create_periodic_category(task_type):
    """Create a new category in a specific periodic list"""
    if task_type not in ['daily', 'weekly', 'monthly']:
        return jsonify({"error": "Invalid task type"}), 400
    
    file_map = {
        'daily': DAILY_CATEGORIES_FILE,
        'weekly': WEEKLY_CATEGORIES_FILE,
        'monthly': MONTHLY_CATEGORIES_FILE
    }
    
    category_data = request.json
    category_data['id'] = generate_id()
    
    file_data = read_json_file(file_map[task_type])
    file_data['data'].append(category_data)
    
    if write_json_file(file_map[task_type], file_data['data']):
        return jsonify(category_data), 201
    else:
        return jsonify({"error": "Failed to save category"}), 500

# Periodic Tags Routes
@app.route('/api/periodic-tags/<task_type>', methods=['GET'])
def get_periodic_tags(task_type):
    """Get tags for a specific periodic list"""
    if task_type not in ['daily', 'weekly', 'monthly']:
        return jsonify({"error": "Invalid task type"}), 400
    
    file_map = {
        'daily': DAILY_TAGS_FILE,
        'weekly': WEEKLY_TAGS_FILE,
        'monthly': MONTHLY_TAGS_FILE
    }
    
    file_data = read_json_file(file_map[task_type])
    return jsonify(file_data['data'])

@app.route('/api/periodic-tags/<task_type>', methods=['POST'])
def create_periodic_tag(task_type):
    """Create a new tag in a specific periodic list"""
    if task_type not in ['daily', 'weekly', 'monthly']:
        return jsonify({"error": "Invalid task type"}), 400
    
    file_map = {
        'daily': DAILY_TAGS_FILE,
        'weekly': WEEKLY_TAGS_FILE,
        'monthly': MONTHLY_TAGS_FILE
    }
    
    tag_data = request.json
    tag_data['id'] = generate_id()
    
    file_data = read_json_file(file_map[task_type])
    file_data['data'].append(tag_data)
    
    if write_json_file(file_map[task_type], file_data['data']):
        return jsonify(tag_data), 201
    else:
        return jsonify({"error": "Failed to save tag"}), 500

def update_last_reset_time(task_type):
    """Update the last reset time for a periodic list"""
    try:
        reset_data = read_json_file(LAST_RESET_FILE)
        if 'data' not in reset_data:
            reset_data['data'] = {}
        
        reset_data['data'][task_type] = datetime.now().isoformat()
        write_json_file(LAST_RESET_FILE, reset_data['data'])
    except Exception as e:
        print(f"Error updating last reset time: {e}")

@app.route('/api/sync', methods=['GET'])
def sync_pull():
    """Get all data for synchronization"""
    since = request.args.get('since', '0')
    
    tasks_data = read_json_file(TASKS_FILE)
    categories_data = read_json_file(CATEGORIES_FILE)
    tags_data = read_json_file(TAGS_FILE)
    
    # Only return data modified since the given timestamp
    since_timestamp = int(since)
    
    result = {
        'tasks': [task for task in tasks_data['data'] if task.get('updated_at', task.get('created_at', 0)) > since_timestamp],
        'categories': categories_data['data'],  # Categories rarely change
        'tags': tags_data['data'],  # Tags rarely change
        'current_version': tasks_data.get('last_modified', 0)
    }
    
    return jsonify(result)

@app.route('/api/sync', methods=['POST'])
def sync_push():
    """Receive batch updates from client"""
    operations = request.json.get('operations', [])
    client_version = request.json.get('client_version', 0)
    
    results = []
    conflicts = []
    
    for operation in operations:
        op_type = operation.get('type')
        entity = operation.get('entity')
        data = operation.get('data')
        list_type = operation.get('listType', 'main')
        
        try:
            if entity == 'task':
                # Determine which file to use based on list_type
                if list_type == 'main':
                    tasks_file = TASKS_FILE
                elif list_type == 'daily':
                    tasks_file = DAILY_TASKS_FILE
                elif list_type == 'weekly':
                    tasks_file = WEEKLY_TASKS_FILE
                elif list_type == 'monthly':
                    tasks_file = MONTHLY_TASKS_FILE
                else:
                    results.append({'type': 'ERROR', 'entity': 'task', 'error': f'Invalid list_type: {list_type}'})
                    continue
                
                if op_type == 'CREATE':
                    # Check if task already exists
                    file_data = read_json_file(tasks_file)
                    existing = next((t for t in file_data['data'] if t['id'] == data['id']), None)
                    if existing:
                        conflicts.append({'type': 'CREATE_CONFLICT', 'entity': 'task', 'id': data['id']})
                    else:
                        # Create new task
                        data['created_at'] = int(datetime.now().timestamp() * 1000)
                        data['updated_at'] = data['created_at']
                        file_data['data'].append(data)
                        if write_json_file(tasks_file, file_data['data']):
                            results.append({'type': 'CREATE_SUCCESS', 'entity': 'task', 'id': data['id']})
                        else:
                            results.append({'type': 'CREATE_FAILED', 'entity': 'task', 'id': data['id']})
                
                elif op_type == 'UPDATE':
                    # Update existing task
                    file_data = read_json_file(tasks_file)
                    tasks = file_data['data']
                    task_index = next((i for i, t in enumerate(tasks) if t['id'] == data['id']), None)
                    
                    if task_index is not None:
                        # Check for conflicts (server version newer than client)
                        server_updated = tasks[task_index].get('updated_at', 0)
                        client_updated = data.get('updated_at', 0)
                        
                        if server_updated > client_updated:
                            conflicts.append({'type': 'UPDATE_CONFLICT', 'entity': 'task', 'id': data['id'], 
                                            'server_data': tasks[task_index], 'client_data': data})
                        else:
                            # Apply update
                            data['updated_at'] = int(datetime.now().timestamp() * 1000)
                            tasks[task_index] = data
                            if write_json_file(tasks_file, tasks):
                                results.append({'type': 'UPDATE_SUCCESS', 'entity': 'task', 'id': data['id']})
                            else:
                                results.append({'type': 'UPDATE_FAILED', 'entity': 'task', 'id': data['id']})
                    else:
                        results.append({'type': 'UPDATE_NOT_FOUND', 'entity': 'task', 'id': data['id']})
                
                elif op_type == 'DELETE':
                    # Delete task
                    file_data = read_json_file(tasks_file)
                    tasks = file_data['data']
                    task_index = next((i for i, t in enumerate(tasks) if t['id'] == data['id']), None)
                    
                    if task_index is not None:
                        tasks.pop(task_index)
                        if write_json_file(tasks_file, tasks):
                            results.append({'type': 'DELETE_SUCCESS', 'entity': 'task', 'id': data['id']})
                        else:
                            results.append({'type': 'DELETE_FAILED', 'entity': 'task', 'id': data['id']})
                    else:
                        results.append({'type': 'DELETE_NOT_FOUND', 'entity': 'task', 'id': data['id']})
            
            elif entity == 'category':
                # Determine which file to use based on list_type
                if list_type == 'main':
                    categories_file = CATEGORIES_FILE
                elif list_type == 'daily':
                    categories_file = DAILY_CATEGORIES_FILE
                elif list_type == 'weekly':
                    categories_file = WEEKLY_CATEGORIES_FILE
                elif list_type == 'monthly':
                    categories_file = MONTHLY_CATEGORIES_FILE
                else:
                    results.append({'type': 'ERROR', 'entity': 'category', 'error': f'Invalid list_type: {list_type}'})
                    continue
                
                if op_type == 'CREATE':
                    # Check if category already exists
                    file_data = read_json_file(categories_file)
                    existing = next((c for c in file_data['data'] if c['id'] == data['id']), None)
                    if existing:
                        conflicts.append({'type': 'CREATE_CONFLICT', 'entity': 'category', 'id': data['id']})
                    else:
                        # Create new category
                        file_data['data'].append(data)
                        if write_json_file(categories_file, file_data['data']):
                            results.append({'type': 'CREATE_SUCCESS', 'entity': 'category', 'id': data['id']})
                        else:
                            results.append({'type': 'CREATE_FAILED', 'entity': 'category', 'id': data['id']})
                
                elif op_type == 'UPDATE':
                    # Update existing category
                    file_data = read_json_file(categories_file)
                    categories = file_data['data']
                    category_index = next((i for i, c in enumerate(categories) if c['id'] == data['id']), None)
                    
                    if category_index is not None:
                        # Apply update
                        categories[category_index] = data
                        if write_json_file(categories_file, categories):
                            results.append({'type': 'UPDATE_SUCCESS', 'entity': 'category', 'id': data['id']})
                        else:
                            results.append({'type': 'UPDATE_FAILED', 'entity': 'category', 'id': data['id']})
                    else:
                        results.append({'type': 'UPDATE_NOT_FOUND', 'entity': 'category', 'id': data['id']})
                
                elif op_type == 'DELETE':
                    # Delete category
                    file_data = read_json_file(categories_file)
                    categories = file_data['data']
                    category_index = next((i for i, c in enumerate(categories) if c['id'] == data['id']), None)
                    
                    if category_index is not None:
                        categories.pop(category_index)
                        if write_json_file(categories_file, categories):
                            results.append({'type': 'DELETE_SUCCESS', 'entity': 'category', 'id': data['id']})
                        else:
                            results.append({'type': 'DELETE_FAILED', 'entity': 'category', 'id': data['id']})
                    else:
                        results.append({'type': 'DELETE_NOT_FOUND', 'entity': 'category', 'id': data['id']})
            
            elif entity == 'tag':
                # Determine which file to use based on list_type
                if list_type == 'main':
                    tags_file = TAGS_FILE
                elif list_type == 'daily':
                    tags_file = DAILY_TAGS_FILE
                elif list_type == 'weekly':
                    tags_file = WEEKLY_TAGS_FILE
                elif list_type == 'monthly':
                    tags_file = MONTHLY_TAGS_FILE
                else:
                    results.append({'type': 'ERROR', 'entity': 'tag', 'error': f'Invalid list_type: {list_type}'})
                    continue
                
                if op_type == 'CREATE':
                    # Check if tag already exists
                    file_data = read_json_file(tags_file)
                    existing = next((t for t in file_data['data'] if t['id'] == data['id']), None)
                    if existing:
                        conflicts.append({'type': 'CREATE_CONFLICT', 'entity': 'tag', 'id': data['id']})
                    else:
                        # Create new tag
                        file_data['data'].append(data)
                        if write_json_file(tags_file, file_data['data']):
                            results.append({'type': 'CREATE_SUCCESS', 'entity': 'tag', 'id': data['id']})
                        else:
                            results.append({'type': 'CREATE_FAILED', 'entity': 'tag', 'id': data['id']})
                
                elif op_type == 'UPDATE':
                    # Update existing tag
                    file_data = read_json_file(tags_file)
                    tags = file_data['data']
                    tag_index = next((i for i, t in enumerate(tags) if t['id'] == data['id']), None)
                    
                    if tag_index is not None:
                        # Apply update
                        tags[tag_index] = data
                        if write_json_file(tags_file, tags):
                            results.append({'type': 'UPDATE_SUCCESS', 'entity': 'tag', 'id': data['id']})
                        else:
                            results.append({'type': 'UPDATE_FAILED', 'entity': 'tag', 'id': data['id']})
                    else:
                        results.append({'type': 'UPDATE_NOT_FOUND', 'entity': 'tag', 'id': data['id']})
                
                elif op_type == 'DELETE':
                    # Delete tag
                    file_data = read_json_file(tags_file)
                    tags = file_data['data']
                    tag_index = next((i for i, t in enumerate(tags) if t['id'] == data['id']), None)
                    
                    if tag_index is not None:
                        tags.pop(tag_index)
                        if write_json_file(tags_file, tags):
                            results.append({'type': 'DELETE_SUCCESS', 'entity': 'tag', 'id': data['id']})
                        else:
                            results.append({'type': 'DELETE_FAILED', 'entity': 'tag', 'id': data['id']})
                    else:
                        results.append({'type': 'DELETE_NOT_FOUND', 'entity': 'tag', 'id': data['id']})
                
        except Exception as e:
            results.append({'type': 'ERROR', 'entity': entity, 'error': str(e)})
    
    # Return current state after operations
    tasks_data = read_json_file(TASKS_FILE)
    categories_data = read_json_file(CATEGORIES_FILE)
    tags_data = read_json_file(TAGS_FILE)
    
    return jsonify({
        'success': True,
        'results': results,
        'conflicts': conflicts,
        'new_state': {
            'tasks': tasks_data['data'],
            'categories': categories_data['data'],
            'tags': tags_data['data']
        },
        'current_version': tasks_data.get('last_modified', 0)
    })

# Static file serving - Serve frontend files
@app.route('/<path:filename>')
def serve_static_files(filename):
    """Serve static files (CSS, JS, images, etc.) and index.html for SPA"""
    file_path = os.path.join(FRONTEND_DIR, filename)
    
    # Check if it's a static file with known extensions
    static_extensions = ['.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2']
    if any(filename.lower().endswith(ext) for ext in static_extensions):
        if os.path.exists(file_path):
            return send_from_directory(FRONTEND_DIR, filename)
    
    # If not a static file or doesn't exist, serve index.html for SPA routing
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/')
def serve_index():
    """Serve the SPA frontend for index"""
    return send_from_directory(FRONTEND_DIR, 'index.html')

if __name__ == '__main__':
    # Initialize with sample data if files don't exist
    if not os.path.exists(TASKS_FILE):
        sample_tasks = [
            {
                'id': 'task1',
                'name': 'Buy groceries',
                'description': 'Milk, Bread, Cheese',
                'categoryId': 'cat1',
                'tagIds': ['tag4'],
                'subtasks': [{'id': 'sub1', 'name': 'Buy milk', 'done': False}],
                'done': False,
                'created_at': int(datetime.now().timestamp() * 1000),
                'updated_at': int(datetime.now().timestamp() * 1000),
            },
            {
                'id': 'task2',
                'name': 'Walk the dog',
                'description': 'Evening walk in the park',
                'categoryId': 'cat2',
                'tagIds': ['tag1', 'tag3'],
                'subtasks': [],
                'done': False,
                'created_at': int(datetime.now().timestamp() * 1000),
                'updated_at': int(datetime.now().timestamp() * 1000),
            },
            {
                'id': 'task3',
                'name': 'Read a book',
                'description': 'Finish reading the current chapter',
                'categoryId': None,
                'tagIds': ['tag2'],
                'subtasks': [{'id': 'sub2', 'name': 'Chapter 5', 'done': True}],
                'done': False,
                'created_at': int(datetime.now().timestamp() * 1000),
                'updated_at': int(datetime.now().timestamp() * 1000),
            }
        ]
        write_json_file(TASKS_FILE, sample_tasks)
    
    if not os.path.exists(CATEGORIES_FILE):
        sample_categories = [
            {'id': 'cat1', 'name': 'Personal', 'color': '#e8e5ff'},
            {'id': 'cat2', 'name': 'Work', 'color': '#ffebee'},
            {'id': 'cat3', 'name': 'Shopping', 'color': '#fff3e0'}
        ]
        write_json_file(CATEGORIES_FILE, sample_categories)
    
    if not os.path.exists(TAGS_FILE):
        sample_tags = [
            {'id': 'tag1', 'name': 'urgent'},
            {'id': 'tag2', 'name': 'learning'},
            {'id': 'tag3', 'name': 'health'},
            {'id': 'tag4', 'name': 'home'}
        ]
        write_json_file(TAGS_FILE, sample_tags)
    
    app.run(host='0.0.0.0', port=5005, debug=True)
