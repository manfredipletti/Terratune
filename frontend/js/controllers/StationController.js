// ===== STATION CONTROLLER =====
//
// This controller manages the logic for radio station playback and player controls in the Terratune app.
// It coordinates between the PlayerView (UI), StationModel (station data), UserModel (user/favorites),
// AudioService (audio playback), InfoView (station info panel), NotificationService (user feedback),
// and optionally InfoController (for showing station details).
//
// Main responsibilities:
// - Handle station selection, playback, and player controls (play, pause, next, previous, volume, mute)
// - Manage playback history and navigation
// - Manage favorites (add/remove, update UI)
// - Coordinate with InfoView/InfoController for station details
// - Provide utility methods for searching/filtering stations and playlist integration
//
// This controller does NOT handle direct DOM manipulation; all UI updates are delegated to PlayerView/InfoView.

export class StationController {
    /**
     * Constructor for StationController.
     * @param {PlayerView} playerView - The view responsible for rendering the player UI.
     * @param {StationModel} stationModel - The model for accessing station data.
     * @param {UserModel} userModel - The model for user authentication and favorites.
     * @param {AudioService} audioService - The service for audio playback.
     * @param {InfoView} infoView - The view for displaying station info.
     * @param {NotificationService} notificationService - The service for user notifications.
     */
    constructor(playerView, stationModel, userModel, audioService, infoView, notificationService) {
        this.playerView = playerView;
        this.stationModel = stationModel;
        this.userModel = userModel;
        this.audioService = audioService;
        this.infoView = infoView;
        this.notificationService = notificationService;
        this.infoController = null;
        
        this.currentStation = null;
        this.stationHistory = [];
        this.stationIndex = -1;
        this.previousVolume = 1.0; // Store volume before muting
        
        this.init();
    }
    
    /**
     * Initializes the controller and sets up event listeners for player controls and favorites.
     */
    init() {
        this.setupEventListeners();
        this.syncMuteState(); // Synchronize mute state between AudioService and PlayerView
        console.log('Station controller initialized');
    }
    
    /**
     * Sets up event listeners for player UI controls and favorite actions.
     */
    setupEventListeners() {
        this.playerView.onPlayPauseClick(() => this.togglePlayPause());
        this.playerView.onVolumeChange((volume) => this.setVolume(volume));
        this.playerView.onMuteToggle((isMuted) => this.toggleMute(isMuted));
        this.playerView.onInfoClick(() => this.showCurrentStationInfo());
        
        // Add listeners for favorite buttons in both player and info panel
        this.playerView.onFavoriteClick(() => this.toggleFavorite());
        this.infoView.onFavoriteClick(() => this.toggleFavorite());
    }
    
    /**
     * Plays the given station, updates history, and handles audio playback.
     * @param {Object} station - The station object to play
     */
    async playStation(station) {
        try {
            if (!station || !station.url) {
                throw new Error('Invalid station or missing URL');
            }
            
            // Add to history
            this.addToHistory(station);
            
            // Update current station
            this.currentStation = station;
            this.playerView.setStation(station);
            
            // Play audio
            await this.audioService.playStation(station);
            
            // Update favorite status
            this.updateFavoriteStatus(station.id);
            
            console.log(`🎵 Now playing: ${station.name}`);
            
        } catch (error) {
            console.error('Failed to play station:', error);
            this.playerView.showError();
            throw error;
        }
    }
    
    /**
     * Selects a station for playback and updates the UI and info panel.
     * @param {Object} station - The selected station object
     */
    async selectStation(station) {
        console.log('Station selected:', station.name);
        this.stationModel.setCurrentStation(station);

        if (this.infoController) {
            this.infoController.showStationDetails(station);
        }

        this.playerView.updateStationInfo(station);
        this.updateFavoriteStatus(station.id);
        this.playCurrentStation();
    }
    
    /**
     * Plays the currently selected station (from StationModel).
     * Handles loading state and updates the player UI.
     */
    async playCurrentStation() {
        if (!this.stationModel.currentStation) {
            console.warn("Play request with no current station.");
            return;
        }

        const station = this.stationModel.currentStation;
        console.log(`Controller: Requesting playback for: ${station.name}`);
        
        this.playerView.setLoading();
        
        const success = await this.audioService.play(station);

        if (success) {
            this.playerView.setPlaying();
        } else {
            this.playerView.setStopped();
        }
    }
    
