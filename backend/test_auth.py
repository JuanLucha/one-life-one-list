"""Tests for mandatory authentication on all API endpoints."""
import os
import json
import pytest
import tempfile
import shutil

# Set AUTH_TOKEN before importing app (it's checked at import time)
os.environ['AUTH_TOKEN'] = 'test-secret-token'

from app import app


@pytest.fixture
def client(tmp_path):
    """Create a test client with isolated data directory."""
    # Point data to a temp directory so tests don't touch real data
    app.config['TESTING'] = True

    import app as app_module
    orig_data_dir = app_module.DATA_DIR
    orig_backup_dir = app_module.BACKUP_DIR
    orig_tasks = app_module.TASKS_FILE
    orig_categories = app_module.CATEGORIES_FILE
    orig_tags = app_module.TAGS_FILE

    data_dir = str(tmp_path / 'data')
    user_dir = os.path.join(data_dir, 'users', 'default')
    backup_dir = os.path.join(data_dir, 'backups')
    os.makedirs(user_dir, exist_ok=True)
    os.makedirs(backup_dir, exist_ok=True)

    app_module.DATA_DIR = data_dir
    app_module.BACKUP_DIR = backup_dir
    app_module.TASKS_FILE = os.path.join(user_dir, 'tasks.json')
    app_module.CATEGORIES_FILE = os.path.join(user_dir, 'categories.json')
    app_module.TAGS_FILE = os.path.join(user_dir, 'tags.json')

    # Also update the lookup dicts
    app_module.TASKS_FILES['main'] = app_module.TASKS_FILE
    app_module.CATEGORIES_FILES['main'] = app_module.CATEGORIES_FILE
    app_module.TAGS_FILES['main'] = app_module.TAGS_FILE

    for period in ('daily', 'weekly', 'monthly'):
        app_module.TASKS_FILES[period] = os.path.join(user_dir, f'{period}_tasks.json')
        app_module.CATEGORIES_FILES[period] = os.path.join(user_dir, f'{period}_categories.json')
        app_module.TAGS_FILES[period] = os.path.join(user_dir, f'{period}_tags.json')

    with app.test_client() as client:
        yield client

    # Restore originals
    app_module.DATA_DIR = orig_data_dir
    app_module.BACKUP_DIR = orig_backup_dir
    app_module.TASKS_FILE = orig_tasks
    app_module.CATEGORIES_FILE = orig_categories
    app_module.TAGS_FILE = orig_tags


TOKEN = 'test-secret-token'
WRONG_TOKEN = 'wrong-token'
AUTH_HEADER = {'Authorization': f'Bearer {TOKEN}'}
BAD_AUTH_HEADER = {'Authorization': f'Bearer {WRONG_TOKEN}'}


# ---------------------------------------------------------------------------
# Startup guard: AUTH_TOKEN must be set
# ---------------------------------------------------------------------------

def test_startup_requires_auth_token():
    """Server must refuse to start without AUTH_TOKEN."""
    saved = os.environ.get('AUTH_TOKEN')
    try:
        os.environ['AUTH_TOKEN'] = ''
        with pytest.raises(RuntimeError, match='AUTH_TOKEN environment variable is required'):
            # Re-exec the guard logic
            from importlib import reload
            import app as app_module
            reload(app_module)
    finally:
        if saved:
            os.environ['AUTH_TOKEN'] = saved


# ---------------------------------------------------------------------------
# Public endpoints (no auth needed)
# ---------------------------------------------------------------------------

class TestPublicEndpoints:
    def test_health_no_auth(self, client):
        resp = client.get('/api/health')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['status'] == 'ok'

    def test_verify_valid_token(self, client):
        resp = client.post('/api/auth/verify',
                           json={'token': TOKEN},
                           content_type='application/json')
        assert resp.status_code == 200
        assert resp.get_json()['authenticated'] is True

    def test_verify_invalid_token(self, client):
        resp = client.post('/api/auth/verify',
                           json={'token': WRONG_TOKEN},
                           content_type='application/json')
        assert resp.status_code == 401
        assert resp.get_json()['authenticated'] is False

    def test_verify_empty_token(self, client):
        resp = client.post('/api/auth/verify',
                           json={'token': ''},
                           content_type='application/json')
        assert resp.status_code == 401
        assert resp.get_json()['authenticated'] is False

    def test_verify_no_body(self, client):
        resp = client.post('/api/auth/verify',
                           json={},
                           content_type='application/json')
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Protected endpoints – must reject without / with wrong token
# ---------------------------------------------------------------------------

PROTECTED_GET = [
    '/api/tasks',
    '/api/categories',
    '/api/tags',
    '/api/periodic-tasks/daily',
    '/api/periodic-categories/daily',
    '/api/periodic-tags/daily',
    '/api/sync?since=0',
]

