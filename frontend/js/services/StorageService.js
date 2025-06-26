// ===== STORAGE SERVICE =====
//
// This service manages localStorage and sessionStorage for the Terratune frontend.
// It provides a unified interface for storing, retrieving, and removing data with a project-specific prefix.
// It also offers helpers for user preferences, recent stations, search history, map settings, filters, and caching.
//
// Main responsibilities:
// - Abstract localStorage/sessionStorage access with error handling
// - Store and retrieve user and app state (preferences, recents, filters, etc.)
// - Manage cache with TTL (time-to-live) for temporary data
// - Provide utility methods for storage size, keys, and existence checks
//
// This service is used by models, controllers, and services to persist and retrieve client-side state.

export class StorageService {
    /**
     * Constructor for StorageService.
     * Sets a prefix for all keys to avoid collisions.
     */
    constructor() {
        this.prefix = 'terratune_';
    }
    
    // ===== Local Storage Methods =====

    /**
     * Stores a value in localStorage under the prefixed key.
     * @param {string} key
     * @param {*} value
     * @returns {boolean} True if successful, false otherwise.
     */
    setItem(key, value) {
        try {
            const serializedValue = JSON.stringify(value);
            localStorage.setItem(this.prefix + key, serializedValue);
            return true;
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
            return false;
        }
    }
    
