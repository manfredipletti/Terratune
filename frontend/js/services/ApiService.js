// ===== API SERVICE =====
//
// This service provides a unified interface for all API calls to the Terratune backend.
// It handles authentication, request formatting, error handling, and exposes methods for
// all main backend resources (stations, tags, user, playlists, authentication, etc.).
//
// Main responsibilities:
// - Handle HTTP requests (GET, POST, PUT, DELETE) with proper headers and error handling
// - Manage authentication tokens and include them in requests as needed
// - Provide high-level methods for all backend endpoints (stations, tags, user, playlists, etc.)
// - Abstract away fetch logic and response parsing for the rest of the app
//
// This service does NOT handle any UI logic; it is used by models and controllers.

export class ApiService {
    /**
     * Constructor for ApiService.
     * @param {string} baseUrl - The base URL for the backend API.
     * @param {StorageService} storageService - The service for local storage management.
     */
    constructor(baseUrl, storageService) {
        this.baseUrl = baseUrl;
        this.storageService = storageService;
    }

    /**
     * Generic request method for all HTTP verbs.
     * Adds auth headers if token is present and handles JSON parsing/errors.
     * @param {string} endpoint - API endpoint (relative to baseUrl)
     * @param {Object} options - Fetch options (method, headers, body, etc.)
     * @returns {Promise<Object>} Parsed JSON response
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        // Add authorization header if token is present
        const token = this.storageService.getItem('authToken');
        if (token) {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            };
        }

        // Set JSON content-type header if sending a body
        if (options.body && !options.headers?.['Content-Type']) {
            options.headers = {
                ...options.headers,
                'Content-Type': 'application/json'
            };
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Request failed with status ' + response.status }));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            console.error(`API request to ${endpoint} failed:`, error);
            throw error;
        }
    }

    // ===== Helper methods for common HTTP verbs =====
    /**
     * Sends a GET request to the given endpoint.
     */
    get(endpoint) {
        return this.request(endpoint);
    }

