/**
 * Vanilla JS Router for SPA functionality
 */
class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.init();
  }

  /**
   * Initialize the router
   */
  init() {
    // Handle initial route
    this.handleRoute();

    // Handle browser navigation
    window.addEventListener('popstate', (e) => {
      this.handleRoute();
    });

    // Handle link clicks
    document.addEventListener('click', (e) => {
      if (e.target.tagName === 'A' && e.target.getAttribute('data-route')) {
        e.preventDefault();
        const path = e.target.getAttribute('href');
        this.navigate(path);
      }
    });
  }

  /**
   * Register a route
   * @param {string} path - Route path
   * @param {Function} handler - Route handler function
   */
  register(path, handler) {
    this.routes.set(path, handler);
  }

  /**
   * Navigate to a route
   * @param {string} path - Route path
   */
  navigate(path) {
    window.history.pushState({}, '', path);
    this.handleRoute();
  }

  /**
   * Handle current route
   */
  handleRoute() {
    const path = window.location.pathname;
    console.log('Router: handling route:', path);

    // Find matching route
    let handler = null;
    let params = {};

    // Check exact matches first
    if (this.routes.has(path)) {
      handler = this.routes.get(path);
    } else {
      // Check pattern matches
      for (const [routePath, routeHandler] of this.routes) {
        const match = this.matchRoute(routePath, path);
        if (match) {
          handler = routeHandler;
          params = match.params;
          break;
        }
      }
    }

    if (handler) {
      this.currentRoute = path;
      handler(params);
    } else {
      console.warn('Router: No handler found for route:', path);
      // Default to home route
      if (this.routes.has('/')) {
        this.routes.get('/')({});
      }
    }
  }

  /**
   * Match a route pattern against a path
   * @param {string} routePath - Route pattern (e.g., '/edit/:id')
   * @param {string} actualPath - Actual path (e.g., '/edit/123')
   * @returns {Object|null} Match result with params
   */
  matchRoute(routePath, actualPath) {
    const routeSegments = routePath.split('/').filter(s => s);
    const pathSegments = actualPath.split('/').filter(s => s);

    if (routeSegments.length !== pathSegments.length) {
      return null;
    }

    const params = {};
    for (let i = 0; i < routeSegments.length; i++) {
      const routeSegment = routeSegments[i];
      const pathSegment = pathSegments[i];

      if (routeSegment.startsWith(':')) {
        // Parameter segment
        const paramName = routeSegment.slice(1);
        params[paramName] = pathSegment;
      } else if (routeSegment !== pathSegment) {
        // Static segment doesn't match
        return null;
      }
    }

    return { params };
  }

  /**
   * Get current route
   * @returns {string|null} Current route path
   */
  getCurrentRoute() {
    return this.currentRoute;
  }
}

// Create global router instance
const router = new Router();

// Make router available globally
window.router = router;

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Router;
}