    /**
     * Toggles play/pause state for the current station.
     * Updates the player UI accordingly.
     */
    togglePlayPause() {
        // If no station is loaded, do nothing
        if (!this.stationModel.getCurrentStation()) {
            console.warn("Toggle play/pause clicked, but no station is loaded.");
            return;
        }

        const isPlaying = this.audioService.togglePlayPause();

        if (isPlaying) {
            this.playerView.setPlaying();
        } else {
            this.playerView.setPaused();
        }
    }
    
    /**
     * Plays the previous station in the playback history.
     */
    playPrevious() {
        if (this.stationHistory.length === 0) {
            return;
        }
        
        this.stationIndex = Math.max(0, this.stationIndex - 1);
        const station = this.stationHistory[this.stationIndex];
        
        if (station) {
            this.playStation(station);
        }
    }
    
    /**
     * Plays the next station in the playback history.
     */
    playNext() {
        if (this.stationHistory.length === 0) {
            return;
        }
        
        this.stationIndex = Math.min(this.stationHistory.length - 1, this.stationIndex + 1);
        const station = this.stationHistory[this.stationIndex];
        
        if (station) {
            this.playStation(station);
        }
    }
    
    /**
     * Toggles the favorite status of the current station for the user.
     * Updates the UI after the action.
     */
    async toggleFavorite() {
        const station = this.stationModel.getCurrentStation();
        if (!station) return;

        const isFavorite = this.userModel.isFavorite(station.id);
        if (isFavorite) {
            await this.userModel.removeFavorite(station.id);
        } else {
            await this.userModel.addFavorite(station.id);
        }
        
        // Update UI after the action
        this.updateFavoriteStatus(station.id);
    }
    
    /**
     * Toggles the mute state based on the current state or the provided parameter.
     * @param {boolean} [isMuted] - Optional mute state from PlayerView
     */
    toggleMute(isMuted) {
        // If isMuted parameter is provided, use it; otherwise toggle current state
        const shouldMute = isMuted !== undefined ? isMuted : !this.audioService.isMuted();
        
        if (shouldMute) {
            // Store current volume before muting
            this.previousVolume = this.audioService.getVolume();
            this.audioService.mute();
            // Set volume to 0 in UI
            this.playerView.setVolume(0);
        } else {
            this.audioService.unmute();
            // Restore previous volume
            const volumeToRestore = this.previousVolume || 1.0;
            this.audioService.setVolume(volumeToRestore);
            this.playerView.setVolume(volumeToRestore);
        }
    }
    
    /**
     * Sets the playback volume and updates the UI.
     * @param {number} volume - The new volume level (0-1)
     */
    setVolume(volume) {
        this.audioService.setVolume(volume);
        this.playerView.setVolume(volume);
    }
    
    /**
     * Synchronizes the mute state between AudioService and PlayerView.
     */
    syncMuteState() {
        // Check if AudioService is properly initialized
        if (!this.audioService || typeof this.audioService.isMuted !== 'function') {
            console.warn('AudioService not properly initialized, skipping mute state sync');
            return;
        }
        
        const audioServiceMuted = this.audioService.isMuted();
        const playerViewMuted = this.playerView.getMuteState();
        
        if (audioServiceMuted !== playerViewMuted) {
            // Update PlayerView to match AudioService
            if (audioServiceMuted) {
                this.playerView.isMuted = true;
                this.playerView.updateMuteButton();
            } else {
                this.playerView.isMuted = false;
                this.playerView.updateMuteButton();
            }
        }
    }
    
    // ===== History management =====
    /**
     * Adds a station to the playback history, ensuring uniqueness and max length.
     * @param {Object} station - The station to add to history
     */
    addToHistory(station) {
        // Remove if already exists
        this.stationHistory = this.stationHistory.filter(s => s.id !== station.id);
        
        // Add to beginning
        this.stationHistory.unshift(station);
        
        // Keep only last 50 stations
        if (this.stationHistory.length > 50) {
            this.stationHistory = this.stationHistory.slice(0, 50);
        }
        
        this.stationIndex = 0;
    }
    
    /**
     * Returns the playback history array.
     * @returns {Array} Playback history
     */
    getHistory() {
        return this.stationHistory;
    }
    
    /**
     * Clears the playback history.
     */
    clearHistory() {
        this.stationHistory = [];
        this.stationIndex = -1;
    }
    
