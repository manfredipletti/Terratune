// ===== SIDEBAR CONTROLLER =====
//
// This controller manages the logic for the sidebar in the Terratune app.
// It coordinates filters, favorites, and playlists, acting as the bridge between the SidebarView (UI),
// UserModel (user data), ApiService (backend API), PlaylistModel (playlist data),
// and other controllers (e.g., MapController, StationController).
//
// Main responsibilities:
// - Handle tab switching (filters, favorites, playlists)
// - Load and render filters, favorites, and playlists
// - Manage filter application and reset
// - Handle favorite station playback, removal, and map navigation
// - Setup and manage the create playlist modal
// - Listen for user and UI events to keep the sidebar in sync
//
// This controller does NOT handle direct DOM manipulation except for event listeners and modal triggers.
// All UI rendering is delegated to SidebarView.

export class SidebarController {
    /**
     * Constructor for SidebarController.
     * @param {SidebarView} sidebarView - The view responsible for rendering the sidebar UI.
     * @param {UserModel} userModel - The model for user authentication and favorites.
     * @param {ApiService} apiService - The service for backend API calls.
     * @param {PlaylistModel} playlistModel - The model for user playlists.
     */
    constructor(sidebarView, userModel, apiService, playlistModel) {
        this.sidebarView = sidebarView;
        this.userModel = userModel;
        this.apiService = apiService;
        this.playlistModel = playlistModel;
        this.mapController = null;
        this.stationController = null; // Used for station playback
        this.infoController = null; // Used for showing station details
        this.selectedFilters = {};
        this.popularPage = 1;
        this.popularPerPage = 20;
        this.popularTotalPages = 1;
        this.popularLoading = false;
        this._popularScrollHandlerAdded = false;
        this.popularPlaylistsPage = 1;
        this.popularPlaylistsPerPage = 10;
        this.popularPlaylistsTotalPages = 1;
        this.popularPlaylistsLoading = false;
        this._popularPlaylistsScrollHandlerAdded = false;
        this.showFollowedOnlyPublicPlaylists = false;

        // Listen for updates to favorites and refresh the sidebar if needed
        document.addEventListener('favoritesChanged', () => this.handleFavoritesChange());
    }

    /**
     * Sets the MapController reference for map navigation and filtering.
     * @param {MapController} controller
     */
    setMapController(controller) {
        this.mapController = controller;
    }

    /**
     * Sets the StationController reference for station playback.
     * @param {StationController} controller
     */
    setStationController(controller) {
        this.stationController = controller;
    }

    /**
     * Sets the InfoController reference for showing station details.
     * @param {InfoController} controller
     */
    setInfoController(controller) {
        this.infoController = controller;
    }

    setUserController(controller) {
        this.userController = controller;
    }

    /**
     * Initializes the sidebar controller and view, sets up event listeners and modals.
     * Loads filters and prepares the UI.
     */
    async init() {
        console.log('Initializing Sidebar controller...');
        this.sidebarView.setupTabSwitching((tabName) => this.handleTabSwitch(tabName));
        await this.loadAndRenderFilters();
        this.setupEventListeners();
        this.setupCreatePlaylistModal();
        console.log('Sidebar controller initialized');
    }
    
    /**
     * Handles switching between sidebar tabs (favorites, playlists, etc.).
     * Loads and renders the relevant content for the selected tab.
     * @param {string} tabName - The name of the selected tab
     */
    handleTabSwitch(tabName) {
        if (tabName === 'filters') {
            this.showFiltersTab();
            return;
        }
        if (tabName === 'favorites') {
            this.loadAndRenderFavorites();
        }
        if (tabName === 'playlists') {
            this.loadAndRenderPlaylists();
        }
        if (tabName === 'popular') {
            this.sidebarView.clearPopularList();
            this.popularPage = 1;
            this.popularTotalPages = 1;
            this._setupPopularScrollHandler();
            this.loadAndRenderPopular(true);
        }
        if (tabName === 'popular-playlists') {
            this.sidebarView.clearPopularPlaylistsList();
            this.popularPlaylistsPage = 1;
            this.popularPlaylistsTotalPages = 1;
            this._setupPopularPlaylistsScrollHandler();
            this.loadAndRenderPopularPlaylists(true);
        }
    }

