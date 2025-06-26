// ===== INFO VIEW =====
//
// This view manages the display and interaction of the side information panel in the Terratune UI.
// It handles showing/hiding the panel, rendering station details and lists, and wiring up user actions
// such as playing a station or toggling favorites.
//
// Main responsibilities:
// - Show/hide the info panel and handle UI transitions
// - Render details for a single station or a list of stations
// - Attach event listeners for play/favorite actions and panel controls
// - Provide callback hooks for controller logic
//
// This view is used by controllers to update the UI in response to user actions or app state changes.

export class InfoView {
    /**
     * Constructor for InfoView.
     * Initializes DOM references and sets up event listeners.
     */
    constructor() {
        this.panel = document.getElementById('info-panel');
        this.content = document.getElementById('info-content');
        this.closeBtn = document.getElementById('info-close');
        this.handle = document.getElementById('info-handle');
        
        this.stationClickCallback = null;
        this.favoriteClickCallback = null;
        this.addToPlaylistCallback = null;

        this.setupEventListeners();
    }

    /**
     * Sets up event listeners for panel close and handle buttons.
     */
    setupEventListeners() {
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.hide());
        }
        if (this.handle) {
            this.handle.addEventListener('click', () => this.show());
        }
    }

    /**
     * Registers a callback for when a station is clicked (e.g., play now).
     * @param {Function} callback
     */
    onStationClick(callback) {
        this.stationClickCallback = callback;
    }

    /**
     * Registers a callback for when the favorite button is clicked.
     * @param {Function} callback
     */
    onFavoriteClick(callback) {
        this.favoriteClickCallback = callback;
    }

    /**
     * Registers a callback for when a playlist is selected in the add-to-playlist modal.
     * @param {Function} callback - (playlistId, stationId)
     */
    onAddToPlaylist(callback) {
        this.addToPlaylistCallback = callback;
    }

    /**
     * Shows the info panel and hides the handle.
     */
    show() {
        console.log("[DEBUG] InfoView: show() called. Showing panel, hiding handle.");
        this.panel.classList.add('visible');
        if (this.handle) {
            this.handle.classList.add('hidden');
        }
    }

    /**
     * Hides the info panel and shows the handle.
     */
    hide() {
        console.log("[DEBUG] InfoView: hide() called. Hiding panel, showing handle.");
        this.panel.classList.remove('visible');
        if (this.handle) {
            this.handle.classList.remove('hidden');
        }
    }

    /**
     * Renders the details of a single station in the panel.
     * @param {Object} station - The station object to display.
     * @param {boolean} isFavorite - Whether the station is a favorite.
     * @param {Array} playlists - User's playlists for the add-to-playlist modal.
     */
    renderStationDetails(station, isFavorite, playlists = []) {
        if (!station) return;
        const contentHTML = this.createStationDetailsHTML(station);
        this.content.innerHTML = contentHTML;
        // Set favorite button state after HTML is created
        this.setFavoriteStatus(isFavorite);
        // Attach play button event listener
        this.attachPlayButtonListener();
        // Attach add-to-playlist button event listener
        this.attachAddToPlaylistButtonListener(playlists);
    }

    /**
     * Creates the HTML markup for station details, including add-to-playlist button.
     * @param {Object} station
     * @returns {string} HTML string
     */
    createStationDetailsHTML(station) {
        // Helper function to safely join arrays
        const safeJoin = (array, separator = ', ') => {
            return array && array.length > 0 ? array.map(item => item.name || item).join(separator) : 'N/A';
        };

        const faviconUrl = station.favicon || './assets/icons/favicon.svg';

        return `
            <div class="station-details-card">
                <div class="station-details-header">
                    <div class="station-details-favicon" style="background-image: url('${faviconUrl}')"></div>
                    <h3>${station.name || 'Unknown Station'}</h3>
                    <button class="action-btn favorite-btn" id="info-favorite-btn" title="Add to Favorites">
                        <svg viewBox="0 0 24 24" width="24" height="24">
                           <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3z" fill="none" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                </div>
                <p><strong>Country:</strong> ${station.country || 'N/A'}</p>
                <p><strong>Languages:</strong> ${safeJoin(station.langs)}</p>
                <p><strong>Genres:</strong> ${safeJoin(station.music_genres)}</p>
                <p><strong>Moods:</strong> ${safeJoin(station.moods)}</p>
                <p><strong>Topics:</strong> ${safeJoin(station.topics)}</p>
                <p><strong>Decades:</strong> ${safeJoin(station.decades)}</p>
                <button class="btn-primary play-now-btn" data-station-id="${station.id}">Play Now</button>
                <button class="btn-secondary add-to-playlist-btn only-logged" data-station-id="${station.id}" data-tooltip="You have to login to add to playlist">Add to Playlist</button>
            </div>
        `;
    }

    /**
     * Renders a list of stations for user selection.
     * @param {Array<Object>} stations - Array of station objects.
     */
    renderStationList(stations) {
        let stationListHTML = '<ul class="station-list">';
        stations.forEach(station => {
            const faviconUrl = station.favicon || './assets/icons/favicon.svg';
            stationListHTML += `
                <li class="station-list-item" data-station-id="${station.id}">
                    <div class="station-list-favicon" style="background-image: url('${faviconUrl}')"></div>
                    <span>${station.name}</span>
                </li>
            `;
        });
        stationListHTML += '</ul>';

        this.content.innerHTML = `
            <div class="station-list-container">
                <h4>Multiple Stations Here</h4>
                <p>Select a station to play:</p>
                ${stationListHTML}
            </div>
        `;
        this.attachListClickListeners();
        this.show();
    }
    
    /**
     * Attaches a click listener to the "Play Now" button in the station details.
     */
    attachPlayButtonListener() {
        const playBtn = this.content.querySelector('.play-now-btn');
        if (playBtn && this.stationClickCallback) {
            const stationId = playBtn.dataset.stationId;
            playBtn.addEventListener('click', () => {
                this.stationClickCallback(stationId);
            });
        }
    }

    /**
     * Attaches click listeners to each station in the station list.
     */
    attachListClickListeners() {
        const items = this.content.querySelectorAll('.station-list-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                const stationId = item.dataset.stationId;
                if (this.stationClickCallback) {
                    this.stationClickCallback(stationId);
                }
            });
        });
    }

    /**
     * Attaches a click listener to the favorite button in the station details.
     */
    attachFavoriteButtonListener() {
        const favBtn = this.content.querySelector('#info-favorite-btn');
        if (favBtn && this.favoriteClickCallback) {
            favBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.favoriteClickCallback();
            });
        }
    }

    /**
     * Sets the favorite button state (filled/empty) and tooltip.
     * @param {boolean} isFavorite
     */
    setFavoriteStatus(isFavorite) {
        const favBtn = this.content.querySelector('#info-favorite-btn');
        if (favBtn) {
            favBtn.classList.toggle('is-favorite', isFavorite);
            favBtn.title = isFavorite ? 'Remove from Favorites' : 'Add to Favorites';
        }
    }

    /**
     * Attaches a click listener to the add-to-playlist button and shows the modal.
     * @param {Function} onClick - Callback da chiamare quando si clicca il bottone
     */
    attachAddToPlaylistButtonListener(onClick) {
        const addBtn = this.content.querySelector('.add-to-playlist-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                if (typeof onClick === 'function') onClick();
            });
        }
    }

    /**
     * Shows a modal to select a playlist to add the station to.
     * @param {Array} playlists - User's playlists
     * @param {string} stationId - The station to add
     */
    showAddToPlaylistModal(playlists, stationId) {
        // Remove any existing modal
        let modal = document.getElementById('add-to-playlist-modal');
        if (modal) modal.remove();
        modal = document.createElement('div');
        modal.id = 'add-to-playlist-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h4>Scegli una playlist</h4>
                <select id="playlist-select">
                    <option value="" disabled selected>Select a playlist</option>
                    ${playlists.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
                <div class="modal-actions">
                    <button class="btn-primary confirm-add-to-playlist">Add</button>
                    <button class="btn-secondary cancel-add-to-playlist">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Close modal when clicking on overlay (outside modal content)
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Confirm
        modal.querySelector('.confirm-add-to-playlist').addEventListener('click', () => {
            const select = modal.querySelector('#playlist-select');
            const playlistId = select.value;
            if (playlistId && this.addToPlaylistCallback) {
                this.addToPlaylistCallback(playlistId, stationId);
            }
            modal.remove();
        });
        // Cancel
        modal.querySelector('.cancel-add-to-playlist').addEventListener('click', () => {
            modal.remove();
        });
    }
} 