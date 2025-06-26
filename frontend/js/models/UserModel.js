// ===== USER MODEL =====
//
// This model manages user data, authentication, and preferences for the Terratune app.
// It acts as the data layer for user state, handling API calls via ApiService,
// storing authentication state, favorites, history, and playlists, and providing utility methods
// for user actions and preferences.
//
// Main responsibilities:
// - Handle user authentication (login, register, logout)
// - Store and provide access to user profile, favorites, history, and playlists
// - Support adding/removing favorites, managing history, and playlist actions
// - Manage user preferences via StorageService
//
// This model does NOT handle any UI logic; it is used by controllers and views.

export class UserModel {
    /**
     * Constructor for UserModel.
     * @param {ApiService} apiService - The service for backend API calls.
     * @param {StorageService} storageService - The service for local storage management.
     * @param {NotificationService} notificationService - The service for user notifications.
     */
    constructor(apiService, storageService, notificationService) {
        this.apiService = apiService;
        this.storageService = storageService;
        this.notificationService = notificationService;
        this.user = null;
        this.isAuthenticated = false;
        this.favorites = [];
        this.history = [];
        this.playlists = [];
        
        this.init();
    }
    
    /**
     * Initializes the user model by checking authentication and loading user profile if needed.
     */
    async init() {
        // Check if user is already authenticated
        if (this.apiService.isAuthenticated()) {
            try {
                await this.loadUserProfile();
                this.isAuthenticated = true;
            } catch (error) {
                console.warn('Failed to load user profile:', error);
                this.isAuthenticated = false;
            }
        }
    }

    setAuthenticated(isAuthenticated) {
        this.isAuthenticated = isAuthenticated;
    }


    /**
     * Loads the user profile and related data (favorites, history, playlists).
     * @returns {Promise<void>}
     */
    async loadUserProfile() {
        try {
            this.user = await this.apiService.getProfile();
            await this.loadFavorites();
            await this.loadHistory();
            await this.loadPlaylists();
        } catch (error) {
            console.error('Failed to load user profile:', error);
            throw error;
        }
    }
    
    /**
     * Loads the user's favorite stations from the backend.
     * @returns {Promise<void>}
     */
    async loadFavorites() {
        if (!this.storageService.getItem('authToken')) return;
        try {
            this.favorites = await this.apiService.getFavorites();
            // In the future, could emit an event here to notify the UI
        } catch (error) {
            console.error("Failed to load favorites:", error);
            this.notificationService.showError("Could not load your favorite stations.");
        }
    }
    
    /**
     * Loads the user's listening history from the backend.
     * @returns {Promise<void>}
     */
    async loadHistory() {
        try {
            const data = await this.apiService.getHistory();
            this.history = data.items || [];
        } catch (error) {
            console.error('Failed to load history:', error);
            this.history = [];
        }
    }
    
    /**
     * Loads the user's playlists from the backend.
     * @returns {Promise<void>}
     */
    async loadPlaylists() {
        try {
            const data = await this.apiService.getPlaylists();
            this.playlists = data.items || [];
        } catch (error) {
            console.error('Failed to load playlists:', error);
            this.playlists = [];
        }
    }
    
    /**
     * Adds a station to the user's favorites and reloads the favorites list.
     * Dispatches a 'favoritesChanged' event and shows a notification.
     * @param {string} stationId - The ID of the station to add
     */
    async addFavorite(stationId) {
        try {
            await this.apiService.addToFavorites(stationId);
            await this.loadFavorites(); // Reload to get updated list
            document.dispatchEvent(new CustomEvent('favoritesChanged')); // Notify listeners
            this.notificationService.showSuccess("Added to favorites!");
        } catch (error) {
            console.error("Failed to add favorite:", error);
            this.notificationService.showError("Could not add to favorites.");
        }
    }
    
    /**
     * Removes a station from the user's favorites and reloads the favorites list.
     * Dispatches a 'favoritesChanged' event and shows a notification.
     * @param {string} stationId - The ID of the station to remove
     */
    async removeFavorite(stationId) {
        try {
            await this.apiService.removeFromFavorites(stationId);
            await this.loadFavorites(); // Reload to get updated list
            document.dispatchEvent(new CustomEvent('favoritesChanged')); // Notify listeners
            this.notificationService.showSuccess("Removed from favorites.");
        } catch (error) {
            console.error("Failed to remove favorite:", error);
            this.notificationService.showError("Could not remove from favorites.");
        }
    }
    
