// ===== STATION MODEL =====
//
// This model manages radio station data for the Terratune app.
// It acts as the data layer for stations and clusters, handling API calls via ApiService,
// storing the current list of stations and clusters, and providing utility methods for filtering,
// searching, and statistics.
//
// Main responsibilities:
// - Fetch, cluster, and filter stations via the backend API
// - Store and provide access to the current list of stations and clusters
// - Support searching, filtering, and statistics on stations
// - Provide methods for accessing and updating the current station
//
// This model does NOT handle any UI logic; it is used by controllers and views.

export class StationModel {
    /**
     * Constructor for StationModel.
     * @param {ApiService} apiService - The service for backend API calls.
     */
    constructor(apiService) {
        this.apiService = apiService;
        this.stations = [];
        this.clusters = [];
        this.filters = {};
        this.currentView = null;
        this.currentStation = null;
    }
    
    /**
     * Fetches clustered stations from the backend for the given map bounds, zoom, and filters.
     * Updates the local clusters and currentView state.
     * @param {Object} bounds - Map bounds (north, south, east, west)
     * @param {number} zoom - Current zoom level
     * @param {Object} filters - Additional filters (optional)
     * @returns {Promise<Object>} The API response data
     */
    async getClusteredStations(bounds, zoom, filters = {}) {
        try {
            // Convert array filters to comma-separated strings for backend
            const filterKeys = ['genre', 'lang', 'mood', 'decade', 'topic', 'countrycode'];
            const normalizedFilters = { ...filters };
            filterKeys.forEach(key => {
                if (Array.isArray(normalizedFilters[key])) {
                    normalizedFilters[key] = normalizedFilters[key].join(',');
                }
            });
            const params = {
                north: bounds.north,
                south: bounds.south,
                east: bounds.east,
                west: bounds.west,
                zoom: zoom,
                ...normalizedFilters
            };
            const data = await this.apiService.getClusteredStations(params);
            this.clusters = data.items;
            this.currentView = data;
            return data;
        } catch (error) {
            console.error('Failed to get clustered stations:', error);
            throw error;
        }
    }
    
    /**
     * Fetches all stations from the backend with optional filters.
     * Updates the local stations list.
     * @param {Object} filters - Filters for the API call (optional)
     * @returns {Promise<Object>} The API response data
     */
    async getStations(filters = {}) {
        try {
            const data = await this.apiService.getStations(filters);
            this.stations = data.items;
            return data;
        } catch (error) {
            console.error('Failed to get stations:', error);
            throw error;
        }
    }
    
    /**
     * Fetches tags for a given category from the backend.
     * @param {string} category - The tag category (e.g., genre, country)
     * @returns {Promise<Array>} List of tags
     */
    async getTags(category) {
        try {
            return await this.apiService.getTags(category);
        } catch (error) {
            console.error(`Failed to get ${category} tags:`, error);
            throw error;
        }
    }
    
    /**
     * Returns the current list of clusters.
     * @returns {Array} Clusters
     */
    getCurrentClusters() {
        return this.clusters;
    }
    
    /**
     * Returns the current list of stations.
     * @returns {Array} Stations
     */
    getCurrentStations() {
        return this.stations;
    }
    
    /**
     * Returns the current view data (from the last cluster fetch).
     * @returns {Object|null} Current view data
     */
    getCurrentView() {
        return this.currentView;
    }
    
    /**
     * Sets the current filters for station queries.
     * @param {Object} filters - Filters to set
     */
    setFilters(filters) {
        this.filters = { ...filters };
    }
    
    /**
     * Returns the current filters.
     * @returns {Object} Filters
     */
    getFilters() {
        return this.filters;
    }
    
    // ===== Utility methods =====
    /**
     * Finds and returns a station by its ID from the local stations list.
     * @param {string} id - Station ID
     * @returns {Object|null} Station object or null
     */
    findStationById(id) {
        return this.stations.find(station => station.id === id);
    }
    
    /**
     * Finds and returns a station by its ID from the current clusters.
     * @param {string} id - Station ID
     * @returns {Object|null} Station object or null
     */
    findStationInClusters(id) {
        for (const cluster of this.clusters) {
            if (cluster.type === 'station') {
                if (cluster.stations[0]?.id === id) {
                    return cluster.stations[0];
                }
            } else {
                const station = cluster.stations.find(s => s.id === id);
                if (station) return station;
            }
        }
        return null;
    }
    
    /**
     * Returns all stations in a given cluster by cluster ID.
     * @param {string} clusterId - Cluster ID
     * @returns {Array} Stations in the cluster
     */
    getStationsInCluster(clusterId) {
        const cluster = this.clusters.find(c => c.id === clusterId);
        return cluster ? cluster.stations : [];
    }
    