    /**
     * Retrieves a value from localStorage by key, or returns defaultValue if not found or error.
     * @param {string} key
     * @param {*} defaultValue
     * @returns {*} The stored value or defaultValue.
     */
    getItem(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(this.prefix + key);
            if (item === null) {
                return defaultValue;
            }
            return JSON.parse(item);
        } catch (error) {
            console.error('Failed to read from localStorage:', error);
            return defaultValue;
        }
    }
    
    /**
     * Removes a value from localStorage by key.
     * @param {string} key
     * @returns {boolean} True if successful, false otherwise.
     */
    removeItem(key) {
        try {
            localStorage.removeItem(this.prefix + key);
            return true;
        } catch (error) {
            console.error('Failed to remove from localStorage:', error);
            return false;
        }
    }
    
    /**
     * Clears all keys in localStorage with the service prefix.
     * @returns {boolean} True if successful, false otherwise.
     */
    clear() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (error) {
            console.error('Failed to clear localStorage:', error);
            return false;
        }
    }
    
    // ===== Session Storage Methods =====

    /**
     * Stores a value in sessionStorage under the prefixed key.
     * @param {string} key
     * @param {*} value
     * @returns {boolean} True if successful, false otherwise.
     */
    setSessionItem(key, value) {
        try {
            const serializedValue = JSON.stringify(value);
            sessionStorage.setItem(this.prefix + key, serializedValue);
            return true;
        } catch (error) {
            console.error('Failed to save to sessionStorage:', error);
            return false;
        }
    }
    
    /**
     * Retrieves a value from sessionStorage by key, or returns defaultValue if not found or error.
     * @param {string} key
     * @param {*} defaultValue
     * @returns {*} The stored value or defaultValue.
     */
    getSessionItem(key, defaultValue = null) {
        try {
            const item = sessionStorage.getItem(this.prefix + key);
            if (item === null) {
                return defaultValue;
            }
            return JSON.parse(item);
        } catch (error) {
            console.error('Failed to read from sessionStorage:', error);
            return defaultValue;
        }
    }
    
    /**
     * Removes a value from sessionStorage by key.
     * @param {string} key
     * @returns {boolean} True if successful, false otherwise.
     */
    removeSessionItem(key) {
        try {
            sessionStorage.removeItem(this.prefix + key);
            return true;
        } catch (error) {
            console.error('Failed to remove from sessionStorage:', error);
            return false;
        }
    }
    
    /**
     * Clears all keys in sessionStorage with the service prefix.
     * @returns {boolean} True if successful, false otherwise.
     */
    clearSession() {
        try {
            const keys = Object.keys(sessionStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    sessionStorage.removeItem(key);
                }
            });
            return true;
        } catch (error) {
            console.error('Failed to clear sessionStorage:', error);
            return false;
        }
    }
    
    // ===== User Preferences =====

    /**
     * Stores user preferences (theme, language, etc.).
     * @param {Object} preferences
     * @returns {boolean}
     */
    setUserPreferences(preferences) {
        return this.setItem('user_preferences', preferences);
    }
    
    /**
     * Retrieves user preferences, or returns defaults if not set.
     * @returns {Object}
     */
    getUserPreferences() {
        return this.getItem('user_preferences', {
            theme: 'dark',
            language: 'en',
            volume: 1,
            autoPlay: false,
            notifications: true
        });
    }
    
    // ===== Recent Stations =====

    /**
     * Adds a station to the recent stations list (max 10, most recent first).
     * @param {Object} station
     */
    addRecentStation(station) {
        const recentStations = this.getRecentStations();
        const maxRecent = 10;
        
        // Remove if already exists
        const filtered = recentStations.filter(s => s.id !== station.id);
        
        // Add to beginning
        filtered.unshift({
            id: station.id,
            name: station.name,
            country: station.country,
            timestamp: Date.now()
        });
        
        // Keep only the most recent
        const limited = filtered.slice(0, maxRecent);
        
        this.setItem('recent_stations', limited);
    }
    
    /**
     * Retrieves the list of recent stations.
     * @returns {Array}
     */
    getRecentStations() {
        return this.getItem('recent_stations', []);
    }
    
    /**
     * Clears the recent stations list.
     * @returns {boolean}
     */
    clearRecentStations() {
        return this.removeItem('recent_stations');
    }
    
    // ===== Search History =====

    /**
     * Adds a search query to the search history (max 20, most recent first).
     * @param {string} query
     */
    addSearchQuery(query) {
        if (!query || query.trim().length === 0) return;
        
        const searchHistory = this.getSearchHistory();
        const maxHistory = 20;
        
        // Remove if already exists
        const filtered = searchHistory.filter(q => q !== query.trim());
        
        // Add to beginning
        filtered.unshift(query.trim());
        
        // Keep only the most recent
        const limited = filtered.slice(0, maxHistory);
        
        this.setItem('search_history', limited);
    }
    
    /**
     * Retrieves the search history.
     * @returns {Array}
     */
    getSearchHistory() {
        return this.getItem('search_history', []);
    }
    
    /**
     * Clears the search history.
     * @returns {boolean}
     */
    clearSearchHistory() {
        return this.removeItem('search_history');
    }
    
    // ===== Map Settings =====

    /**
     * Stores map settings (zoom, center, etc.).
     * @param {Object} settings
     * @returns {boolean}
     */
    setMapSettings(settings) {
        return this.setItem('map_settings', settings);
    }
    
    /**
     * Retrieves map settings, or returns defaults if not set.
     * @returns {Object}
     */
    getMapSettings() {
        return this.getItem('map_settings', {
            zoom: 10,
            center: { lat: 0, lng: 0 },
            clustering: true,
            showLabels: true
        });
    }
    
    // ===== Filters =====

    /**
     * Stores active filters (genre, country, etc.).
     * @param {Object} filters
     * @returns {boolean}
     */
    setActiveFilters(filters) {
        return this.setItem('active_filters', filters);
    }
    
    /**
     * Retrieves active filters, or returns defaults if not set.
     * @returns {Object}
     */
    getActiveFilters() {
        return this.getItem('active_filters', {
            genre: [],
            country: [],
            language: [],
            mood: []
        });
    }
    
    // ===== Cache Management =====

    /**
     * Stores a cache item with a TTL (time-to-live, ms).
     * @param {string} key
     * @param {*} value
     * @param {number} ttl - Time to live in ms (default 1 hour)
     * @returns {boolean}
     */
    setCacheItem(key, value, ttl = 3600000) { // Default 1 hour TTL
        const cacheItem = {
            value: value,
            timestamp: Date.now(),
            ttl: ttl
        };
        return this.setItem(`cache_${key}`, cacheItem);
    }
    
    /**
     * Retrieves a cache item if not expired, or null if expired/missing.
     * @param {string} key
     * @returns {*} The cached value or null.
     */
    getCacheItem(key) {
        const cacheItem = this.getItem(`cache_${key}`);
        if (!cacheItem) return null;
        
        const now = Date.now();
        const isExpired = (now - cacheItem.timestamp) > cacheItem.ttl;
        
        if (isExpired) {
            this.removeItem(`cache_${key}`);
            return null;
        }
        
        return cacheItem.value;
    }
    
    /**
     * Clears all cache items from localStorage.
     * @returns {boolean}
     */
    clearCache() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix + 'cache_')) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (error) {
            console.error('Failed to clear cache:', error);
            return false;
        }
    }
    
    // ===== Utility Methods =====

    /**
     * Checks if a key exists in localStorage.
     * @param {string} key
     * @returns {boolean}
     */
    hasItem(key) {
        return localStorage.getItem(this.prefix + key) !== null;
    }
    
    /**
     * Calculates the total size (in characters) of all stored values with the prefix.
     * @returns {number}
     */
    getSize() {
        try {
            let size = 0;
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    size += localStorage.getItem(key).length;
                }
            });
            return size;
        } catch (error) {
            console.error('Failed to calculate storage size:', error);
            return 0;
        }
    }
    
    /**
     * Returns all keys in localStorage with the prefix, with prefix removed.
     * @returns {Array<string>}
     */
    getKeys() {
        try {
            const keys = Object.keys(localStorage);
            return keys
                .filter(key => key.startsWith(this.prefix))
                .map(key => key.replace(this.prefix, ''));
        } catch (error) {
            console.error('Failed to get storage keys:', error);
            return [];
        }
    }
} 