PROTECTED_POST = [
    '/api/tasks',
    '/api/categories',
    '/api/tags',
    '/api/periodic-tasks/daily',
    '/api/periodic-categories/daily',
    '/api/periodic-tags/daily',
    '/api/periodic-tasks/daily/reset',
    '/api/sync',
]


class TestProtectedEndpointsRejectNoAuth:
    """Every protected endpoint must return 401 when no token is provided."""

    @pytest.mark.parametrize('url', PROTECTED_GET)
    def test_get_no_auth(self, client, url):
        resp = client.get(url)
        assert resp.status_code == 401, f'GET {url} should be 401 without auth'

    @pytest.mark.parametrize('url', PROTECTED_POST)
    def test_post_no_auth(self, client, url):
        resp = client.post(url, json={}, content_type='application/json')
        assert resp.status_code == 401, f'POST {url} should be 401 without auth'


class TestProtectedEndpointsRejectWrongToken:
    """Every protected endpoint must return 401 with a wrong token."""

    @pytest.mark.parametrize('url', PROTECTED_GET)
    def test_get_wrong_token(self, client, url):
        resp = client.get(url, headers=BAD_AUTH_HEADER)
        assert resp.status_code == 401, f'GET {url} should be 401 with bad token'

    @pytest.mark.parametrize('url', PROTECTED_POST)
    def test_post_wrong_token(self, client, url):
        resp = client.post(url, json={}, content_type='application/json',
                           headers=BAD_AUTH_HEADER)
        assert resp.status_code == 401, f'POST {url} should be 401 with bad token'


class TestProtectedEndpointsAcceptValidToken:
    """Endpoints must succeed (2xx) with the correct token."""

    @pytest.mark.parametrize('url', PROTECTED_GET)
    def test_get_valid_token(self, client, url):
        resp = client.get(url, headers=AUTH_HEADER)
        assert resp.status_code == 200, f'GET {url} should succeed with valid token'

    def test_post_task_valid_token(self, client):
        resp = client.post('/api/tasks',
                           json={'name': 'Test task'},
                           content_type='application/json',
                           headers=AUTH_HEADER)
        assert resp.status_code == 201

    def test_post_category_valid_token(self, client):
        resp = client.post('/api/categories',
                           json={'name': 'Test category'},
                           content_type='application/json',
                           headers=AUTH_HEADER)
        assert resp.status_code == 201

    def test_post_tag_valid_token(self, client):
        resp = client.post('/api/tags',
                           json={'name': 'Test tag'},
                           content_type='application/json',
                           headers=AUTH_HEADER)
        assert resp.status_code == 201


# ---------------------------------------------------------------------------
# Auth header format edge cases
# ---------------------------------------------------------------------------

class TestAuthHeaderEdgeCases:
    def test_missing_bearer_prefix(self, client):
        resp = client.get('/api/tasks', headers={'Authorization': TOKEN})
        assert resp.status_code == 401

    def test_basic_auth_rejected(self, client):
        resp = client.get('/api/tasks', headers={'Authorization': f'Basic {TOKEN}'})
        assert resp.status_code == 401

    def test_empty_bearer(self, client):
        resp = client.get('/api/tasks', headers={'Authorization': 'Bearer '})
        assert resp.status_code == 401

    def test_bearer_with_spaces(self, client):
        resp = client.get('/api/tasks', headers={'Authorization': f'Bearer  {TOKEN}'})
        assert resp.status_code == 401  # extra space makes token " test-secret..."


# ---------------------------------------------------------------------------
# PUT / DELETE also require auth
# ---------------------------------------------------------------------------

class TestMutationEndpointsRequireAuth:
    def test_put_task_no_auth(self, client):
        resp = client.put('/api/tasks/some-id', json={'name': 'x'},
                          content_type='application/json')
        assert resp.status_code == 401

    def test_delete_task_no_auth(self, client):
        resp = client.delete('/api/tasks/some-id')
        assert resp.status_code == 401

    def test_put_category_no_auth(self, client):
        resp = client.put('/api/categories/some-id', json={'name': 'x'},
                          content_type='application/json')
        assert resp.status_code == 401

    def test_delete_category_no_auth(self, client):
        resp = client.delete('/api/categories/some-id')
        assert resp.status_code == 401

    def test_put_tag_no_auth(self, client):
        resp = client.put('/api/tags/some-id', json={'name': 'x'},
                          content_type='application/json')
        assert resp.status_code == 401

    def test_delete_tag_no_auth(self, client):
        resp = client.delete('/api/tags/some-id')
        assert resp.status_code == 401

    def test_put_periodic_task_no_auth(self, client):
        resp = client.put('/api/periodic-tasks/daily/some-id', json={'name': 'x'},
                          content_type='application/json')
        assert resp.status_code == 401

    def test_delete_periodic_task_no_auth(self, client):
        resp = client.delete('/api/periodic-tasks/daily/some-id')
        assert resp.status_code == 401