    /**
     * Adds a station to the user's listening history and reloads the history list.
     * @param {string} stationId - The ID of the station to add
     */
    async addToHistory(stationId) {
        try {
            await this.apiService.addToHistory(stationId);
            await this.loadHistory();
        } catch (error) {
            console.error('Failed to add to history:', error);
            throw error;
        }
    }
    
    /**
     * Creates a new playlist for the user and reloads the playlists list.
     * @param {string} name - Playlist name
     * @param {string} description - Playlist description (optional)
     * @param {boolean} isPublic - Whether the playlist is public
     * @returns {Promise<Object>} The created playlist object
     */
    async createPlaylist(name, description = '', isPublic = true) {
        try {
            const playlist = await this.apiService.createPlaylist(name, description, isPublic);
            await this.loadPlaylists();
            return playlist;
        } catch (error) {
            console.error('Failed to create playlist:', error);
            throw error;
        }
    }
    
    /**
     * Adds a station to a playlist for the user.
     * @param {string} playlistId - The ID of the playlist
     * @param {string} stationId - The ID of the station to add
     */
    async addStationToPlaylist(playlistId, stationId) {
        try {
            await this.apiService.addStationToPlaylist(playlistId, stationId);
        } catch (error) {
            console.error('Failed to add station to playlist:', error);
            throw error;
        }
    }
    
    // ===== Getters =====
    /**
     * Returns the current user profile object.
     * @returns {Object|null} User profile
     */
    getUser() {
        return this.user;
    }
    
    /**
     * Returns the user's favorite stations.
     * @returns {Array} Favorite stations
     */
    getFavorites() {
        return this.favorites;
    }
    
    /**
     * Returns the user's listening history.
     * @returns {Array} Listening history
     */
    getHistory() {
        return this.history;
    }
    
    /**
     * Returns the user's playlists.
     * @returns {Array} Playlists
     */
    getPlaylists() {
        return this.playlists;
    }
    
    /**
     * Finds and returns a favorite station by its ID.
     * @param {string} stationId - Station ID
     * @returns {Object|null} Favorite station or null
     */
    getFavoriteById(stationId) {
        return this.favorites.find(station => station.id === stationId);
    }
    
    /**
     * Returns whether the user is currently logged in.
     * @returns {boolean}
     */
    isLoggedIn() {
        return this.isAuthenticated;
    }
    
    // ===== Utility methods =====
    /**
     * Checks if a station is in the user's favorites.
     * @param {string} stationId - Station ID
     * @returns {boolean}
     */
    isFavorite(stationId) {
        if (!this.favorites || this.favorites.length === 0) {
            return false;
        }
        return this.favorites.some(station => station.id === stationId);
    }
    
    /**
     * Returns the most recent stations from the user's history.
     * @param {number} limit - Maximum number of stations to return (default 10)
     * @returns {Array} Recent stations
     */
    getRecentStations(limit = 10) {
        return this.history
            .slice(0, limit)
            .map(item => item.station);
    }
    
    /**
     * Finds and returns a playlist by its ID.
     * @param {string} id - Playlist ID
     * @returns {Object|null} Playlist object or null
     */
    getPlaylistById(id) {
        return this.playlists.find(playlist => playlist.id === id);
    }
    
    // ===== User preferences =====
    /**
     * Returns the user's preferences from storage.
     * @returns {Object} User preferences
     */
    getUserPreferences() {
        return this.storageService.getUserPreferences();
    }
    
    /**
     * Sets the user's preferences in storage.
     * @param {Object} preferences - Preferences object
     * @returns {Object} Updated preferences
     */
    setUserPreferences(preferences) {
        return this.storageService.setUserPreferences(preferences);
    }
    
    /**
     * Updates a single user preference and saves it to storage.
     * @param {string} key - Preference key
     * @param {any} value - Preference value
     * @returns {Object} Updated preferences
     */
    updatePreference(key, value) {
        const preferences = this.getUserPreferences();
        preferences[key] = value;
        return this.setUserPreferences(preferences);
    }

    setLoggedOut() {
        this.user = null;
        this.isAuthenticated = false;
        this.favorites = [];
        this.history = [];
        this.playlists = [];
    }
} 