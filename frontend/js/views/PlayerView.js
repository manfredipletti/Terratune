// ===== PLAYER VIEW =====
//
// This view manages the audio player interface in the Terratune UI.
// It handles DOM updates for playback state, station info, volume, and favorite status,
// and wires up user interactions (play/pause, volume, favorite, info) to controller callbacks.
//
// Main responsibilities:
// - Show current station info and cover art
// - Update play/pause/loading/error UI states
// - Handle volume and favorite controls
// - Provide callback hooks for controller logic
//
// This view is used by controllers to update the player UI and respond to user actions.

export class PlayerView {
    /**
     * Constructor for PlayerView.
     * Initializes DOM references and sets up event listeners.
     */
    constructor() {
        // DOM elements
        this.container = document.getElementById('player-container');
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.volumeSlider = document.getElementById('volume-slider');
        this.muteBtn = document.getElementById('mute-btn');
        this.nowPlayingTitle = document.getElementById('now-playing-title');
        this.nowPlayingLocation = document.getElementById('now-playing-location');
        this.stationCoverIcon = document.getElementById('station-cover-icon');
        this.infoBtn = document.getElementById('info-btn');
        this.favoriteBtn = document.getElementById('player-favorite-btn');

        // Event callbacks
        this.playPauseCallback = null;
        this.volumeChangeCallback = null;
        this.muteToggleCallback = null;
        this.favoriteClickCallback = null;

        // Mute state
        this.isMuted = false;
        this.previousVolume = 1.0;

        this.setupEventListeners();
    }