    /**
     * Handles updates to the favorites list (e.g., when a favorite is added/removed).
     * If the favorites tab is active, reloads the list to reflect changes.
     */
    handleFavoritesChange() {
        console.log("SidebarController: Detected a change in favorites.");
        // If the favorites tab is active, reload the list
        const activeTab = this.sidebarView.sidebar.querySelector('.filter-tab.active');
        if (activeTab && activeTab.dataset.tab === 'favorites') {
            console.log("Favorites tab is active, reloading list.");
            this.loadAndRenderFavorites();
        }
    }

    /**
     * Loads and renders the user's favorite stations in the sidebar.
     * Sets up callbacks for playback, removal, and map navigation.
     */
    async loadAndRenderFavorites() {
        const favorites = this.userModel.getFavorites();
        this.sidebarView.populateFavorites(
            favorites, 
            (stationId) => this.playFavorite(stationId),
            (stationId) => this.removeFavorite(stationId),
            (station) => this.goToStationOnMap(station),
            (station) => this.showStationInfo(station)
        );
    }
    
    /**
     * Handles playback of a favorite station from the sidebar.
     * Fetches the full station object and triggers playback via StationController.
     * @param {string} stationId - The ID of the station to play
     */
    async playFavorite(stationId) {
        if (!this.stationController) {
            console.error("StationController not set in SidebarController");
            return;
        }
        
        try {
            // Get the full station object to pass to selectStation
            const station = await this.userModel.getFavoriteById(stationId); 
            if (station) {
                console.log(`Playing station ${station.name} from favorites.`);
                this.stationController.selectStation(station, true);
            }
        } catch (error) {
            console.error(`Could not play favorite station ${stationId}:`, error);
        }
    }

    /**
     * Handles removal of a favorite station from the sidebar.
     * Shows a confirmation dialog and removes the station if confirmed.
     * @param {string} stationId - The ID of the station to remove
     */
    removeFavorite(stationId) {
        this.sidebarView.showDeletionConfirmation(stationId, async (confirmedStationId) => {
            console.log(`Removing station ${confirmedStationId} from favorites.`);
            await this.userModel.removeFavorite(confirmedStationId);
            // The list will update automatically via the 'userFavoritesChanged' event
        });
    }

    /**
     * Handles navigation to a station's location on the map from the sidebar.
     * @param {Object} station - The station object to fly to
     */
    goToStationOnMap(station) {
        if (this.mapController) {
            this.mapController.flyToStation(station);
        } else {
            console.error("MapController not set in SidebarController");
        }
    }

    /**
     * Loads and renders available filter categories and tags from the backend.
     * Handles errors gracefully and renders empty categories if needed.
     */
    async loadAndRenderFilters() {
        try {
            // First, get available categories
            const categories = await this.apiService.getTagCategories();
            
            // Then, get tags for each category
            const filters = {};
            for (const category of categories) {
                try {
                    const tags = await this.apiService.getTags(category);
                    filters[category] = tags;
                } catch (error) {
                    console.warn(`Failed to load tags for category ${category}:`, error);
                    filters[category] = [];
                }
            }
            
            this.sidebarView.renderFilters(filters, this.selectedFilters);
        } catch (error) {
            console.error("Failed to load filters:", error);
        }
    }

    /**
     * Applies the currently selected filters to the map.
     * Updates the selectedFilters state and triggers filtering in MapController.
     */
    applyFilters() {
        this.selectedFilters = this.sidebarView.getSelectedFilters();
        // Mappa le chiavi UI ai parametri API
        const FILTER_KEY_MAP = {
            'Music Genre': 'genre',
            'Lang': 'lang',
            'Mood': 'mood'
        };
        const mappedFilters = {};
        Object.keys(this.selectedFilters).forEach(key => {
            const apiKey = FILTER_KEY_MAP[key] || key;
            mappedFilters[apiKey] = this.selectedFilters[key];
        });
        if (this.mapController) {
            this.mapController.applyFilters(mappedFilters);
        }
    }

