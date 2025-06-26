// ===== INFO CONTROLLER =====
//
// This controller manages the logic for the information panel in the Terratune app.
// It acts as the intermediary between the InfoView (UI), the StationModel (data),
// the StationController (player logic), and the UserModel (user state).
//
// Main responsibilities:
// - Handle user interactions in the info panel (e.g., clicking "Play Now" or a station in the list)
// - Show station details or lists in the info panel
// - Determine favorite status and user login state for UI rendering
// - Ensure the info panel is shown/hidden as needed
//
// This controller does NOT handle direct DOM manipulation; it delegates UI updates to InfoView.

export class InfoController {
    /**
     * Constructor for InfoController.
     * @param {InfoView} infoView - The view responsible for rendering the info panel UI.
     * @param {StationModel} stationModel - The model for accessing station data.
     * @param {StationController} stationController - The controller for station playback logic.
     * @param {UserModel} userModel - The model for user authentication and favorites.
     * @param {PlaylistModel} playlistModel - The model for managing playlists.
     * @param {NotificationService} notificationService - The service for showing notifications.
     * @param {SidebarController} sidebarController - The controller for managing the sidebar.
     */
    constructor(infoView, stationModel, stationController, userModel, playlistModel, notificationService, sidebarController) {
        this.infoView = infoView;
        this.stationModel = stationModel;
        this.stationController = stationController;
        this.userModel = userModel; // Stores userModel for favorite/login checks
        this.playlistModel = playlistModel;
        this.notificationService = notificationService;
        this.sidebarController = sidebarController;
        this.userController = null; // Will be set via dependency injection
        
        this.init();
    }
    
    /**
     * Initializes the controller by setting up event listeners for the info panel.
     */
    init() {
        this.setupEventListeners();
    }

    /**
     * Sets up event listeners for user interactions in the info panel.
     * Handles clicks on "Play Now" or station list items, triggering playback via StationController.
     */
    setupEventListeners() {
        // Handles click on "Play Now" button or a station in the list
        this.infoView.onStationClick(async (stationId) => {
            const station = await this.stationModel.getStationById(stationId);
            if (station && this.stationController) {
                this.stationController.selectStation(station);
            }
        });
        // Add-to-playlist logic
        this.infoView.onAddToPlaylist(async (playlistId, stationId) => {
            try {
                await this.playlistModel.addStationToPlaylist(playlistId, stationId);
                this.notificationService.showSuccess('Stazione added to playlist!');
                // Optionally, update playlists in sidebar
                if (this.sidebarController) {
                    this.sidebarController.loadAndRenderPlaylists();
                }
            } catch (err) {
                this.notificationService.showError(err.message);
            }
        });
    }

    /**
     * Displays the details of a single station in the info panel.
     * Checks if the user is logged in and if the station is a favorite, then updates the view.
     * @param {Object} station - The station object to display.
     */
    async showStationDetails(station) {
        const isFavorite = this.userModel.isLoggedIn() && this.userModel.isFavorite(station.id);
        // Always fetch playlists before showing modal
        let playlists = [];
        if (this.userModel.isLoggedIn() && this.playlistModel) {
            playlists = await this.playlistModel.fetchPlaylists();
        }
        this.infoView.renderStationDetails(station, isFavorite, playlists);
        this.infoView.show();

        // Aggiorno il listener per il bottone Add to Playlist
        this.infoView.attachAddToPlaylistButtonListener(async () => {
            if (this.userModel.isLoggedIn() && this.playlistModel) {
                const updatedPlaylists = await this.playlistModel.fetchPlaylists();
                this.infoView.showAddToPlaylistModal(updatedPlaylists, station.id);
            }
        });
        // Update only-logged elements after rendering
        if (this.userController && typeof this.userController.updateOnlyLoggedElements === 'function') {
            this.userController.updateOnlyLoggedElements();
        }
    }
    
    /**
     * Displays a list of stations in the info panel.
     * Fetches station data by IDs and updates the view.
     * @param {Array} stationIds - Array of station IDs to display.
     */
    showStationList(stationIds) {
        this.stationModel.getStationsByIds(stationIds).then(stations => {
            this.infoView.renderStationList(stations);
            this.infoView.show(); // Ensure the info panel is visible
        });
    }

    /**
     * Sets the SidebarController reference after instantiation.
     * @param {SidebarController} sidebarController
     */
    setSidebarController(sidebarController) {
        this.sidebarController = sidebarController;
    }
    
    /**
     * Sets the UserController reference after instantiation.
     * @param {UserController} userController
     */
    setUserController(userController) {
        this.userController = userController;
    }
} 