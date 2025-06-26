// ===== AUDIO SERVICE =====
//
// This service manages audio playback using the HTML5 Audio API for Terratune.
// It abstracts all audio logic, including play, pause, stop, volume, mute, and error handling.
// It also tests stream URLs for availability and notifies the user of playback errors.
//
// Main responsibilities:
// - Provide a unified interface for playing radio streams
// - Handle switching, testing, and fallback between multiple stream URLs
// - Manage playback state, volume, mute, and current station
// - Notify the user of playback errors via NotificationService
//
// This service is used by controllers and views to control audio playback.

import { NotificationService } from './NotificationService.js';

export class AudioService {
    /**
     * Constructor for AudioService.
     * @param {NotificationService} notificationService - Service for showing user notifications.
     */
    constructor(notificationService) {
        this.audio = new Audio();
        this.audio.crossOrigin = "anonymous"; // Required for some stations
        this.notificationService = notificationService; // Store notification service instance
        this.currentUrl = null;
        this.testTimeout = null;
        this.currentStation = null;
        this.isPlaying = false;
        this.volume = 1;
        this.isMuted = false;
        
        this.init();
    }
    
    /**
     * Initializes the audio element and sets up event listeners for playback state.
     */
    init() {
        this.audio.volume = this.volume;
        
        // Event listeners for playback state
        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
        });
        
        this.audio.addEventListener('pause', () => {
            this.isPlaying = false;
        });
        
        this.audio.addEventListener('ended', () => {
            this.isPlaying = false;
        });
        
        this.audio.addEventListener('error', (e) => {
            console.error('Audio Service Error:', e);
        });
        
        this.audio.addEventListener('loadstart', () => {
            // Placeholder for loadstart event
        });
        
        this.audio.addEventListener('canplay', () => {
            // Placeholder for canplay event
        });
    }
    
    /**
     * Tests if a given audio stream URL is playable within a timeout.
     * @param {string} url - The stream URL to test.
     * @returns {Promise<string>} Resolves with the URL if playable, rejects otherwise.
     */
    _testUrl(url) {
        return new Promise((resolve, reject) => {
            if (!url) {
                return reject(new Error("URL is null or undefined"));
            }

            const audio = new Audio();
            audio.crossOrigin = "anonymous";

            const cleanup = () => {
                clearTimeout(timeoutId);
                audio.onerror = null;
                audio.oncanplay = null;
                audio.src = '';
                audio.load();
            };

            const timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error(`Timeout: Stream did not respond in 8 seconds.`));
            }, 8000);

            audio.onerror = (e) => {
                cleanup();
                const errorMsg = e.target.error ? e.target.error.message : 'Unknown audio error';
                reject(new Error(`Stream error: ${errorMsg}`));
            };

            audio.oncanplay = () => {
                cleanup();
                resolve(url);
            };

            audio.src = url;
            audio.load();
        });
    }
    
    /**
     * Attempts to play a station by testing both url_resolved and url fields.
     * Notifies the user if both fail.
     * @param {Object} station - The station object (must have url_resolved, url, name).
     * @returns {Promise<boolean>} True if playback started, false otherwise.
     */
    async play(station) {
        this.stop();
        console.log(`Attempting to play: ${station.name}`);

        try {
            console.log(`1. Testing url_resolved: ${station.url_resolved}`);
            const workingUrl = await this._testUrl(station.url_resolved);
            console.log(`Success! Playing: ${workingUrl}`);
            this.audio.src = workingUrl;
            this.currentUrl = workingUrl;
            this.audio.play();
            return true;
        } catch (error) {
            console.warn(`Failed url_resolved:`, error.message);
        }

        try {
            console.log(`2. Testing url: ${station.url}`);
            const workingUrl = await this._testUrl(station.url);
            console.log(`Success! Playing: ${workingUrl}`);
            this.audio.src = workingUrl;
            this.currentUrl = workingUrl;
            this.audio.play();
            return true;
        } catch (error) {
            console.error(`Failed url:`, error.message);
        }

        console.error(`Both URLs failed for station: ${station.name}`);
        this.notificationService.showError(`Could not play "${station.name}". Stream may be offline.`);
        return false;
    }
    
    /**
     * Pauses audio playback.
     */
    pause() {
        this.audio.pause();
    }
    
    /**
     * Stops audio playback and clears the audio source.
     */
    stop() {
        this.audio.pause();
        if (this.audio.src) {
            this.audio.src = "";
        }
        this.currentUrl = null;
    }
    
    /**
     * Sets the audio volume (0.0 to 1.0).
     * @param {number} volume - The desired volume level.
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.audio) {
            this.audio.volume = this.volume;
        }
    }
    
    /**
     * Gets the current volume level.
     * @returns {number} Volume (0.0 to 1.0)
     */
    getVolume() {
        return this.volume;
    }
    
    /**
     * Mutes the audio.
     */
    mute() {
        this.isMuted = true;
        if (this.audio) {
            this.audio.muted = true;
        }
    }
    
    /**
     * Unmutes the audio.
     */
    unmute() {
        this.isMuted = false;
        if (this.audio) {
            this.audio.muted = false;
        }
    }
    
    /**
     * Toggles mute state.
     */
    toggleMute() {
        if (this.isMuted) {
            this.unmute();
        } else {
            this.mute();
        }
    }
    
    /**
     * Returns whether the audio is currently muted.
     * @returns {boolean}
     */
    isMuted() {
        return this.isMuted;
    }
    
    /**
     * Gets the current station object.
     * @returns {Object|null} The current station or null.
     */
    getCurrentStation() {
        return this.currentStation;
    }
    
    /**
     * Gets the current playback state (isPlaying, currentStation, volume, isMuted).
     * @returns {Object}
     */
    getPlaybackState() {
        return {
            isPlaying: this.isPlaying,
            currentStation: this.currentStation,
            volume: this.volume,
            isMuted: this.isMuted
        };
    }
    
    /**
     * Gets the current playback time in seconds.
     * @returns {number}
     */
    getCurrentTime() {
        return this.audio.currentTime;
    }
    
    /**
     * Gets the duration of the current audio stream in seconds.
     * @returns {number}
     */
    getDuration() {
        return this.audio.duration;
    }

    /**
     * Loads a new audio source and resolves when ready to play.
     * @param {string} url - The audio stream URL.
     * @returns {Promise<void>}
     */
    load(url) {
        return new Promise((resolve, reject) => {
            if (!url) {
                return reject(new Error("Audio URL cannot be null or empty."));
            }
            
            if (this.currentUrl === url && !this.audio.paused) {
                return resolve(); // Already playing
            }

            this.audio.src = url;
            this.currentUrl = url;

            const onCanPlay = () => {
                cleanup();
                resolve();
            };

            const onError = () => {
                cleanup();
                const mediaError = this.audio.error;
                console.error(`Audio load error for ${url}`, mediaError);
                reject(new Error(`Error loading audio. Code: ${mediaError.code}, Message: ${mediaError.message}`));
            };

            const cleanup = () => {
                this.audio.removeEventListener('canplaythrough', onCanPlay);
                this.audio.removeEventListener('error', onError);
            };

            this.audio.addEventListener('canplaythrough', onCanPlay);
            this.audio.addEventListener('error', onError);

            this.audio.load();
        });
    }

    /**
     * Toggles between play and pause states.
     * @returns {boolean} True if now playing, false if paused.
     */
    togglePlayPause() {
        if (this.audio.paused) {
            if (this.currentUrl) {
                this.audio.play();
            }
        } else {
            this.audio.pause();
        }
        return !this.audio.paused;
    }

    /**
     * Returns whether audio is currently playing.
     * @returns {boolean}
     */
    isPlaying() {
        return !this.audio.paused;
    }
} 