    /**
     * Sets up event listeners for play/pause, volume, and favorite controls.
     */
    setupEventListeners() {
        if (this.playPauseBtn) {
            this.playPauseBtn.addEventListener('click', () => {
                if (this.playPauseCallback) {
                    this.playPauseCallback();
                }
            });
        }

        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', (e) => {
                // If muted and user moves slider, unmute
                if (this.isMuted) {
                    this.isMuted = false;
                    this.updateMuteButton();
                    // Call mute callback to unmute in AudioService
                    if (this.muteToggleCallback) {
                        this.muteToggleCallback(false);
                    }
                }
                
                if (this.volumeChangeCallback) {
                    const volume = parseFloat(e.target.value) / 100;
                    this.volumeChangeCallback(volume);
                }
            });
        }

        if (this.muteBtn) {
            this.muteBtn.addEventListener('click', () => {
                this.toggleMute();
            });
        }

        if (this.favoriteBtn) {
            this.favoriteBtn.addEventListener('click', () => {
                if (this.favoriteClickCallback) {
                    this.favoriteClickCallback();
                }
            });
        }
    }

    // ===== Callback Registration Methods =====

    /**
     * Registers a callback for play/pause button clicks.
     * @param {Function} callback
     */
    onPlayPauseClick(callback) {
        this.playPauseCallback = callback;
    }

    /**
     * Registers a callback for volume slider changes.
     * @param {Function} callback
     */
    onVolumeChange(callback) {
        this.volumeChangeCallback = callback;
    }

    /**
     * Registers a callback for mute button clicks.
     * @param {Function} callback
     */
    onMuteToggle(callback) {
        this.muteToggleCallback = callback;
    }

    /**
     * Registers a callback for favorite button clicks.
     * @param {Function} callback
     */
    onFavoriteClick(callback) {
        this.favoriteClickCallback = callback;
    }

    /**
     * Registers a callback for info button clicks.
     * @param {Function} callback
     */
    onInfoClick(callback) {
        if (this.infoBtn) {
            this.infoBtn.addEventListener('click', callback);
        }
    }

    // ===== UI Update Methods =====

    /**
     * Updates the player UI with the current station's info.
     * @param {Object|null} station - The station object or null.
     */
    updateStationInfo(station) {
        this.container.classList.remove('error', 'loading');
        if (!station) {
            this.nowPlayingTitle.textContent = 'Select a station';
            this.nowPlayingLocation.textContent = 'No station selected';
            this.stationCoverIcon.innerHTML = '🎵';
            this.infoBtn.classList.add('hidden');
            this.favoriteBtn.classList.add('hidden');
            return;
        }
        this.nowPlayingTitle.textContent = station.name || 'Unknown Station';
        this.nowPlayingLocation.textContent = station.country || 'Unknown Location';
        this.stationCoverIcon.innerHTML = `<img src="${station.favicon || './assets/icons/favicon.svg'}" alt="Favicon">`;
        this.infoBtn.classList.remove('hidden');
        this.favoriteBtn.classList.remove('hidden');
    }

    /**
     * Sets the play/pause button to the "playing" state.
     */
    setPlaying() {
        this.playPauseBtn.innerHTML = `
            <svg id="pause-icon" viewBox="0 0 24 24" width="32" height="32">
                <path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>`;
    }

    /**
     * Sets the play/pause button to the "paused" state.
     */
    setPaused() {
        this.playPauseBtn.innerHTML = `
            <svg id="play-icon" viewBox="0 0 24 24" width="32" height="32">
                <path fill="currentColor" d="M8 5v14l11-7z"/>
            </svg>`;
    }

    /**
     * Sets the play/pause button to the "stopped" state.
     */
    setStopped() {
        this.playPauseBtn.innerHTML = `
            <svg id="play-icon" viewBox="0 0 24 24" width="32" height="32">
                <path fill="currentColor" d="M8 5v14l11-7z"/>
            </svg>`;
    }

    /**
     * Sets the play/pause button to a loading spinner.
     */
    setLoading() {
        // Use an SVG spinner icon for consistency
        this.playPauseBtn.innerHTML = `
            <svg class="spinner" viewBox="0 0 50 50" width="32" height="32">
                <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
            </svg>`;
    }

    /**
     * Shows or hides the loading state in the player UI.
     * @param {boolean} isLoading
     */
    showLoading(isLoading) {
        if (isLoading) {
            this.nowPlayingTitle.textContent = 'Loading...';
            this.container.classList.add('loading');
        } else {
            this.container.classList.remove('loading');
        }
    }

    /**
     * Shows an error message in the player UI.
     * @param {string} message
     */
    showError(message) {
        this.nowPlayingTitle.textContent = message;
        this.nowPlayingLocation.textContent = 'Please try another station.';
        this.container.classList.add('error');
        this.setPaused();
    }

    /**
     * Sets the favorite button state (filled/empty) and tooltip.
     * @param {boolean} isFavorite
     */
    setFavoriteStatus(isFavorite) {
        if (this.favoriteBtn) {
            this.favoriteBtn.classList.toggle('is-favorite', isFavorite);
            this.favoriteBtn.title = isFavorite ? 'Remove from Favorites' : 'Add to Favorites';
        }
    }

    /**
     * Toggles the mute state and updates the UI.
     */
    toggleMute() {
        this.isMuted = !this.isMuted;
        
        // Update UI
        this.updateMuteButton();
        
        // Call the callback if provided - let AudioService handle the actual mute/unmute
        if (this.muteToggleCallback) {
            this.muteToggleCallback(this.isMuted);
        }
    }

    /**
     * Updates the mute button icon and tooltip based on mute state.
     */
    updateMuteButton() {
        if (!this.muteBtn) return;
        
        if (this.isMuted) {
            // Muted icon
            this.muteBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="currentColor" d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>`;
            this.muteBtn.title = 'Unmute';
        } else {
            // Unmuted icon
            this.muteBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>`;
            this.muteBtn.title = 'Mute';
        }
    }

    /**
     * Sets the volume slider value and updates mute state if needed.
     * @param {number} volume - Volume level (0-1)
     */
    setVolume(volume) {
        if (this.volumeSlider) {
            this.volumeSlider.value = volume * 100;
            
            // If volume is 0, set as muted
            if (volume === 0 && !this.isMuted) {
                this.isMuted = true;
                this.updateMuteButton();
            } else if (volume > 0 && this.isMuted) {
                this.isMuted = false;
                this.updateMuteButton();
            }
        }
    }

    /**
     * Gets the current mute state.
     * @returns {boolean} True if muted, false otherwise
     */
    getMuteState() {
        return this.isMuted;
    }
} 