    // ===== Favorites management =====
    /**
     * Adds the current station to the user's favorites (placeholder for coordination).
     */
    async addToFavorites() {
        if (!this.currentStation) {
            return;
        }
        
        // This will be coordinated with the user controller
        console.log('Adding to favorites:', this.currentStation.id);
    }
    
    /**
     * Removes the current station from the user's favorites (placeholder for coordination).
     */
    async removeFromFavorites() {
        if (!this.currentStation) {
            return;
        }
        
        // This will be coordinated with the user controller
        console.log('Removing from favorites:', this.currentStation.id);
    }
    
    /**
     * Checks if the current station is a favorite (placeholder for coordination).
     * @returns {boolean} True if favorite, false otherwise
     */
    isCurrentStationFavorite() {
        if (!this.currentStation) {
            return false;
        }
        
        // This will be coordinated with the user controller
        return false;
    }
    
    /**
     * Updates the favorite status in both the player and info views.
     * @param {string} stationId - The ID of the station to update
     */
    updateFavoriteStatus(stationId) {
        const isFavorite = this.userModel.isFavorite(stationId);
        this.playerView.setFavoriteStatus(isFavorite);
        this.infoView.setFavoriteStatus(isFavorite);
    }
    
    /**
     * Shows the info panel for the current station using InfoController.
     */
    showCurrentStationInfo() {
        if (this.stationModel.getCurrentStation()) {
            this.infoController.showStationDetails(this.stationModel.getCurrentStation());
        }
    }
    
    // ===== Public methods =====
    /**
     * Returns the currently selected station.
     * @returns {Object|null} The current station
     */
    getCurrentStation() {
        return this.currentStation;
    }
    
    /**
     * Returns whether audio is currently playing.
     * @returns {boolean}
     */
    isPlaying() {
        return this.audioService.isPlaying;
    }
    
    /**
     * Returns the current playback state from the audio service.
     * @returns {string}
     */
    getPlaybackState() {
        return this.audioService.getPlaybackState();
    }
    
    /**
     * Stops audio playback and updates the player UI.
     */
    stop() {
        this.audioService.stop();
        this.playerView.setPlayingState(false);
    }
    
    // ===== Utility methods =====
    /**
     * Finds and returns a station by ID.
     * @param {string} stationId - The ID of the station
     * @returns {Object|null} The station object
     */
    getStationInfo(stationId) {
        return this.stationModel.findStationById(stationId);
    }
    
    /**
     * Searches stations by query string.
     * @param {string} query - The search query
     * @returns {Array} Matching stations
     */
    searchStations(query) {
        return this.stationModel.searchStations(query);
    }
    
    /**
     * Filters stations by genre.
     * @param {string} genre - The genre to filter by
     * @returns {Array} Filtered stations
     */
    filterStationsByGenre(genre) {
        return this.stationModel.filterStationsByGenre(genre);
    }
    
    /**
     * Filters stations by country.
     * @param {string} country - The country to filter by
     * @returns {Array} Filtered stations
     */
    filterStationsByCountry(country) {
        return this.stationModel.filterStationsByCountry(country);
    }
    
    /**
     * Filters stations by language.
     * @param {string} language - The language to filter by
     * @returns {Array} Filtered stations
     */
    filterStationsByLanguage(language) {
        return this.stationModel.filterStationsByLanguage(language);
    }
    
    // ===== Playlist methods =====
    /**
     * Adds the current station to a playlist 
     * @param {string} playlistId - The ID of the playlist
     */
    async addToPlaylist(playlistId) {
        if (!this.currentStation) {
            return;
        }
        
        try {
            // This will be coordinated with the playlist controller
            console.log('Adding to playlist:', playlistId, this.currentStation.id);
        } catch (error) {
            console.error('Failed to add to playlist:', error);
            throw error;
        }
    }
    
    // ===== Statistics =====
    /**
     * Returns playback statistics for the current session.
     * @returns {Object} Playback stats
     */
    getPlaybackStats() {
        return {
            totalPlayed: this.stationHistory.length,
            currentStation: this.currentStation,
            isPlaying: this.isPlaying(),
            volume: this.audioService.getVolume(),
            isMuted: this.audioService.isMuted()
        };
    }

    /**
     * Sets the InfoController reference for showing station details.
     * @param {InfoController} controller
     */
    setInfoController(controller) {
        this.infoController = controller;
    }
} 