// ===== PLAYLIST MODEL =====
//
// This model manages playlist data for the Terratune app.
// It acts as the data layer for playlists, handling API calls via ApiService,
// storing the current list of playlists, and providing utility methods for filtering, searching,
// and statistics.
//
// Main responsibilities:
// - Fetch, create, and update playlists via the backend API
// - Store and provide access to the current user's playlists
// - Support adding stations to playlists
// - Provide utility methods for filtering, searching, and statistics
//
// This model does NOT handle any UI logic; it is used by controllers and views.

export class PlaylistModel {
    /**
     * Constructor for PlaylistModel.
     * @param {ApiService} apiService - The service for backend API calls.
     */
    constructor(apiService) {
        this.apiService = apiService;
        this.playlists = [];
        this.currentPlaylist = null;
    }
    
    /**
     * Fetches the user's playlists from the backend and updates the local list.
     * @returns {Promise<Array>} The updated playlists array
     */
    async fetchPlaylists() {
        try {
            const data = await this.apiService.getPlaylists();
            this.playlists = data.items || [];
            return this.playlists;
        } catch (error) {
            console.error('Failed to get playlists:', error);
            throw error;
        }
    }
    
    /**
     * Creates a new playlist via the backend API and adds it to the local list.
     * @param {string} name - Playlist name
     * @param {string} description - Playlist description (optional)
     * @param {boolean} isPublic - Whether the playlist is public
     * @returns {Promise<Object>} The created playlist object
     */
    async createPlaylist(name, description = '', isPublic = true) {
        try {
            const playlist = await this.apiService.createPlaylist(name, description, isPublic);
            this.playlists.unshift(playlist);
            return playlist;
        } catch (error) {
            console.error('Failed to create playlist:', error);
            throw error;
        }
    }
    
    /**
     * Adds a station to a playlist via the backend API and refreshes the local playlist data.
     * @param {string} playlistId - The ID of the playlist
     * @param {string} stationId - The ID of the station to add
     */
    async addStationToPlaylist(playlistId, stationId) {
        try {
            await this.apiService.addStationToPlaylist(playlistId, stationId);
            // Update local playlist data
            const playlist = this.playlists.find(p => p.id === playlistId);
            if (playlist) {
                // Refresh playlist data
                await this.fetchPlaylists();
            }
        } catch (error) {
            console.error('Failed to add station to playlist:', error);
            throw error;
        }
    }
    
    /**
     * Returns the current list of playlists (local cache).
     * @returns {Array} Playlists
     */
    getLocalPlaylists() {
        return this.playlists;
    }
    
    /**
     * Finds and returns a playlist by its ID.
     * @param {string} id - Playlist ID
     * @returns {Object|null} Playlist object or null
     */
    getPlaylistById(id) {
        return this.playlists.find(playlist => playlist.id === id);
    }
    
    /**
     * Sets the current playlist (for details view, etc.).
     * @param {Object} playlist - The playlist object to set as current
     */
    setCurrentPlaylist(playlist) {
        this.currentPlaylist = playlist;
    }
    
    /**
     * Returns the currently selected playlist.
     * @returns {Object|null} The current playlist
     */
    getCurrentPlaylist() {
        return this.currentPlaylist;
    }
    
    // ===== Utility methods =====
    /**
     * Returns all public playlists.
     * @returns {Array} Public playlists
     */
    getPublicPlaylists() {
        return this.playlists.filter(playlist => playlist.is_public);
    }
    
    /**
     * Returns all private playlists.
     * @returns {Array} Private playlists
     */
    getPrivatePlaylists() {
        return this.playlists.filter(playlist => !playlist.is_public);
    }
    
    /**
     * Returns playlists owned by a specific user.
     * @param {string} ownerId - The user ID
     * @returns {Array} Playlists owned by the user
     */
    getPlaylistsByOwner(ownerId) {
        return this.playlists.filter(playlist => playlist.user_id === ownerId);
    }
    
    /**
     * Searches playlists by name or description.
     * @param {string} query - The search query
     * @returns {Array} Matching playlists
     */
    searchPlaylists(query) {
        if (!query || query.trim() === '') {
            return this.playlists;
        }
        
        const searchTerm = query.toLowerCase();
        return this.playlists.filter(playlist => 
            playlist.name.toLowerCase().includes(searchTerm) ||
            playlist.description?.toLowerCase().includes(searchTerm)
        );
    }
    
    // ===== Statistics =====
    /**
     * Returns the total number of playlists.
     * @returns {number} Playlist count
     */
    getPlaylistCount() {
        return this.playlists.length;
    }
    
    /**
     * Returns the total number of stations in all playlists.
     * @returns {number} Total stations
     */
    getTotalStationsInPlaylists() {
        return this.playlists.reduce((total, playlist) => {
            return total + (playlist.stations?.length || 0);
        }, 0);
    }
    
    /**
     * Returns the average number of stations per playlist.
     * @returns {number} Average stations per playlist
     */
    getAverageStationsPerPlaylist() {
        const count = this.getPlaylistCount();
        if (count === 0) return 0;
        return this.getTotalStationsInPlaylists() / count;
    }
    
    /**
     * Svuota la lista locale delle playlist (usato su logout)
     */
    clearPlaylists() {
        this.playlists = [];
        this.currentPlaylist = null;
    }
} 