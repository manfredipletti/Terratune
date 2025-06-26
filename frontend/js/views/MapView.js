// ===== MAP VIEW =====
//
// This view manages the 3D map visualization using Cesium for Terratune.
// It handles initialization, adding/removing stations and clusters, camera movement,
// and user interactions with map entities. It abstracts Cesium logic for the rest of the app.
//
// Main responsibilities:
// - Initialize and configure the Cesium viewer
// - Add, remove, and manage station and cluster entities on the globe
// - Handle camera movement, zoom, and view bounds
// - Provide event hooks for entity clicks and camera movement
// - Utility methods for styling and visibility
//
// This view is used by controllers to update the map UI and respond to user actions.

export class MapView {
    /**
     * Constructor for MapView.
     * Initializes state for Cesium viewer and entity tracking.
     */
    constructor() {
        this.viewer = null;
        this.entities = [];
        this.clusters = [];
        this.temporaryEntities = [];
        this.isInitialized = false;
        this._hoveredStationEntity = null;
        this._pulseAnimationId = null;
    }
    
    /**
     * Initializes the Cesium map viewer and configures scene options.
     * Must be called before adding stations or clusters.
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            console.log('Initializing Cesium map...');
            
            Cesium.Ion.defaultAccessToken = window.CESIUM_TOKEN || "add-your-cesium-token-here";
            
            // Initialize Cesium viewer
            this.viewer = new Cesium.Viewer('cesium-container', {
                baseLayerPicker: false,
                geocoder: false,
                homeButton: false,
                sceneModePicker: false,
                navigationHelpButton: false,
                animation: false,
                timeline: false,
                fullscreenButton: false,
                vrButton: false,
                infoBox: false,
                selectionIndicator: false,
                scene3DOnly: true,
                terrainProvider: await Cesium.createWorldTerrainAsync(),
            });
            
            // Enable pinch-to-zoom on Mac trackpad
            this.viewer.scene.screenSpaceCameraController.zoomEventTypes = [
                Cesium.CameraEventType.WHEEL, 
                Cesium.CameraEventType.PINCH
            ];
            this.viewer.scene.screenSpaceCameraController.scrollFactor = 2.0;
            
            // Configure scene for better appearance
            this.viewer.scene.globe.enableLighting = true;
            this.viewer.scene.globe.showGroundAtmosphere = true;
            
            // Set initial camera position
            this.viewer.camera.setView({
                destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
                orientation: {
                    heading: 0.0,
                    pitch: -Cesium.Math.PI_OVER_TWO,
                    roll: 0.0
                }
            });
            
            this.isInitialized = true;
            console.log('Cesium map initialized successfully');

            // === TOOLTIP SETUP ===
            if (!document.getElementById('map-tooltip')) {
                const tooltip = document.createElement('div');
                tooltip.id = 'map-tooltip';
                tooltip.className = 'map-tooltip';
                tooltip.style.position = 'absolute';
                tooltip.style.display = 'none';
                tooltip.style.pointerEvents = 'none';
                tooltip.style.zIndex = '10000';
                document.body.appendChild(tooltip);
            }

            // === HOVER LOGIC ===
            this.viewer.screenSpaceEventHandler.setInputAction((event) => {
                const tooltip = document.getElementById('map-tooltip');
                const picked = this.viewer.scene.pick(event.endPosition);
                // Calcola offset canvas rispetto alla pagina
                const canvas = this.viewer.scene.canvas;
                const rect = canvas.getBoundingClientRect();
                let hoveredEntity = null;
                if (Cesium.defined(picked) && picked.id) {
                    const entity = picked.id;
                    let text = '';
                    if (entity.station) {
                        text = entity.station.name;
                        hoveredEntity = entity;
                    } else if (entity.cluster) {
                        text = `Cluster: ${entity.cluster.count} stations`;
                        hoveredEntity = entity;
                    }
                    if (text) {
                        tooltip.innerText = text;
                        tooltip.style.left = (rect.left + event.endPosition.x + 12) + 'px';
                        tooltip.style.top = (rect.top + event.endPosition.y + 2) + 'px';
                        tooltip.style.display = 'block';
                        // Gestione pulsazione
                        if (hoveredEntity && hoveredEntity !== this._hoveredStationEntity) {
                            this._setHoveredStationEntity(hoveredEntity);
                        }
                        return;
                    }
                }
                tooltip.style.display = 'none';
                this._setHoveredStationEntity(null);
            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        } catch (error) {
            console.error('Failed to initialize Cesium map:', error);
            throw error;
        }
    }
    
    /**
     * Adds a station entity to the map at its coordinates.
     * @param {Object} station - Station object with geo_lat and geo_long.
     * @returns {Object|null} The Cesium entity or null if not added.
     */
    addStation(station) {
        if (!this.isInitialized || !station.geo_lat || !station.geo_long) {
            return null;
        }
        
        try {
            const position = Cesium.Cartesian3.fromDegrees(
                station.geo_long,
                station.geo_lat
            );
            
            const entity = this.viewer.entities.add({
                id: station.id,
                position: position,
                point: {
                    pixelSize: 8,
                    color: Cesium.Color.CYAN,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                },
                label: {
                    text: station.name,
                    font: '12pt sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    pixelOffset: new Cesium.Cartesian2(0, -20),
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                    show: false
                },
                station: station
            });
            
            this.entities.push(entity);
            return entity;
            
        } catch (error) {
            console.error('Failed to add station to map:', error);
            return null;
        }
    }
    