    /**
     * Returns details about a cluster (whether it's stacked and the station IDs).
     * @param {string} clusterId - Cluster ID
     * @returns {Object} { isStacked: boolean, stationIds: Array }
     */
    getClusterDetails(clusterId) {
        const cluster = this.clusters.find(c => c.cluster_id === clusterId || c.id === clusterId);
        if (!cluster || !cluster.stations || cluster.stations.length === 0) {
            return { isStacked: false, stationIds: [] };
        }
        
        // If only one station, not a cluster
        if (cluster.stations.length === 1) {
            return { isStacked: false, stationIds: [cluster.stations[0].id] };
        }
        
        // Check if all stations are very close (same building/area)
        const firstStation = cluster.stations[0];
        const threshold = 0.01; // ~1-2 km difference
        
        const allVeryClose = cluster.stations.every(station => {
            const latDiff = Math.abs(station.geo_lat - firstStation.geo_lat);
            const lngDiff = Math.abs(station.geo_long - firstStation.geo_long);
            return latDiff <= threshold && lngDiff <= threshold;
        });
        
        const stationIds = cluster.stations.map(s => s.id);
        
        return {
            isStacked: allVeryClose,
            stationIds: stationIds
        };
    }
    
    // ===== Search methods =====
    /**
     * Searches stations by name or country.
     * @param {string} query - The search query
     * @returns {Array} Matching stations
     */
    searchStations(query) {
        if (!query || query.trim() === '') {
            return this.stations;
        }
        
        const searchTerm = query.toLowerCase();
        return this.stations.filter(station => 
            station.name.toLowerCase().includes(searchTerm) ||
            station.country?.toLowerCase().includes(searchTerm)
        );
    }
    
    // ===== Filter methods =====
    /**
     * Filters stations by genre.
     * @param {string} genre - The genre to filter by
     * @returns {Array} Filtered stations
     */
    filterStationsByGenre(genre) {
        return this.stations.filter(station => 
            station.music_genres?.some(g => g.name === genre)
        );
    }
    
    /**
     * Filters stations by country.
     * @param {string} country - The country to filter by
     * @returns {Array} Filtered stations
     */
    filterStationsByCountry(country) {
        return this.stations.filter(station => 
            station.country === country
        );
    }
    
    /**
     * Filters stations by language.
     * @param {string} language - The language to filter by
     * @returns {Array} Filtered stations
     */
    filterStationsByLanguage(language) {
        return this.stations.filter(station => 
            station.langs?.some(l => l.name === language)
        );
    }
    
    // ===== Statistics methods =====
    /**
     * Returns the total number of stations.
     * @returns {number} Station count
     */
    getStationCount() {
        return this.stations.length;
    }
    
    /**
     * Returns the total number of clusters.
     * @returns {number} Cluster count
     */
    getClusterCount() {
        return this.clusters.length;
    }
    
    /**
     * Returns a mapping of country names to station counts.
     * @returns {Object} { country: count }
     */
    getStationsByCountry() {
        const countries = {};
        this.stations.forEach(station => {
            const country = station.country || 'Unknown';
            countries[country] = (countries[country] || 0) + 1;
        });
        return countries;
    }
    
    /**
     * Returns a mapping of genre names to station counts.
     * @returns {Object} { genre: count }
     */
    getStationsByGenre() {
        const genres = {};
        this.stations.forEach(station => {
            station.music_genres?.forEach(genre => {
                genres[genre.name] = (genres[genre.name] || 0) + 1;
            });
        });
        return genres;
    }
    
    /**
     * Sets the current station.
     * @param {Object} station - The station to set as current
     */
    setCurrentStation(station) {
        this.currentStation = station;
    }
    
    /**
     * Returns the currently selected station.
     * @returns {Object|null} The current station
     */
    getCurrentStation() {
        return this.currentStation;
    }
    
    /**
     * Fetches a station by ID, first checking the local cache, then the backend if needed.
     * @param {string} id - Station ID
     * @returns {Promise<Object|null>} The station object or null
     */
    async getStationById(id) {
        // First check local cache
        const cachedStation = this.stations.find(s => s.id == id);
        if (cachedStation) {
            return cachedStation;
        }

        // If not found, fetch from API (assumes getStation exists in ApiService)
        console.log(`Station ${id} not in cache, fetching from API...`);
        try {
            // Assumes a getStation method exists in ApiService
            const station = await this.apiService.getStation(id); 
            this.stations.push(station); // Add to cache
            return station;
        } catch (error) {
            console.error(`Failed to fetch station ${id}:`, error);
            return null;
        }
    }
    
    /**
     * Fetches multiple stations by their IDs.
     * @param {Array} ids - Array of station IDs
     * @returns {Promise<Array>} Array of station objects
     */
    async getStationsByIds(ids) {
        const stations = [];
        for (const id of ids) {
            const station = await this.getStationById(id);
            if (station) {
                stations.push(station);
            }
        }
        return stations;
    }
} 