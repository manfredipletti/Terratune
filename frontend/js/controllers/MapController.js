// ===== MAP CONTROLLER =====
//
// This controller manages the logic for the interactive map and clustering in the Terratune app.
// It acts as the bridge between the MapView (UI rendering), StationModel (data),
// and other controllers (e.g., InfoController, StationController).
//
// Main responsibilities:
// - Handle map initialization, camera movement, and event listeners
// - Load and display clustered radio stations based on map view, filters, and search
// - Manage cluster explosion (showing individual stations in a cluster)
// - Handle user interactions with stations and clusters on the map
// - Coordinate with InfoController to show station details
// - Provide public methods for map navigation and settings

export class MapController {
    /**
     * Constructor for MapController.
     * @param {MapView} mapView - The view responsible for rendering the map and entities.
     * @param {StationModel} stationModel - The model for accessing station and cluster data.
     */
    constructor(mapView, stationModel) {
        this.mapView = mapView;
        this.stationModel = stationModel;
        
        this.stationController = null; // Will be set after initialization
        this.infoController = null; // Reference to InfoController for showing info panel

        this.currentBounds = null;
        this.currentZoom = 0;
        this.isLoading = false;
        this.searchQuery = '';
        this.activeFilters = {}; // Stores current sidebar/search filters
        this.explodedCluster = null; // Tracks currently exploded cluster

    }
    
    /**
     * Sets the StationController reference for playback control.
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

    /**
     * Initializes the map controller and view, sets up event listeners.
     * Handles async initialization and error reporting.
     */
    async init() {
        try {
            await this.mapView.initialize();
            this.setupEventListeners();
            console.log('Map controller initialized');
        } catch (error) {
            console.error('Failed to initialize map controller:', error);
            throw error;
        }
    }
    
    /**
     * Sets up event listeners for map interactions (entity clicks, camera movement).
     * Handles clicks on stations/clusters and camera movement events.
     */
    setupEventListeners() {
        this.mapView.onEntityClick((type, entity) => {
            if (type === 'station') {
                this.handleStationClick(entity);
            } else if (type === 'cluster') {
                this.handleClusterClick(entity);
            }
        });
        
        // Camera movement handler
        this.mapView.onCameraMove((bounds, zoom) => {
            if (this.explodedCluster) {
                this.clearExplodedCluster();
            }
            this.onCameraMove(bounds, zoom);
        });
    }
    
    /**
     * Called when the map camera moves (pan/zoom).
     * Updates bounds/zoom, refreshes zoom info, and loads stations for the new view.
     * @param {Object} bounds - Current map bounds
     * @param {number} zoom - Current zoom level
     */
    async onCameraMove(bounds, zoom) {
        this.currentBounds = bounds;
        this.currentZoom = zoom;
        
        // Update zoom info display
        this.updateZoomInfo(zoom);
        
        // Load stations for current view
        await this.loadStationsForView();
    }
    