    /**
     * Sends a POST request to the given endpoint with a JSON body.
     */
    post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    /**
     * Sends a PUT request to the given endpoint with a JSON body.
     */
    put(endpoint, body) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    /**
     * Sends a DELETE request to the given endpoint.
     */
    delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }

    /**
     * Tests the API connection by fetching tag categories.
     * @returns {Promise<Object>} Tag categories response
     */
    async testConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/tags/categories`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.warn('API connection test failed:', error);
            throw error;
        }
    }
    
    /**
     * Fetches clustered stations for the map view.
     * @param {Object} params - Query parameters (bounds, zoom, filters)
     * @returns {Promise<Object>} Clustered stations response
     */
    async getClusteredStations(params) {
        const queryString = new URLSearchParams(params).toString();
        const response = await fetch(`${this.baseUrl}/stations/clustered?${queryString}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }
    
    /**
     * Fetches all stations with optional filters.
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Stations response
     */
    async getStations(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const response = await fetch(`${this.baseUrl}/stations?${queryString}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }
    
    /**
     * Fetches all tag categories.
     * @returns {Promise<Object>} Tag categories response
     */
    async getTagCategories() {
        const response = await fetch(`${this.baseUrl}/tags/categories`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }
    
    /**
     * Fetches all tags for a given category.
     * @param {string} category - Tag category
     * @returns {Promise<Object>} Tags response
     */
    async getTags(category) {
        const response = await fetch(`${this.baseUrl}/tags/${category}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }
    
    /**
     * Authenticates a user and stores the access token.
     * @param {string} username
     * @param {string} password
     * @returns {Promise<Object>} Login response
     */
    async login(username, password) {
        const response = await fetch(`${this.baseUrl}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        this.storageService.setItem('authToken', data.access_token);
        
        return data;
    }
    
    /**
     * Registers a new user.
     * @param {string} username
     * @param {string} password
     * @returns {Promise<Object>} Registration response
     */
    async register(username, password) {
        const response = await fetch(`${this.baseUrl}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }
    
    /**
     * Fetches the current user's profile.
     * @returns {Promise<Object>} User profile
     */
    async getProfile() {
        if (!this.storageService.getItem('authToken')) {
            throw new Error('No authentication token');
        }
        
        const response = await fetch(`${this.baseUrl}/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${this.storageService.getItem('authToken')}`,
            },
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }
    
    /**
     * Fetches the user's favorite stations.
     * @returns {Promise<Object>} Favorites response
     */
    async getFavorites() {
        if (!this.storageService.getItem('authToken')) {
            throw new Error('No authentication token');
        }
        
        const response = await fetch(`${this.baseUrl}/user/favorites`, {
            headers: {
                'Authorization': `Bearer ${this.storageService.getItem('authToken')}`,
            },
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }
    
    /**
     * Adds a station to the user's favorites.
     * @param {string} stationId - The ID of the station to add
     * @returns {Promise<Object>} API response
     */
    async addToFavorites(stationId) {
        if (!this.storageService.getItem('authToken')) {
            throw new Error('No authentication token');
        }
        
        const response = await fetch(`${this.baseUrl}/user/favorites`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.storageService.getItem('authToken')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ station_id: stationId }),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }
    
    /**
     * Removes a station from the user's favorites.
     * @param {string} stationId - The ID of the station to remove
     * @returns {Promise<Object>} API response
     */
    async removeFromFavorites(stationId) {
        if (!this.storageService.getItem('authToken')) {
            throw new Error('No authentication token');
        }
        
        const response = await fetch(`${this.baseUrl}/user/favorites/${stationId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.storageService.getItem('authToken')}`,
            },
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }
    
    /**
     * Adds a station to the user's listening history.
     * @param {string} stationId - The ID of the station to add
     * @returns {Promise<Object>} API response
     */
    async addToHistory(stationId) {
        if (!this.storageService.getItem('authToken')) {
            throw new Error('No authentication token');
        }
        
        const response = await fetch(`${this.baseUrl}/user/history`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.storageService.getItem('authToken')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ station_id: stationId }),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }
    
    /**
     * Fetches the user's listening history.
     * @param {Object} params - Query parameters (optional)
     * @returns {Promise<Object>} History response
     */
    async getHistory(params = {}) {
        if (!this.storageService.getItem('authToken')) {
            throw new Error('No authentication token');
        }
        
        const queryString = new URLSearchParams(params).toString();
        const response = await fetch(`${this.baseUrl}/user/history?${queryString}`, {
            headers: {
                'Authorization': `Bearer ${this.storageService.getItem('authToken')}`,
            },
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }
    
    /**
     * Fetches the user's playlists.
     * @returns {Promise<Object>} Playlists response
     */
    async getPlaylists() {
        if (!this.storageService.getItem('authToken')) {
            throw new Error('No authentication token');
        }
        
        const response = await fetch(`${this.baseUrl}/user/playlists`, {
            headers: {
                'Authorization': `Bearer ${this.storageService.getItem('authToken')}`,
            },
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }
    
    /**
     * Creates a new playlist for the user.
     * @param {string} name - Playlist name
     * @param {string} description - Playlist description (optional)
     * @param {boolean} isPublic - Whether the playlist is public
     * @returns {Promise<Object>} Created playlist
     */
    async createPlaylist(name, description = '', isPublic = true) {
        if (!this.storageService.getItem('authToken')) {
            throw new Error('No authentication token');
        }
        
        const response = await fetch(`${this.baseUrl}/playlists`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.storageService.getItem('authToken')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, description, is_public: isPublic }),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }
    
    /**
     * Adds a station to a playlist.
     * @param {string} playlistId - The ID of the playlist
     * @param {string} stationId - The ID of the station to add
     * @returns {Promise<Object>} API response
     */
    async addStationToPlaylist(playlistId, stationId) {
        if (!this.storageService.getItem('authToken')) {
            throw new Error('No authentication token');
        }
        
        const response = await fetch(`${this.baseUrl}/playlists/${playlistId}/stations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.storageService.getItem('authToken')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ station_id: stationId }),
        });
        
        if (!response.ok) {
            // Try to extract error message from response
            let errorMessage = `HTTP error! status: ${response.status}`;
            
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorMessage;
            } catch (parseError) {
                // If we can't parse the error response, keep the generic error message
            }
            
            throw new Error(errorMessage);
        }
        
        return await response.json();
    }
    
    /**
     * Logs out the user by removing the auth token from storage.
     */
    logout() {
        this.storageService.removeItem('authToken');
    }
    
    /**
     * Returns whether the user is authenticated (token present).
     * @returns {boolean}
     */
    isAuthenticated() {
        return !!this.storageService.getItem('authToken');
    }
    
    /**
     * Fetches a single station by ID.
     * @param {string} stationId - The ID of the station
     * @returns {Promise<Object>} Station object
     */
    async getStation(stationId) {
        const response = await fetch(`${this.baseUrl}/stations/${stationId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }

    /**
     * Deletes a playlist by ID.
     * @param {string|number} playlistId - The ID of the playlist to delete
     * @returns {Promise<void>}
     */
    async deletePlaylist(playlistId) {
        if (!this.storageService.getItem('authToken')) {
            throw new Error('No authentication token');
        }
        const response = await fetch(`${this.baseUrl}/playlists/${playlistId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.storageService.getItem('authToken')}`,
            },
        });
        if (!response.ok && response.status !== 204) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    }

    /**
     * Updates a playlist by ID.
     * @param {string|number} playlistId - The ID of the playlist to update
     * @param {Object} data - The updated playlist data (name, description, is_public)
     * @returns {Promise<Object>} The updated playlist object
     */
    async updatePlaylist(playlistId, data) {
        if (!this.storageService.getItem('authToken')) {
            throw new Error('No authentication token');
        }
        const response = await fetch(`${this.baseUrl}/playlists/${playlistId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.storageService.getItem('authToken')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    /**
     * Removes a station from a playlist.
     * @param {string|number} playlistId - The ID of the playlist
     * @param {string|number} stationId - The ID of the station to remove
     * @returns {Promise<void>}
     */
    async removeStationFromPlaylist(playlistId, stationId) {
        if (!this.storageService.getItem('authToken')) {
            throw new Error('No authentication token');
        }
        const response = await fetch(`${this.baseUrl}/playlists/${playlistId}/stations/${stationId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.storageService.getItem('authToken')}`,
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    }

    /**
     * Fetches a single playlist by ID (public or owned).
     * @param {string|number} playlistId
     * @returns {Promise<Object>} Playlist object
     */
    async getPlaylistById(playlistId) {
        const response = await fetch(`${this.baseUrl}/playlists/${playlistId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    /**
     * Fetches popular stations ordered by favorite count.
     * @param {Object} params - Query parameters (page, per_page)
     * @returns {Promise<Object>} Popular stations response
     */
    async getPopularStations(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.get(`/stations/popular?${queryString}`);
    }

    /**
     * Fetches popular playlists ordered by follower count.
     * @param {Object} params - Query parameters (page, per_page)
     * @returns {Promise<Object>} Popular playlists response
     */
    async getPopularPlaylists(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.get(`/playlists/popular?${queryString}`);
    }

    /**
     * Follows a playlist.
     * @param {number} playlistId - The playlist ID to follow
     * @returns {Promise<Object>} Follow response
     */
    async followPlaylist(playlistId) {
        return this.post(`/playlists/${playlistId}/follow`, {});
    }

    /**
     * Unfollows a playlist.
     * @param {number} playlistId - The playlist ID to unfollow
     * @returns {Promise<Object>} Unfollow response
     */
    async unfollowPlaylist(playlistId) {
        return this.post(`/playlists/${playlistId}/unfollow`, {});
    }

    /**
     * Fetches playlists followed by the current user.
     * @returns {Promise<Array>} Followed playlists
     */
    async getFollowedPlaylists() {
        return this.get('/user/followed_playlists');
    }
} 