    /**
     * Adds a cluster entity to the map at its coordinates.
     * @param {Object} cluster - Cluster object with lat, lng, and count.
     * @returns {Object|null} The Cesium entity or null if not added.
     */
    addCluster(cluster) {
        if (!this.isInitialized || !cluster.lat || !cluster.lng) {
            return null;
        }
        
        try {
            const position = Cesium.Cartesian3.fromDegrees(
                cluster.lng,
                cluster.lat
            );
            
            const size = Math.min(20, Math.max(8, cluster.count * 2));
            const color = cluster.count > 10 ? Cesium.Color.ORANGE : Cesium.Color.YELLOW;
            
            const entity = this.viewer.entities.add({
                id: cluster.id,
                position: position,
                point: {
                    pixelSize: size,
                    color: color,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                },
                label: {
                    text: cluster.count.toString(),
                    font: '10pt sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 1,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    pixelOffset: new Cesium.Cartesian2(0, 0),
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                },
                cluster: cluster
            });
            
            this.clusters.push(entity);
            return entity;
            
        } catch (error) {
            console.error('Failed to add cluster to map:', error);
            return null;
        }
    }
    
    /**
     * Adds a temporary station entity to the map (e.g., for preview or search).
     * @param {Object} station - Station object.
     * @param {number} lng - Longitude.
     * @param {number} lat - Latitude.
     * @returns {Object|null} The Cesium entity or null if not added.
     */
    addTemporaryStation(station, lng, lat) {
        if (!this.isInitialized) return null;
        try {
            const entity = this.viewer.entities.add({
                id: station.id + '-temp',
                position: Cesium.Cartesian3.fromDegrees(lng, lat),
                point: {
                    pixelSize: 12,
                    color: Cesium.Color.fromCssColorString('#1E90FF'),
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                },
                label: {
                    font: '10pt sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, 12),
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                },
                station: station,
                isTemporary: true
            });
            this.temporaryEntities.push(entity);
            return entity;
        } catch (error) {
            console.error('Failed to add temporary station to map:', error);
            return null;
        }
    }
    
    /**
     * Removes all station entities from the map.
     */
    clearStations() {
        this.entities.forEach(entity => {
            this.viewer.entities.remove(entity);
        });
        this.entities = [];
    }
    
    /**
     * Removes all cluster entities from the map.
     */
    clearClusters() {
        this.clusters.forEach(entity => {
            this.viewer.entities.remove(entity);
        });
        this.clusters = [];
    }
    
    /**
     * Removes all temporary station entities from the map.
     */
    clearTemporaryStations() {
        this.temporaryEntities.forEach(entity => {
            this.viewer.entities.remove(entity);
        });
        this.temporaryEntities = [];
    }
    
    /**
     * Removes all entities (stations, clusters, temporary) from the map.
     */
    clearAll() {
        this.clearStations();
        this.clearClusters();
        this.clearTemporaryStations();
    }
    