    /**
     * Loads and displays clustered stations for the current map view and filters.
     * Handles loading state, error reporting, and updates the map.
     */
    async loadStationsForView() {
        if (!this.currentBounds || this.isLoading) {
            return;
        }
        
        try {
            this.isLoading = true;
            
            // Merge search and sidebar filters
            // const filters = {
            //     ...this.activeFilters,
            // };

            const data = await this.stationModel.getClusteredStations(
                this.currentBounds,
                this.currentZoom,
                this.activeFilters
            );
            
            this.displayStations(data);
            
        } catch (error) {
            console.error('Failed to load stations:', error);
            this.showError('Failed to load stations');
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * Renders clusters and stations on the map using MapView.
     * @param {Object} data - Clustered station data from the backend
     */
    displayStations(data) {
        // Clear existing stations
        this.mapView.clearAll();
        
        // Add clusters/stations to map
        data.items.forEach(item => {
            if (item.type === 'cluster') {
                this.mapView.addCluster(item);
            } else {
                // Single station
                if (item.stations && item.stations.length > 0) {
                    this.mapView.addStation(item.stations[0]);
                }
            }
        });
    }
    
    /**
     * Handles click on a cluster entity.
     * If stacked, explodes the cluster or zooms in; otherwise, zooms to the cluster location.
     * @param {Object} cluster - The clicked cluster entity
     */
    async handleClusterClick(cluster) {
        this.clearExplodedCluster(); // Deflate previous cluster

        const { isStacked, stationIds } = this.stationModel.getClusterDetails(cluster.id);

        if (isStacked) {
            const ZOOM_THRESHOLD_FOR_EXPLODE = 7; 
            if (this.currentZoom > ZOOM_THRESHOLD_FOR_EXPLODE) {
                console.log("High zoom on stacked cluster. Exploding...");
                this.explodeCluster(cluster, stationIds);
            } else {
                // Stacked cluster, but not zoomed in enough. Zoom closer.
                const currentHeight = this.mapView.getCameraPosition()?.height || 2000000;
                const targetHeight = currentHeight * 0.25; // Aggressive zoom (25% of height).
                
                console.log(`[DEBUG] STACKED CLUSTER CLICK (LOW ZOOM)`);
                console.log(` -> Current Height: ${Math.round(currentHeight)}m`);
                console.log(` -> Target Height:  ${Math.round(targetHeight)}m`);
                this.mapView.flyToLocation(cluster.lng, cluster.lat, targetHeight);
            }
        } else {
            // Geographic cluster, just zoom in.
            const currentHeight = this.mapView.getCameraPosition()?.height || 4000000;
            const targetHeight = currentHeight * 0.25; // Aggressive zoom (25% of height).

            console.log(`[DEBUG] GEOGRAPHIC CLUSTER CLICK`);
            console.log(` -> Current Height: ${Math.round(currentHeight)}m`);
            console.log(` -> Target Height:  ${Math.round(targetHeight)}m`);
            this.mapView.flyToLocation(cluster.lng, cluster.lat, targetHeight);
        }
    }

    /**
     * Handles click on a station entity.
     * Shows the info panel for the selected station (does NOT start playback).
     * @param {Object} station - The clicked station entity
     */
    async handleStationClick(station) {
        this.clearExplodedCluster(); // Deflate any exploded cluster

        console.log("Station entity clicked, showing info panel:", station);
        
        // Load complete station data before showing info panel
        try {
            const completeStation = await this.stationModel.getStationById(station.id);
            if (completeStation && this.infoController) {
                this.infoController.showStationDetails(completeStation);
            }
        } catch (error) {
            console.error("Error loading station details:", error);
            // TODO: handle with notification
            // Fallback to original station data if loading fails
            if (this.infoController) {
                this.infoController.showStationDetails(station);
            }
        }
    }
    
    
    
    /**
     * Returns the current filters (search and sidebar) for station loading/search.
     * @returns {Object} Current filters
     */
    getCurrentFilters() {
        // This will be coordinated with the sidebar controller
        return {
            search: this.searchQuery
        };
    }
    
    /**
     * Updates the zoom info display in the UI.
     * @param {number} zoom - Current zoom level
     */
    updateZoomInfo(zoom) {
        const zoomElement = document.getElementById('zoom-level');
        if (zoomElement) {
            zoomElement.textContent = `Zoom: ${zoom}`;
        }
    }

    /**
     * Shows an error message overlay on the map with a retry button.
     * @param {string} message - Error message to display
     */
    showError(message) {
        // Show error message
        const errorElement = document.createElement('div');
        errorElement.id = 'map-error';
        errorElement.className = 'map-error';
        errorElement.innerHTML = `
            <span>${message}</span>
            <button onclick="this.retryLoad()">Retry</button>
        `;
        
        const mapContainer = document.querySelector('.map-container');
        if (mapContainer) {
            mapContainer.appendChild(errorElement);
        }
    }
    
    /**
     * Removes the error overlay and retries loading stations for the current view.
     */
    retryLoad() {
        const errorElement = document.getElementById('map-error');
        if (errorElement) {
            errorElement.remove();
        }
        
        this.loadStationsForView();
    }
    
    // Public methods

    /**
     * Returns the current map bounds.
     * @returns {Object} Current bounds
     */
    getCurrentBounds() {
        return this.currentBounds;
    }
    
    /**
     * Returns the current map zoom level.
     * @returns {number} Current zoom
     */
    getCurrentZoom() {
        return this.mapView.getCameraZoom();
    }
    
    /**
     * Animates the map to fly to a specific station's location.
     * After flying, reloads stations for the new view.
     * @param {Object} station - The station to fly to
     */
    async flyToStation(station) {
        if (station && station.geo_lat && station.geo_long) {
            try {
                console.log(`Flying to station: ${station.name}`);
                await this.mapView.flyToLocation(station.geo_long, station.geo_lat, 500000);
                
                // After flight, force reload of stations
                console.log("Flight complete. Forcing station reload.");
                await this.loadStationsForView();

            } catch (error) {
                console.error("Error during flyToStation:", error);
            }
        } else {
            console.error("flyToStation called with invalid station data:", station);
        }
    }
    
    /**
     * Animates the map to fly to a specific latitude/longitude/height.
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {number} height - Camera height (default 100000)
     */
    flyToLocation(lat, lng, height = 100000) {
        this.mapView.flyToLocation(lat, lng, height);
    }
    
    /**
     * Applies map settings (labels, colors, etc.) from the settings panel.
     * @param {Object} settings - Map settings to apply
     */
    setMapSettings(settings) {
        // Apply map settings
        if (settings.showLabels !== undefined) {
            this.mapView.showLabels(settings.showLabels);
        }
        
        if (settings.stationColor) {
            this.mapView.setStationColor(settings.stationColor);
        }
        
        if (settings.clusterColor) {
            this.mapView.setClusterColor(settings.clusterColor);
        }
    }

    /**
     * Applies new filters (from sidebar, etc.) and reloads stations for the map view.
     * @param {Object} filters - New filters to apply
     */
    applyFilters(filters) {
        console.log('MapController: Applying new filters', filters);
        this.activeFilters = filters;
        this.loadStationsForView(); // Reload map with new filters
    }

    /**
     * Explodes a cluster to show individual stations around its center.
     * Temporarily hides the cluster and adds temporary station markers.
     * @param {Object} cluster - The cluster to explode
     * @param {Array} stationIds - IDs of stations in the cluster
     */
    async explodeCluster(cluster, stationIds) {
        const stationPromises = stationIds.map(id => this.stationModel.getStationById(id));
        const stations = (await Promise.all(stationPromises)).filter(Boolean);

        if (stations.length === 0) return;

        this.mapView.setEntityVisibility(cluster.id, false);

        const centerLng = cluster.lng;
        const centerLat = cluster.lat;
        const count = stations.length;
        const radius = 0.005 * Math.max(2, 10 / (this.currentZoom || 10));
        const duration = 400; // ms
        const startTime = performance.now();
        const entities = [];
        // Crea marker temporanei al centro
        stations.forEach((station) => {
            const entity = this.mapView.addTemporaryStation(station, centerLng, centerLat);
            entities.push(entity);
        });
        // Calcola le posizioni finali
        const finalPositions = stations.map((station, index) => {
            const angle = (index / count) * 2 * Math.PI;
            const lng = centerLng + radius * Math.cos(angle) / Math.cos(centerLat * Math.PI / 180);
            const lat = centerLat + radius * Math.sin(angle);
            return { lng, lat };
        });
        // Animazione
        function animate() {
            const now = performance.now();
            const t = Math.min(1, (now - startTime) / duration);
            entities.forEach((entity, i) => {
                if (!entity) return;
                const startLng = centerLng;
                const startLat = centerLat;
                const endLng = finalPositions[i].lng;
                const endLat = finalPositions[i].lat;
                const currLng = startLng + (endLng - startLng) * t;
                const currLat = startLat + (endLat - startLat) * t;
                entity.position = Cesium.Cartesian3.fromDegrees(currLng, currLat);
            });
            if (t < 1) {
                requestAnimationFrame(animate);
            }
        }
        animate();
        this.explodedCluster = {
            clusterId: cluster.id,
            stationIds: stationIds
        };
    }

    /**
     * Clears any exploded cluster, removing temporary stations and restoring the cluster marker.
     */
    clearExplodedCluster() {
        if (!this.explodedCluster) return;
        // Ottieni le entità temporanee e il centro del cluster
        const clusterId = this.explodedCluster.clusterId;
        const stationIds = this.explodedCluster.stationIds;
        const centerEntity = this.mapView.viewer.entities.getById(clusterId);
        let centerLng = 0, centerLat = 0;
        if (centerEntity && centerEntity.position) {
            const carto = Cesium.Cartographic.fromCartesian(centerEntity.position.getValue ? centerEntity.position.getValue() : centerEntity.position);
            centerLng = Cesium.Math.toDegrees(carto.longitude);
            centerLat = Cesium.Math.toDegrees(carto.latitude);
        }
        // Trova tutte le entità temporanee
        const tempEntities = stationIds.map(id => this.mapView.viewer.entities.getById(id + '-temp')).filter(Boolean);
        const startPositions = tempEntities.map(entity => {
            const carto = Cesium.Cartographic.fromCartesian(entity.position.getValue ? entity.position.getValue() : entity.position);
            return {
                lng: Cesium.Math.toDegrees(carto.longitude),
                lat: Cesium.Math.toDegrees(carto.latitude)
            };
        });
        const duration = 400; // ms
        const startTime = performance.now();
        const animate = () => {
            const now = performance.now();
            const t = Math.min(1, (now - startTime) / duration);
            tempEntities.forEach((entity, i) => {
                const start = startPositions[i];
                const currLng = start.lng + (centerLng - start.lng) * t;
                const currLat = start.lat + (centerLat - start.lat) * t;
                entity.position = Cesium.Cartesian3.fromDegrees(currLng, currLat);
            });
            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                this.mapView.clearTemporaryStations();
                this.mapView.setEntityVisibility(clusterId, true);
                this.explodedCluster = null;
                console.log("Cleared exploded cluster.");
            }
        };
        animate();
    }
} 