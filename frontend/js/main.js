// ===== MAIN APPLICATION ENTRY POINT =====
//
// This is the main entry point for the Terratune frontend
// It imports all models, views, controllers, and services, initializes the app,
//
// Main responsibilities:
// - Import and instantiate all MVC modules and services
// - Wire up dependency injection between controllers and views/models
// - Initialize the application when the DOM is ready

// ===== MODULE IMPORTS =====
import { StationModel } from './models/StationModel.js';
import { UserModel } from './models/UserModel.js';
import { PlaylistModel } from './models/PlaylistModel.js';

import { MapView } from './views/MapView.js';
import { PlayerView } from './views/PlayerView.js';
import { SidebarView } from './views/SidebarView.js';
import { InfoView } from './views/InfoView.js';

import { MapController } from './controllers/MapController.js';
import { StationController } from './controllers/StationController.js';
import { UserController } from './controllers/UserController.js';
import { SidebarController } from './controllers/SidebarController.js';
import { InfoController } from './controllers/InfoController.js';

import { ApiService } from './services/ApiService.js';
import { AudioService } from './services/AudioService.js';
import { StorageService } from './services/StorageService.js';
import { NotificationService } from './services/NotificationService.js';

// ===== APPLICATION CLASS =====
/*
 Main application class for Terratune.
 */
class App {
    constructor() {
        // Set API URL based on environment (localhost vs production)
        const apiUrl = window.location.hostname === 'localhost'
            ? 'http://127.0.0.1:5001/api'
            : 'https://terratune-backend.onrender.com/api';
        this.config = {
            apiUrl: apiUrl
        };
    }

    /**
     * Initializes all services, models, views, controllers, and wires dependencies.
     * Shows the application UI after initialization.
     */
    async init() {
        console.log("Initializing Terratune App...");

        // --- Services ---
        const storageService = new StorageService();
        const apiService = new ApiService(this.config.apiUrl, storageService);
        const notificationService = new NotificationService();
        const audioService = new AudioService(notificationService);

        // --- Models ---
        const stationModel = new StationModel(apiService);
        const userModel = new UserModel(apiService, storageService, notificationService);
        const playlistModel = new PlaylistModel(apiService);

        // --- Views ---
        const mapView = new MapView();
        const infoView = new InfoView();
        const playerView = new PlayerView();
        const sidebarView = new SidebarView();

        // --- Controllers ---
        const sidebarController = new SidebarController(sidebarView, userModel, apiService, playlistModel);
        const stationController = new StationController(playerView, stationModel, userModel, audioService, infoView, notificationService);
        const infoController = new InfoController(infoView, stationModel, stationController, userModel, playlistModel, notificationService);
        const mapController = new MapController(mapView, stationModel);
        const userController = new UserController(userModel, apiService, storageService, notificationService);
        
        // --- Dependency Injection ---
        infoController.setSidebarController(sidebarController);
        infoController.setUserController(userController);
        userController.setPlaylistModel(playlistModel);
        userController.setSidebarController(sidebarController);
        mapController.setStationController(stationController);
        mapController.setInfoController(infoController);
        sidebarController.setMapController(mapController);
        sidebarController.setStationController(stationController);
        sidebarController.setInfoController(infoController);
        sidebarController.setUserController(userController);
        
        // --- Final Initialization ---
        await Promise.all([
            mapController.init(),
            sidebarController.init()
        ]);
        // Handle ?playlist=ID link
        const urlParams = new URLSearchParams(window.location.search);
        const playlistId = urlParams.get('playlist');
        if (playlistId) {
            try {
                // Try to fetch the playlist (public or owned)
                const playlist = await playlistModel.apiService.getPlaylistById(playlistId);
                if (playlist && (playlist.is_public || (userModel.isLoggedIn() && playlist.user_id === userModel.getProfile()?.id))) {
                    sidebarController.openPublicPlaylistsTab();
                    sidebarController.showPopularPlaylistDetails(playlist);
                } else {
                    alert('Playlist not found or not public.');
                }
            } catch (err) {
                alert('Playlist not found or not public.');
            }
        }
        this.showApplication();

        console.log("App initialized successfully!");
    }

    /**
     * Shows the main application UI and hides the loading screen.
     */
    showApplication() {
        const loadingScreen = document.getElementById('loading-screen');
        const appContainer = document.getElementById('app');

        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
        if (appContainer) {
            appContainer.classList.remove('hidden');
        }
    }
}

// ===== APP INSTANCE =====
let app;

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app = new App();
    app.init();
    
    window.terratuneApp = app;
});

// ===== GLOBAL ERROR HANDLING =====
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});