    // /**
    //  * Animates the camera to a given Cesium camera flyTo options object.
    //  * @param {Object} options - Cesium camera flyTo options.
    //  */
    // flyTo(options) {
    //     if (!this.isInitialized) return;
    //     this.viewer.camera.flyTo(options);
    // }

    /**
     * Animates the camera to a specific longitude, latitude, and height.
     * @param {number} lng
     * @param {number} lat
     * @param {number} height
     * @returns {Promise}
     */
    flyToLocation(lng, lat, height) {
        if (!this.isInitialized) {
            console.error("MapView: flyToLocation called before map was initialized.");
            return Promise.reject(new Error("Map not initialized"));
        }
        
        // Returns the promise generated by flyTo
        return this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lng, lat, height),
            duration: 2.0,
            orientation: {
                heading: Cesium.Math.toRadians(0.0),
                pitch: Cesium.Math.toRadians(-90.0),
                roll: 0.0
            }
        });
    }
    
    /**
     * Gets the current camera position (longitude, latitude, height).
     * @returns {Object|null}
     */
    getCameraPosition() {
        if (!this.isInitialized) {
            return null;
        }
        
        const camera = this.viewer.camera;
        const position = camera.position;
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        
        return {
            longitude: Cesium.Math.toDegrees(cartographic.longitude),
            latitude: Cesium.Math.toDegrees(cartographic.latitude),
            height: cartographic.height
        };
    }
    
    /**
     * Gets the current view bounds (north, south, east, west) in degrees.
     * @returns {Object|null}
     */
    getViewBounds() {
        if (!this.isInitialized) {
            return null;
        }
        
        const camera = this.viewer.camera;
        const rectangle = camera.computeViewRectangle();
        
        if (!rectangle) {
            return null;
        }
        
        return {
            north: Cesium.Math.toDegrees(rectangle.north),
            south: Cesium.Math.toDegrees(rectangle.south),
            east: Cesium.Math.toDegrees(rectangle.east),
            west: Cesium.Math.toDegrees(rectangle.west)
        };
    }
    
    /**
     * Approximates the zoom level based on camera height.
     * @returns {number} Zoom level (0-19)
     */
    getZoomLevel() {
        if (!this.isInitialized) {
            return 0;
        }
        
        const camera = this.viewer.camera;
        const height = camera.positionCartographic.height;
        
        // Approximate zoom level based on camera height
        if (height > 20000000) return 0;
        if (height > 10000000) return 1;
        if (height > 5000000) return 2;
        if (height > 2000000) return 3;
        if (height > 1000000) return 4;
        if (height > 500000) return 5;
        if (height > 200000) return 6;
        if (height > 100000) return 7;
        if (height > 50000) return 8;
        if (height > 20000) return 9;
        if (height > 10000) return 10;
        if (height > 5000) return 11;
        if (height > 2000) return 12;
        if (height > 1000) return 13;
        if (height > 500) return 14;
        if (height > 200) return 15;
        if (height > 100) return 16;
        if (height > 50) return 17;
        if (height > 20) return 18;
        return 19;
    }
    
    // ===== Event Handlers =====

    /**
     * Registers a callback for when an entity (station, cluster, temporary) is clicked.
     * @param {Function} callback - Receives ('station'|'cluster', data) as arguments.
     */
    onEntityClick(callback) {
        if (!this.isInitialized) return;

        this.viewer.screenSpaceEventHandler.setInputAction((event) => {
            const pickedObject = this.viewer.scene.pick(event.position);
            if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
                const entity = pickedObject.id;

                // Order matters: check temporary stations first
                if (entity.isTemporary && entity.station) {
                    console.log("Clicked temporary (exploded) station:", entity.station);
                    callback('station', entity.station);
                    return;
                }

                // Then clusters
                if (entity.cluster) {
                    console.log("Clicked cluster:", entity.cluster);
                    callback('cluster', entity.cluster);
                    return;
                }
                
                // Finally normal stations
                if (entity.station) {
                    console.log("Clicked station:", entity.station);
                    callback('station', entity.station);
                    return;
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }
    
    /**
     * Registers a callback for when the camera stops moving (moveEnd event).
     * @param {Function} callback - Receives (bounds, zoom) as arguments.
     */
    onCameraMove(callback) {
        if (!this.isInitialized) return;
        
        this.viewer.camera.moveEnd.addEventListener(() => {
            const bounds = this.getViewBounds();
            const zoom = this.getZoomLevel();
            callback(bounds, zoom);
        });
    }
    
    // ===== Utility Methods =====

    /**
     * Shows or hides labels for all station and cluster entities.
     * @param {boolean} show
     */
    showLabels(show) {
        this.entities.forEach(entity => {
            if (entity.label) {
                entity.label.show = show;
            }
        });
        
        this.clusters.forEach(entity => {
            if (entity.label) {
                entity.label.show = show;
            }
        });
    }
    
    /**
     * Sets the color of all station entities.
     * @param {Object} color - Cesium.Color instance.
     */
    setStationColor(color) {
        this.entities.forEach(entity => {
            if (entity.point) {
                entity.point.color = color;
            }
        });
    }
    
    /**
     * Sets the color of all cluster entities.
     * @param {Object} color - Cesium.Color instance.
     */
    setClusterColor(color) {
        this.clusters.forEach(entity => {
            if (entity.point) {
                entity.point.color = color;
            }
        });
    }
    
    /**
     * Sets the visibility of a specific entity by ID.
     * @param {string} entityId
     * @param {boolean} isVisible
     */
    setEntityVisibility(entityId, isVisible) {
        const entity = this.viewer.entities.getById(entityId);
        if (entity) {
            entity.show = isVisible;
        } else {
            console.warn(`Entity with id ${entityId} not found for visibility change.`);
        }
    }
    
    /**
     * Destroys the Cesium viewer and cleans up resources.
     */
    destroy() {
        if (this.viewer) {
            this.viewer.destroy();
            this.viewer = null;
        }
        this.isInitialized = false;
    }

    // Funzione per gestire la stazione hoverata e avviare/fermare la pulsazione
    _setHoveredStationEntity(entity) {
        if (this._hoveredStationEntity === entity) return;
        // Reset precedente
        if (this._hoveredStationEntity && this._hoveredStationEntity.point) {
            // Ripristina la dimensione base
            if (this._hoveredStationEntity.cluster) {
                // Cluster: calcola la dimensione base come in addCluster
                const count = this._hoveredStationEntity.cluster.count;
                this._hoveredStationEntity.point.pixelSize = Math.min(20, Math.max(8, count * 2));
            } else {
                this._hoveredStationEntity.point.pixelSize = 8;
            }
        }
        this._hoveredStationEntity = entity;
        if (entity && entity.point) {
            this._startPulseAnimation();
        } else {
            this._stopPulseAnimation();
        }
    }

    _startPulseAnimation() {
        if (this._pulseAnimationId) return;
        const animate = (time) => {
            if (!this._hoveredStationEntity || !this._hoveredStationEntity.point) return;
            let baseSize = 8;
            let pulseAmp = 4;
            if (this._hoveredStationEntity.cluster) {
                // Cluster: calcola la dimensione base come in addCluster
                const count = this._hoveredStationEntity.cluster.count;
                baseSize = Math.min(20, Math.max(8, count * 2));
                pulseAmp = 6;
            }
            const pulse = pulseAmp * Math.abs(Math.sin((performance.now() / 400)));
            this._hoveredStationEntity.point.pixelSize = baseSize + pulse;
            this._pulseAnimationId = requestAnimationFrame(animate);
        };
        this._pulseAnimationId = requestAnimationFrame(animate);
    }

    _stopPulseAnimation() {
        if (this._pulseAnimationId) {
            cancelAnimationFrame(this._pulseAnimationId);
            this._pulseAnimationId = null;
        }
        if (this._hoveredStationEntity && this._hoveredStationEntity.point) {
            if (this._hoveredStationEntity.cluster) {
                const count = this._hoveredStationEntity.cluster.count;
                this._hoveredStationEntity.point.pixelSize = Math.min(20, Math.max(8, count * 2));
            } else {
                this._hoveredStationEntity.point.pixelSize = 8;
            }
        }
    }
} 