    /**
     * Resets all filters in the sidebar and on the map.
     * Clears selectedFilters and resets the UI.
     */
    resetFilters() {
        this.selectedFilters = {};
        this.sidebarView.resetFiltersUI();
        if (this.mapController) {
            this.mapController.resetStationFilters();
        }
    }

    /**
     * Sets up event listeners for filter apply/reset buttons in the sidebar.
     */
    setupEventListeners() {
        const applyBtn = document.getElementById('apply-filters');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.applyFilters());
        }

        const resetBtn = document.getElementById('reset-filters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetFilters());
        }
    }

    /**
     * Loads and renders the user's playlists in the sidebar.
     * Fetches playlists from the model and updates the view.
     */
    async loadAndRenderPlaylists() {
        // Se l'utente non è loggato, mostra solo il messaggio vuoto
        if (!this.userModel.isLoggedIn()) {
            this.clearPlaylists();
            return;
        }
        await this.playlistModel.fetchPlaylists();
        const playlists = this.playlistModel.getLocalPlaylists();
        this.sidebarView.renderPlaylists(
            playlists,
            async (playlist) => { // onDelete
                try {
                    await this.playlistModel.apiService.deletePlaylist(playlist.id);
                    await this.loadAndRenderPlaylists();
                } catch (err) {
                    alert('Error deleting playlist');
                }
            },
            async (playlist, updatedData) => { // onEdit
                try {
                    await this.playlistModel.apiService.updatePlaylist(playlist.id, updatedData);
                    await this.loadAndRenderPlaylists();
                } catch (err) {
                    alert('Error updating playlist');
                }
            },
            (playlist) => { // onCardClick
                this.showPlaylistDetails(playlist);
            }
        );
    }

    /**
     * Shows the detailed view for a playlist and wires up actions.
     * @param {Object} playlist - The playlist object
     */
    showPlaylistDetails(playlist) {
        this.sidebarView.renderPlaylistDetails(
            playlist,
            async (station, playlistObj) => { // onRemoveStation
                try {
                    await this.playlistModel.apiService.removeStationFromPlaylist(playlistObj.id, station.id);
                    // Reload playlist details after removal
                    const updated = await this.playlistModel.apiService.getPlaylists();
                    const updatedPlaylist = (updated.items || []).find(p => p.id === playlistObj.id);
                    this.showPlaylistDetails(updatedPlaylist || playlistObj);
                } catch (err) {
                    alert('Error removing station from playlist');
                }
            },
            () => { // onBack
                this.loadAndRenderPlaylists();
            },
            (station) => { // onPlayStation
                if (this.stationController) {
                    this.stationController.selectStation(station);
                }
            },
            (station) => { // onGoToMap
                if (this.mapController) {
                    this.mapController.flyToStation(station);
                }
            }
        );
    }

    /**
     * Sets up the create playlist modal: open, close, and submit handlers.
     * Handles form submission and playlist creation logic.
     */
    setupCreatePlaylistModal() {
        // Show modal on button click
        const btn = document.getElementById('create-playlist');
        if (btn) {
            btn.addEventListener('click', () => {
                this.sidebarView.resetCreatePlaylistForm();
                this.sidebarView.showCreatePlaylistModal();
            });
        }
        // Close modal on .modal-close click
        document.querySelectorAll('#create-playlist-modal .modal-close').forEach(el => {
            el.addEventListener('click', () => {
                this.sidebarView.hideCreatePlaylistModal();
            });
        });
        // Handle form submission
        const form = document.getElementById('create-playlist-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = form['playlist-name'].value.trim();
                const description = form['playlist-description'].value.trim();
                const isPublic = form['playlist-public'].checked;
                if (!name) return;
                try {
                    await this.playlistModel.createPlaylist(name, description, isPublic);
                    this.sidebarView.hideCreatePlaylistModal();
                    this.loadAndRenderPlaylists();
                } catch (err) {
                    alert('Error creating playlist');
                }
            });
        }
    }

    /**
     * Opens the My Playlists tab in the sidebar.
     */
    openPlaylistsTab() {
        if (this.sidebarView && typeof this.sidebarView.showPlaylistsTab === 'function') {
            this.sidebarView.showPlaylistsTab();
        }
    }

    /**
     * Opens the Public Playlists tab in the sidebar.
     */
    openPublicPlaylistsTab() {
        if (this.sidebarView && typeof this.sidebarView.showPopularPlaylistsTab === 'function') {
            this.sidebarView.showPopularPlaylistsTab();
        }
    }

    /**
     * Svuota la lista delle playlist nella sidebar.
     */
    clearPlaylists() {
        const container = document.getElementById('playlists-list');
        if (container) {
            container.innerHTML = '<p class="no-playlists">No playlists yet. Create one!</p>';
        }
    }

    /**
     * Svuota la lista dei preferiti nella sidebar.
     */
    clearFavorites() {
        const container = document.getElementById('favorites-list-container');
        if (container) {
            container.innerHTML = '<p class="no-favorites">No favorite stations yet. Add some!</p>';
        }
    }

    _setupPopularScrollHandler() {
        // const container = document.getElementById('popular-list-container');
        const container = document.getElementById('popular-panel');
        if (!container || this._popularScrollHandlerAdded) return;
        container.addEventListener('scroll', () => {
            if (this.popularLoading) return;
            if (this.popularPage > this.popularTotalPages) return;
            if (container.scrollTop + container.clientHeight >= container.scrollHeight - 40) {
                this.loadAndRenderPopular(false, true);
            }
        });
        this._popularScrollHandlerAdded = true;
    }

    /**
     * Carica e mostra le stazioni popolari nella tab Popular.
     * @param {boolean} reset - Se true, resetta la lista (nuova tab o reload)
     * @param {boolean} append - Se true, aggiunge invece di sovrascrivere
     */
    async loadAndRenderPopular(reset = false, append = false) {
        if (this.popularLoading) return;
        
        this.popularLoading = true;
        
        if (reset) {
            this.popularPage = 1;
            this.sidebarView.clearPopularList();
        }
        
        try {
            this.sidebarView.showPopularLoader(true);
            
            const response = await this.apiService.getPopularStations({
                page: this.popularPage,
                per_page: this.popularPerPage
            });
            
            this.popularTotalPages = response.total_pages;
            
            this.sidebarView.renderPopularStations(
                response.items,
                response,
                append,
                (stationId) => this.playPopularStation(stationId),
                (station) => this.goToStationOnMap(station),
                (station) => this.showStationInfo(station)
            );
            
            this.popularPage++;
            
        } catch (error) {
            console.error('Failed to load popular stations:', error);
            this.sidebarView.showPopularLoader(false);
        } finally {
            this.popularLoading = false;
            this.sidebarView.showPopularLoader(false);
        }
    }

    /**
     * Handles playback of a popular station from the sidebar.
     * @param {string} stationId - The ID of the station to play
     */
    async playPopularStation(stationId) {
        if (!this.stationController) {
            console.error("StationController not set in SidebarController");
            return;
        }
        
        try {
            // Get the full station object from the API
            const station = await this.apiService.getStation(stationId);
            if (station) {
                console.log(`Playing popular station ${station.name}.`);
                this.stationController.selectStation(station, true);
            }
        } catch (error) {
            console.error(`Could not play popular station ${stationId}:`, error);
        }
    }

    /**
     * Loads and renders popular playlists with infinite scroll.
     * @param {boolean} reset - Whether to reset the list
     * @param {boolean} append - Whether to append to existing list
     */
    async loadAndRenderPopularPlaylists(reset = false, append = false) {
        if (this.popularPlaylistsLoading) return;
        this.popularPlaylistsLoading = true;
        if (reset) {
            this.popularPlaylistsPage = 1;
            this.sidebarView.clearPopularPlaylistsList();
        }
        try {
            this.sidebarView.showPopularPlaylistsLoader(true);
            const [response, followed] = await Promise.all([
                this.apiService.getPopularPlaylists({
                    page: this.popularPlaylistsPage,
                    per_page: this.popularPlaylistsPerPage
                }),
                this.userModel.isLoggedIn() ? this.apiService.getFollowedPlaylists() : []
            ]);
            this.popularPlaylistsTotalPages = response.total_pages;
            const followedIds = new Set((followed || []).map(p => p.id));
            let playlistsWithFollowing = response.items.map(playlist => ({
                ...playlist,
                is_following: followedIds.has(playlist.id)
            }));
            // Applica filtro solo seguite se attivo
            if (this.showFollowedOnlyPublicPlaylists) {
                playlistsWithFollowing = playlistsWithFollowing.filter(p => p.is_following);
            }
            this.sidebarView.renderPopularPlaylists(
                playlistsWithFollowing,
                response,
                append,
                (playlistId) => this.toggleFollowPlaylist(playlistId),
                (playlistId) => this.toggleFollowPlaylist(playlistId),
                (playlist) => this.showPopularPlaylistDetails(playlist),
                this.showFollowedOnlyPublicPlaylists,
                (val) => {
                    this.showFollowedOnlyPublicPlaylists = val;
                    this.loadAndRenderPopularPlaylists(true, false);
                }
            );

            if (this.userController && typeof this.userController.updateOnlyLoggedElements === 'function') {
                this.userController.updateOnlyLoggedElements();
            }
            this.popularPlaylistsPage++;
        } catch (error) {
            console.error('Failed to load popular playlists:', error);
            this.sidebarView.showPopularPlaylistsLoader(false);
        } finally {
            this.popularPlaylistsLoading = false;
            this.sidebarView.showPopularPlaylistsLoader(false);
        }
    }

    /**
     * Toggle follow/unfollow for a playlist, aggiorna la UI e lo stato locale.
     */
    async toggleFollowPlaylist(playlistId) {
        const container = document.getElementById('popular-playlists-panel');
        const card = container.querySelector(`[data-playlist-id="${playlistId}"]`);
        const followBtn = card?.querySelector('.follow-playlist-btn');
        const followerCountSpan = card?.querySelector('.follower-count');
        if (!card || !followBtn || !followerCountSpan) return;
        
        // Determina se sta seguendo basandosi sulla classe CSS
        const isCurrentlyFollowing = followBtn.classList.contains('following');
        
        try {
            let count = parseInt(followerCountSpan.textContent.replace(/\D/g, '')) || 0;
            
            if (!isCurrentlyFollowing) {
                // Follow
                await this.apiService.followPlaylist(playlistId);
                followBtn.textContent = '✓';
                followBtn.title = 'Unfollow';
                followBtn.classList.add('following');
                card.classList.add('following');
                followerCountSpan.textContent = `👥 ${count + 1}`;
            } else {
                // Unfollow
                await this.apiService.unfollowPlaylist(playlistId);
                followBtn.textContent = '❤️';
                followBtn.title = 'Follow';
                followBtn.classList.remove('following');
                card.classList.remove('following');
                followerCountSpan.textContent = `👥 ${Math.max(count - 1, 0)}`;
            }
        } catch (error) {
            console.error(`Failed to ${isCurrentlyFollowing ? 'unfollow' : 'follow'} playlist ${playlistId}:`, error);
        }
    }

    /**
     * Sets up infinite scroll for popular playlists.
     */
    _setupPopularPlaylistsScrollHandler() {
        if (this._popularPlaylistsScrollHandlerAdded) return;
        
        // const container = document.getElementById('popular-playlists-list-container');
        const container = document.getElementById('popular-playlists-panel');
        if (!container) return;
        
        container.addEventListener('scroll', () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            
            if (scrollTop + clientHeight >= scrollHeight - 100) {
                if (this.popularPlaylistsPage <= this.popularPlaylistsTotalPages && !this.popularPlaylistsLoading) {
                    this.loadAndRenderPopularPlaylists(false, true);
                }
            }
        });
        
        this._popularPlaylistsScrollHandlerAdded = true;
    }

    /**
     * Mostra i dettagli di una playlist popolare (con stazioni), come nella tab Playlists.
     */
    async showPopularPlaylistDetails(playlist) {
        try {
            // Ricarica i dettagli dal backend (così ho le stazioni)
            const full = await this.apiService.getPlaylistById(playlist.id);
            // Passa is_following dalla lista (playlist param) al dettaglio (full)
            full.is_following = playlist.is_following;
            full.follower_count = playlist.follower_count;
            // Mostra i dettagli nel pannello Popular Playlists
            this.sidebarView.renderPlaylistDetailsInPopular(
                full,
                () => this.loadAndRenderPopularPlaylists(true),
                (station) => this.stationController && this.stationController.selectStation(station),
                (playlistObj, followBtn) => this.toggleFollowInDetails(playlistObj, followBtn),
                (station) => this.mapController && this.mapController.flyToStation(station)
            );
            
            // Update only-logged elements after rendering
            if (this.userController && typeof this.userController.updateOnlyLoggedElements === 'function') {
                this.userController.updateOnlyLoggedElements();
            }
        } catch (err) {
            alert('Error loading playlist details');
        }
    }

    /**
     * Gestisce il toggle follow/unfollow dalla vista dettagliata, aggiornando cuore e contatore.
     */
    async toggleFollowInDetails(playlist, followBtn) {
        try {
            const isFollowing = !!playlist.is_following;
            let followerCount = parseInt(playlist.follower_count) || 0;
            
            if (!isFollowing) {
                // Follow
                await this.apiService.followPlaylist(playlist.id);
                followBtn.textContent = '✓';
                followBtn.title = 'Unfollow';
                followBtn.classList.add('following');
                playlist.is_following = true;
                followerCount++;
            } else {
                // Unfollow
                await this.apiService.unfollowPlaylist(playlist.id);
                followBtn.textContent = '❤️';
                followBtn.title = 'Follow';
                followBtn.classList.remove('following');
                playlist.is_following = false;
                followerCount = Math.max(followerCount - 1, 0);
            }
            
            playlist.follower_count = followerCount;
            
            // Aggiorna la card corrispondente nella lista
            const card = document.querySelector(`.popular-playlist-card[data-playlist-id="${playlist.id}"]`);
            if (card) {
                const listFollowBtn = card.querySelector('.follow-playlist-btn');
                const listCountSpan = card.querySelector('.follower-count');
                if (listFollowBtn) {
                    if (playlist.is_following) {
                        listFollowBtn.textContent = '✓';
                        listFollowBtn.title = 'Unfollow';
                        listFollowBtn.classList.add('following');
                    } else {
                        listFollowBtn.textContent = '❤️';
                        listFollowBtn.title = 'Follow';
                        listFollowBtn.classList.remove('following');
                    }
                }
                if (listCountSpan) {
                    listCountSpan.textContent = `👥 ${followerCount}`;
                }
            }
        } catch (error) {
            console.error('Error updating follow status:', error);
            alert('Error updating follow status');
        }
    }

    showFiltersTab() {
        if (this.sidebarView && typeof this.sidebarView.showFiltersTab === 'function') {
            this.sidebarView.showFiltersTab();
        }
    }

    clearPopularPlaylists() {
        this.showFollowedOnlyPublicPlaylists = false;
        this.sidebarView.clearPopularPlaylistsList();
    }

    showStationInfo(station) {
        if (this.infoController) {
            this.infoController.showStationDetails(station);
        }
    }
} 