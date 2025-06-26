// ===== SIDEBAR VIEW =====
//
// This view manages the DOM manipulation for the sidebar in the Terratune UI.
// It handles tab switching, filter rendering, favorites management, and playlist UI.
//
// Main responsibilities:
// - Switch between sidebar tabs and panels
// - Render and update favorites list, including play, remove, and map actions
// - Render and update filter checkboxes and retrieve selected filters
// - Show/hide modals and reset forms for playlist creation
//
// This view is used by controllers to update the sidebar UI and respond to user actions.

export class SidebarView {
    /**
     * Constructor for SidebarView.
     * Initializes DOM references for sidebar, tabs, panels, favorites, and filters.
     */
    constructor() {
        this.sidebar = document.querySelector('.sidebar');
        if (!this.sidebar) {
            console.error("Sidebar element not found!");
            return;
        }
        this.sidebarTabs = this.sidebar.querySelectorAll('.filter-tab');
        this.sidebarPanels = this.sidebar.querySelectorAll('.filter-panel');
        this.favoritesList = document.getElementById('favorites-list-container');
        // this.popularList = document.getElementById('popular-list-container');
        this.popularList = document.getElementById('popular-panel');
        this.filterContainer = {
             'Music Genre': document.getElementById('genre-filters'),
             'Lang': document.getElementById('language-filters'),
             'Mood': document.getElementById('mood-filters')
        };
    }

    /**
     * Sets up tab switching logic and calls onTabSwitch callback when a tab is activated.
     * @param {Function} onTabSwitch - Callback with the tab name.
     */
    setupTabSwitching(onTabSwitch) {
        this.sidebarTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;

                this.sidebarTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                this.sidebarPanels.forEach(panel => {
                    if (panel.id === `${tabName}-panel`) {
                        panel.classList.add('active');
                    } else {
                        panel.classList.remove('active');
                    }
                });
                
                // Show/hide filter actions based on active tab
                const filterActions = document.getElementById('filter-actions');
                if (filterActions) {
                    if (tabName === 'filters') {
                        filterActions.style.display = 'flex';
                    } else {
                        filterActions.style.display = 'none';
                    }
                }
                
                if (typeof onTabSwitch === 'function') {
                    onTabSwitch(tabName);
                }
            });
        });
    }

    /**
     * Populates the favorites list with stations and wires up play, remove, and map actions.
     * Now uses the same card style as playlists for visual consistency.
     * @param {Array} favorites - Array of favorite station objects.
     * @param {Function} onPlayCallback - Called with station id when play is clicked.
     * @param {Function} onRemoveCallback - Called with station id when remove is clicked.
     * @param {Function} onGoToMapCallback - Called with station object when map is clicked.
     * @param {Function} onCardClick - Called with station object when card is clicked.
     */
    populateFavorites(favorites, onPlayCallback, onRemoveCallback, onGoToMapCallback, onCardClick = null) {
        if (!this.favoritesList) return;
        this.favoritesList.innerHTML = '';
        if (!favorites || favorites.length === 0) {
            this.favoritesList.innerHTML = '<p class="no-favorites">No favorite stations yet. Add some!</p>';
            return;
        }
        // Use a grid container for cards (like playlists)
        const grid = document.createElement('div');
        grid.className = 'playlist-card-grid';
        favorites.forEach(station => {
            const card = this.createFavoriteStationCard(station);
            
            // Add card click for info box
            if (onCardClick) {
                card.addEventListener('click', (e) => {
                    // Prevent click if buttons are clicked
                    if (e.target.closest('.playlist-card-actions')) return;
                    onCardClick(station);
                });
            }
            
            card.querySelector('.goto-map-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                onGoToMapCallback(station);
            });
            card.querySelector('.play-favorite-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                onPlayCallback(station.id);
            });
            card.querySelector('.remove-favorite-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                onRemoveCallback(station.id);
            });
            grid.appendChild(card);
        });
        this.favoritesList.appendChild(grid);
    }

    /**
     * Creates a DOM element for a favorite station card (unified with playlist card style).
     * @param {Object} station - Station object.
     * @returns {HTMLElement} The card element.
     */
    createFavoriteStationCard(station) {
        const card = document.createElement('div');
        card.className = 'playlist-card favorite-card';
        card.setAttribute('data-station-id', station.id);
        const favicon = station.favicon || './assets/icons/favicon.svg';
        card.innerHTML = `
            <div class="playlist-card-icon">
                <img src="${favicon}" alt="Logo" class="favorite-station-logo" onerror="this.onerror=null;this.src='./assets/icons/favicon.svg';">
            </div>
            <div class="playlist-card-content">
                <div class="playlist-card-title">${station.name}</div>
                <div class="playlist-card-meta">${station.country || ''}</div>
                <div class="playlist-card-actions">
                    <button class="playlist-action-btn goto-map-btn" title="Show on Map">📍</button>
                    <button class="playlist-action-btn play-favorite-btn" title="Play Station">▶️</button>
                    <button class="playlist-action-btn remove-favorite-btn" title="Remove Favorite">🗑️</button>
                </div>
            </div>
        `;
        return card;
    }

    /**
     * Shows a confirmation prompt for deleting a favorite station.
     * @param {string} stationId - The station id.
     * @param {Function} onConfirm - Callback when deletion is confirmed.
     */
    showDeletionConfirmation(stationId, onConfirm) {
        const stationItem = this.favoritesList.querySelector(`.playlist-card.favorite-card[data-station-id='${stationId}']`);
        if (!stationItem) return;

        // Save original content to restore if canceled
        const originalContent = stationItem.innerHTML;

        // Show confirmation UI
        stationItem.innerHTML = `
            <div class="favorite-confirm-delete">
                <span>Are you sure?</span>
                <div class="favorite-confirm-actions">
                    <button class="confirm-yes">Yes</button>
                    <button class="confirm-no">No</button>
                </div>
            </div>
        `;
        
        stationItem.querySelector('.confirm-yes').addEventListener('click', (e) => {
            e.stopPropagation();
            onConfirm(stationId);
            // No need to restore, list will be redrawn
        });

        stationItem.querySelector('.confirm-no').addEventListener('click', (e) => {
            e.stopPropagation();
            // Restore original content
            stationItem.innerHTML = originalContent;
            // Re-attach original events if needed (simpler: reload the list)
             document.dispatchEvent(new CustomEvent('userFavoritesChanged'));
        });
    }

    /**
     * Renders filter checkboxes for each category and sets checked state.
     * @param {Object} filters - Object with category arrays.
     * @param {Object} selectedFilters - Object with selected tags per category.
     */
    renderFilters(filters, selectedFilters) {
        Object.keys(this.filterContainer).forEach(category => {
            const container = this.filterContainer[category];
            if (container && filters[category]) {
                container.innerHTML = '';
                // Collapsible category title
                let displayCategory = category;
                if (category === 'Lang') displayCategory = 'Language';
                const title = document.createElement('h4');
                title.textContent = displayCategory;
                title.className = 'filter-category-title';
                title.style.cursor = 'pointer';
                container.appendChild(title);
                
                // Create wrapper for fade effect
                const wrapper = document.createElement('div');
                wrapper.className = 'filter-category-content-wrapper';
                
                // Collapsible content wrapper
                const contentWrapper = document.createElement('div');
                contentWrapper.className = 'filter-category-content';
                filters[category].forEach(tag => {
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `filter-${tag}`;
                    checkbox.value = tag;
                    checkbox.checked = selectedFilters[category] && selectedFilters[category].includes(tag);

                    const label = document.createElement('label');
                    label.htmlFor = `filter-${tag}`;
                    label.textContent = tag;

                    const div = document.createElement('div');
                    div.className = 'filter-item';
                    div.appendChild(checkbox);
                    div.appendChild(label);
                    contentWrapper.appendChild(div);
                });
                
                wrapper.appendChild(contentWrapper);
                container.appendChild(wrapper);
                
                // Collapse/expand logic
                title.addEventListener('click', () => {
                    contentWrapper.classList.toggle('collapsed');
                });
            }
        });
    }

    /**
     * Gets the currently selected filters from the UI.
     * @returns {Object} Selected filters by category.
     */
    getSelectedFilters() {
        const selected = {};
        Object.keys(this.filterContainer).forEach(category => {
            const container = this.filterContainer[category];
            if (container) {
                const checked = Array.from(container.querySelectorAll('input:checked')).map(cb => cb.value);
                if (checked.length > 0) {
                    selected[category] = checked;
                }
            }
        });
        return selected;
    }

    /**
     * Resets all filter checkboxes in the UI.
     */
    resetFiltersUI() {
        Object.values(this.filterContainer).forEach(container => {
             if(container) {
                container.querySelectorAll('input:checked').forEach(cb => cb.checked = false);
             }
        });
    }

    /**
     * Renders the list of playlists in the sidebar as cards with actions.
     * @param {Array} playlists - Array of playlist objects.
     * @param {Function} onDelete - Callback for delete action (playlist object)
     * @param {Function} onEdit - Callback for edit action (playlist object, updatedData)
     * @param {Function} onCardClick - Callback for card click (playlist object)
     */
    renderPlaylists(playlists, onDelete = null, onEdit = null, onCardClick = null) {
        const container = document.getElementById('playlists-list');
        if (!container) return;
        container.innerHTML = '';
        if (!playlists || playlists.length === 0) {
            container.innerHTML = '<p class="no-playlists">No playlists yet. Create one!</p>';
            return;
        }
        // Create a grid container for cards
        const grid = document.createElement('div');
        grid.className = 'playlist-card-grid';
        playlists.forEach(playlist => {
            const card = document.createElement('div');
            card.className = 'playlist-card';
            card.innerHTML = `
                <div class="playlist-card-icon">🎶</div>
                <div class="playlist-card-content">
                    <div class="playlist-card-title">${playlist.name}</div>
                    ${playlist.description ? `<div class="playlist-card-desc">${playlist.description}</div>` : ''}
                    <div class="playlist-card-meta">${playlist.stations ? playlist.stations.length : 0} stations${playlist.is_public ? ' • Public' : ' • Private'}</div>
                    <div class="playlist-card-actions">
                        ${playlist.is_public ? `<button class="playlist-action-btn share-btn" title="Share Playlist">🔗</button>` : ''}
                        <button class="playlist-action-btn edit-btn" title="Edit Playlist">✏️</button>
                        <button class="playlist-action-btn delete-btn" title="Delete Playlist">🗑️</button>
                    </div>
                </div>
            `;
            // Card click for details
            card.addEventListener('click', (e) => {
                // Prevent click if edit/delete is clicked or if inside edit form
                if (e.target.closest('.playlist-card-actions') || e.target.closest('.playlist-edit-form')) return;
                if (typeof onCardClick === 'function') onCardClick(playlist);
            });
            // Edit action: show inline form
            card.querySelector('.edit-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.showPlaylistEditForm(card, playlist, onEdit);
            });
            // Delete action with confirmation
            card.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.showPlaylistDeleteConfirmation(card, playlist, onDelete);
            });
            // Share action (public only)
            if (playlist.is_public) {
                const shareBtn = card.querySelector('.share-btn');
                if (shareBtn) {
                    shareBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const url = `${window.location.origin}?playlist=${playlist.id}`;
                        try {
                            await navigator.clipboard.writeText(url);
                            shareBtn.textContent = 'Copied!';
                            setTimeout(() => { shareBtn.textContent = '🔗'; }, 1200);
                        } catch (err) {
                            shareBtn.textContent = 'Error';
                            setTimeout(() => { shareBtn.textContent = '🔗'; }, 1200);
                        }
                    });
                }
            }
            grid.appendChild(card);
        });
        container.appendChild(grid);
    }

    /**
     * Shows a confirmation prompt for deleting a playlist.
     * @param {HTMLElement} card - The playlist card element
     * @param {Object} playlist - The playlist object
     * @param {Function} onDelete - Callback to call if confirmed
     */
    showPlaylistDeleteConfirmation(card, playlist, onDelete) {
        if (!card) return;
        const originalContent = card.innerHTML;
        card.innerHTML = `
            <div class="playlist-confirm-delete">
                <span>Delete playlist "${playlist.name}"?<br><small>Are you sure?</small></span>
                <div class="playlist-confirm-actions">
                    <button class="confirm-yes">Yes</button>
                    <button class="confirm-no">No</button>
                </div>
            </div>
        `;
        card.querySelector('.confirm-yes').addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof onDelete === 'function') {
                onDelete(playlist);
            }
        });
        card.querySelector('.confirm-no').addEventListener('click', (e) => {
            e.stopPropagation();
            card.innerHTML = originalContent;
            // Re-attach actions
            card.querySelector('.edit-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.showPlaylistEditForm(card, playlist, null);
            });
            card.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.showPlaylistDeleteConfirmation(card, playlist, null);
            });
        });
    }

    /**
     * Shows an inline form to edit a playlist's name, description, and visibility.
     * @param {HTMLElement} card - The playlist card element
     * @param {Object} playlist - The playlist object
     * @param {Function} onEdit - Callback to call with (playlist, updatedData)
     */
    showPlaylistEditForm(card, playlist, onEdit) {
        if (!card) return;
        const originalContent = card.innerHTML;
        card.innerHTML = `
            <form class="playlist-edit-form">
                <div class="playlist-card-icon">🎶</div>
                <div class="playlist-card-content">
                    <input class="playlist-edit-name" type="text" value="${playlist.name}" maxlength="50" required style="width: 100%; margin-bottom: 0.5rem; font-size: 1.1rem; font-weight: 600; color: #fff; background: #23272f; border: 1px solid #333a44; border-radius: 6px; padding: 0.3em 0.7em;" />
                    <textarea class="playlist-edit-desc" maxlength="200" placeholder="Description (optional)" style="width: 100%; min-height: 2.2em; margin-bottom: 0.5rem; font-size: 0.97rem; color: #b0b8c1; background: #23272f; border: 1px solid #333a44; border-radius: 6px; padding: 0.3em 0.7em;">${playlist.description || ''}</textarea>
                    <label style="font-size: 0.95rem; color: #b0b8c1; display: flex; align-items: center; gap: 0.5em; margin-bottom: 0.5rem;">
                        <input type="checkbox" class="playlist-edit-public" ${playlist.is_public ? 'checked' : ''} /> Public
                    </label>
                    <div class="playlist-card-actions">
                        <button type="submit" class="playlist-action-btn save-btn" title="Save">💾 Save</button>
                        <button type="button" class="playlist-action-btn cancel-btn" title="Cancel">Cancel</button>
                    </div>
                </div>
            </form>
        `;
        // Save action
        card.querySelector('.playlist-edit-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = card.querySelector('.playlist-edit-name').value.trim();
            const description = card.querySelector('.playlist-edit-desc').value.trim();
            const isPublic = card.querySelector('.playlist-edit-public').checked;
            if (name && typeof onEdit === 'function') {
                onEdit(playlist, { name, description, is_public: isPublic });
            }
        });
        // Cancel action
        card.querySelector('.cancel-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            card.innerHTML = originalContent;
            // Re-attach actions
            card.querySelector('.edit-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.showPlaylistEditForm(card, playlist, onEdit);
            });
            card.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.showPlaylistDeleteConfirmation(card, playlist, null);
            });
        });
    }

    /**
     * Shows the modal for creating a new playlist.
     */
    showCreatePlaylistModal() {
        const modal = document.getElementById('create-playlist-modal');
        if (modal) modal.classList.remove('hidden');
    }
    /**
     * Hides the modal for creating a new playlist.
     */
    hideCreatePlaylistModal() {
        const modal = document.getElementById('create-playlist-modal');
        if (modal) modal.classList.add('hidden');
    }
    /**
     * Resets the create playlist form fields.
     */
    resetCreatePlaylistForm() {
        const form = document.getElementById('create-playlist-form');
        if (form) form.reset();
    }

    /**
     * Renders the detailed view of a playlist: title, description, stations, actions.
     * @param {Object} playlist - The playlist object
     * @param {Function} onRemoveStation - Callback(station, playlist) for removing a station
     * @param {Function} onBack - Callback for back button
     * @param {Function} onPlayStation - Callback(station) for playing a station
     * @param {Function} onGoToMap - Callback(station) for showing on map
     */
    renderPlaylistDetails(playlist, onRemoveStation, onBack, onPlayStation, onGoToMap) {
        const container = document.getElementById('playlists-list');
        if (!container) return;
        container.innerHTML = '';
        const details = document.createElement('div');
        details.className = 'playlist-details';
        details.innerHTML = `
            <button class="playlist-details-back" title="Back"><span class="playlist-details-back-arrow">←</span> <span class="playlist-details-back-text">Back</span></button>
            <div class="playlist-details-header">
                <div class="playlist-details-icon">🎶</div>
                <div>
                    <div class="playlist-details-title">${playlist.name}</div>
                    <div class="playlist-details-meta">${playlist.is_public ? '<span class=\'playlist-details-public\'>Public</span>' : '<span class=\'playlist-details-private\'>Private</span>'} • <span class="playlist-details-count">${playlist.stations ? playlist.stations.length : 0} station${playlist.stations && playlist.stations.length === 1 ? '' : 's'}</span></div>
                </div>
            </div>
            ${playlist.description ? `<div class="playlist-details-desc">${playlist.description}</div>` : ''}
            <div class="playlist-details-stations">
                <div class="playlist-details-stations-title">Stations in this playlist:</div>
                <ul class="playlist-details-station-list">
                    ${(playlist.stations && playlist.stations.length > 0) ? playlist.stations.map(station => `
                        <li class="playlist-details-station-card">
                            <div class="playlist-details-station-logo-wrap">
                                <img src="${station.favicon || './assets/icons/favicon.svg'}" alt="Logo" class="playlist-details-station-logo" onerror="this.onerror=null;this.src='./assets/icons/favicon.svg';">
                            </div>
                            <div class="playlist-details-station-info">
                                <div class="playlist-details-station-name">${station.name}</div>
                                <div class="playlist-details-station-country">${station.country || ''}</div>
                            </div>
                            <div class="playlist-details-station-actions">
                                <button class="playlist-action-btn play-favorite-btn playlist-details-station-map" title="Show on Map">📍</button>
                                <button class="playlist-action-btn play-favorite-btn playlist-details-station-play" title="Play">▶️</button>
                            </div>
                        </li>
                    `).join('') : '<li class="playlist-details-empty">No stations in this playlist.</li>'}
                </ul>
            </div>
            <div class="playlist-details-actions-row">
                ${typeof isFollowing !== 'undefined' ? `
                <button class="playlist-action-btn follow-playlist-btn only-logged${isFollowing ? ' following' : ''}" title="${isFollowing ? 'Unfollow' : 'Follow'}" data-tooltip="You have to login to follow playlists">
                    ${isFollowing ? '✓' : '❤️'}
                </button>
                ` : ''}
            </div>
        `;
        // Back button
        details.querySelector('.playlist-details-back').addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof onBack === 'function') onBack();
        });
        // Remove station buttons
        details.querySelectorAll('.playlist-details-station-remove').forEach((btn, idx) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof onRemoveStation === 'function') {
                    const station = playlist.stations[idx];
                    const card = btn.closest('.playlist-details-station-card');
                    if (!card) return;
                    const originalContent = card.innerHTML;
                    card.innerHTML = `
                        <div class="playlist-confirm-delete">
                            <span>Remove station "${station.name}"?<br><small>Are you sure?</small></span>
                            <div class="playlist-confirm-actions">
                                <button class="confirm-yes">Yes</button>
                                <button class="confirm-no">No</button>
                            </div>
                        </div>
                    `;
                    card.querySelector('.confirm-yes').addEventListener('click', (e) => {
                        e.stopPropagation();
                        onRemoveStation(station, playlist);
                    });
                    card.querySelector('.confirm-no').addEventListener('click', (e) => {
                        e.stopPropagation();
                        card.innerHTML = originalContent;
                        // Re-attach remove and play events
                        card.querySelector('.playlist-details-station-remove').addEventListener('click', (e) => {
                            e.stopPropagation();
                            btn.click();
                        });
                        card.querySelector('.playlist-details-station-play').addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (typeof onPlayStation === 'function') {
                                onPlayStation(station);
                            }
                        });
                        card.querySelector('.playlist-details-station-map').addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (typeof onGoToMap === 'function') {
                                onGoToMap(station);
                            }
                        });
                    });
                }
            });
        });
        // Play station buttons
        details.querySelectorAll('.playlist-details-station-play').forEach((btn, idx) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof onPlayStation === 'function') {
                    onPlayStation(playlist.stations[idx]);
                }
            });
        });
        // Map station buttons
        details.querySelectorAll('.playlist-details-station-map').forEach((btn, idx) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof onGoToMap === 'function') {
                    onGoToMap(playlist.stations[idx]);
                }
            });
        });
        // Share button logic (public only, in details)
        if (playlist.is_public) {
            const shareBtn = details.querySelector('.playlist-details-actions-row .share-btn');
            if (shareBtn) {
                shareBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const url = `${window.location.origin}?playlist=${playlist.id}`;
                    try {
                        await navigator.clipboard.writeText(url);
                        shareBtn.textContent = 'Copied!';
                        setTimeout(() => { shareBtn.textContent = '🔗'; }, 1200);
                    } catch (err) {
                        shareBtn.textContent = 'Error';
                        setTimeout(() => { shareBtn.textContent = '🔗'; }, 1200);
                    }
                });
            }
        }
        container.appendChild(details);
    }

    /**
     * Shows the My Playlists tab in the sidebar.
     */
    showPlaylistsTab() {
        if (!this.sidebar) return;
        // Show sidebar if hidden
        this.sidebar.classList.remove('hidden');
        
        // Remove active class from all tabs first
        const allTabs = this.sidebar.querySelectorAll('.filter-tab');
        allTabs.forEach(tab => tab.classList.remove('active'));
        
        // Activate playlists tab
        const playlistsTab = this.sidebar.querySelector('.filter-tab[data-tab="playlists"]');
        if (playlistsTab) playlistsTab.classList.add('active');
        
        // Show playlists panel, hide others
        this.sidebarPanels.forEach(panel => {
            if (panel.id === 'playlists-panel') {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });
        
        // Hide filter actions
        const filterActions = document.getElementById('filter-actions');
        if (filterActions) {
            filterActions.style.display = 'none';
        }
    }

    /**
     * Shows the Public Playlists tab in the sidebar.
     */
    showPopularPlaylistsTab() {
        if (!this.sidebar) return;
        // Show sidebar if hidden
        this.sidebar.classList.remove('hidden');
        
        // Remove active class from all tabs first
        const allTabs = this.sidebar.querySelectorAll('.filter-tab');
        allTabs.forEach(tab => tab.classList.remove('active'));
        
        // Activate popular-playlists tab
        const popularPlaylistsTab = this.sidebar.querySelector('.filter-tab[data-tab="popular-playlists"]');
        if (popularPlaylistsTab) popularPlaylistsTab.classList.add('active');
        
        // Show popular-playlists panel, hide others
        this.sidebarPanels.forEach(panel => {
            if (panel.id === 'popular-playlists-panel') {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });
        
        // Hide filter actions
        const filterActions = document.getElementById('filter-actions');
        if (filterActions) {
            filterActions.style.display = 'none';
        }
    }

    /**
     * Crea una card per una stazione popolare (senza cestino).
     * @param {Object} station - Station object.
     * @returns {HTMLElement} The card element.
     */
    createPopularStationCard(station) {
        const card = document.createElement('div');
        card.className = 'playlist-card favorite-card';
        const favicon = station.favicon || './assets/icons/favicon.svg';
        const likeCount = station.favorite_count || 0;
        card.innerHTML = `
            <div class="playlist-card-icon">
                <img src="${favicon}" alt="Logo" class="favorite-station-logo" onerror="this.onerror=null;this.src='./assets/icons/favicon.svg';">
            </div>
            <div class="playlist-card-content">
                <div class="playlist-card-title-row">
                    <div class="playlist-card-title">${station.name}</div>
                    <span class="popular-like-badge" title="Likes">&#10084;${likeCount}</span>
                </div>
                <div class="playlist-card-meta">${station.country || ''}</div>
                <div class="playlist-card-actions">
                    <button class="playlist-action-btn goto-map-btn" title="Show on Map">📍</button>
                    <button class="playlist-action-btn play-favorite-btn" title="Play Station">▶️</button>
                </div>
            </div>
        `;
        return card;
    }

    /**
     * Rende (o aggiunge) le stazioni popolari nella tab Popular, per infinite scroll.
     * @param {Array} stations - Array di oggetti stazione.
     * @param {Object} pagination - { page, total_pages }
     * @param {boolean} append - Se true, aggiunge invece di sovrascrivere.
     * @param {Function} onPlay - Callback play (station)
     * @param {Function} onGoToMap - Callback pin (station)
     */
    renderPopularStations(stations, pagination = {}, append = false, onPlay = null, onGoToMap = null, onCardClick = null) {
        if (!this.popularList) return;
        if (!append) this.popularList.innerHTML = '';
        if ((!stations || stations.length === 0) && !append) {
            this.popularList.innerHTML = '<p class="no-favorites">No popular stations yet.</p>';
            return;
        }
        let grid = this.popularList.querySelector('.playlist-card-grid');
        if (!grid) {
            grid = document.createElement('div');
            grid.className = 'playlist-card-grid';
            this.popularList.appendChild(grid);
        }
        stations.forEach(station => {
            const card = this.createPopularStationCard(station);
            
            // Add card click for info box
            if (onCardClick) {
                card.addEventListener('click', (e) => {
                    // Prevent click if buttons are clicked
                    if (e.target.closest('.playlist-card-actions')) return;
                    onCardClick(station);
                });
            }
            
            // Wiring bottoni
            const playBtn = card.querySelector('.play-favorite-btn');
            if (playBtn && onPlay) playBtn.onclick = () => onPlay(station.id);
            const pinBtn = card.querySelector('.goto-map-btn');
            if (pinBtn && onGoToMap) pinBtn.onclick = () => onGoToMap(station);
            grid.appendChild(card);
        });
    }

    /**
     * Mostra o nasconde il loader per lo scroll infinito.
     * @param {boolean} show
     */
    showPopularLoader(show) {
        if (!this.popularList) return;
        let loader = this.popularList.querySelector('.popular-loader');
        if (show) {
            if (!loader) {
                loader = document.createElement('div');
                loader.className = 'popular-loader';
                loader.textContent = 'Loading...';
                loader.style.textAlign = 'center';
                loader.style.margin = '1.5rem 0';
                this.popularList.appendChild(loader);
            }
        } else {
            if (loader) loader.remove();
        }
    }

    /**
     * Svuota la lista delle stazioni popolari (usato quando si cambia tab).
     */
    clearPopularList() {
        if (this.popularList) {
            this.popularList.innerHTML = '';
        }
    }

    /**
     * Renders popular playlists with follower count and follow/unfollow buttons.
     * @param {Array} playlists - Array of popular playlist objects.
     * @param {Object} pagination - Pagination info.
     * @param {boolean} append - Whether to append to existing list.
     * @param {Function} onFollow - Called with playlist id when follow is clicked.
     * @param {Function} onUnfollow - Called with playlist id when unfollow is clicked.
     * @param {Function} onCardClick - Called with playlist object when card is clicked.
     * @param {boolean} showFollowedOnly - Whether to show only followed playlists.
     * @param {Function} onToggleFollowedOnly - Callback to toggle followed playlists.
     */
    renderPopularPlaylists(playlists, pagination = {}, append = false, onFollow = null, onUnfollow = null, onCardClick = null, showFollowedOnly = false, onToggleFollowedOnly = null) {
        const container = document.getElementById('popular-playlists-panel');
        if (!container) return;

        if (!append) {
            container.innerHTML = '';
        }

        // Toggle button
        const toggleWrap = document.createElement('div');
        toggleWrap.style.display = 'flex';
        toggleWrap.style.justifyContent = 'flex-end';
        toggleWrap.style.marginBottom = '0.7em';
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn-primary followed-toggle-btn only-logged';
        toggleBtn.setAttribute('data-tooltip', 'You have to login to use this filter');
        toggleBtn.textContent = showFollowedOnly ? 'Show All Public Playlists' : 'Show Only Followed';
        toggleBtn.onclick = () => {
            if (onToggleFollowedOnly) onToggleFollowedOnly(!showFollowedOnly);
        };
        toggleWrap.appendChild(toggleBtn);
        container.appendChild(toggleWrap);

        if (!playlists || playlists.length === 0) {
            if (!append) {
                container.innerHTML += '<p class="no-playlists">No public playlists found.</p>';
            }
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'playlist-card-grid';

        playlists.forEach(playlist => {
            const card = this.createPopularPlaylistCard(playlist);
            
            // Wire up follow/unfollow button
            const followBtn = card.querySelector('.follow-playlist-btn');
            if (followBtn) {
                followBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (playlist.is_following) {
                        if (onUnfollow) onUnfollow(playlist.id);
                    } else {
                        if (onFollow) onFollow(playlist.id);
                    }
                });
            }

            // Wire up card click for details
            if (onCardClick) {
                card.addEventListener('click', () => onCardClick(playlist));
            }

            grid.appendChild(card);
        });

        container.appendChild(grid);
    }

    /**
     * Creates a DOM element for a popular playlist card.
     * @param {Object} playlist - Playlist object with follower_count and is_following.
     * @returns {HTMLElement} The card element.
     */
    createPopularPlaylistCard(playlist) {
        const card = document.createElement('div');
        card.className = 'playlist-card popular-playlist-card';
        card.setAttribute('data-playlist-id', playlist.id);
        card.innerHTML = `
            <div class="playlist-card-icon">🎶</div>
            <div class="playlist-card-content">
                <div class="playlist-card-title">${playlist.name}</div>
                ${playlist.description ? `<div class="playlist-card-desc">${playlist.description}</div>` : ''}
                <div class="playlist-card-meta">
                    <span class="playlist-owner">by ${playlist.owner?.username || 'Unknown'}</span>
                    <span class="follower-count">👥 ${playlist.follower_count || 0}</span>
                </div>
                <div class="playlist-card-actions">
                    <button class="playlist-action-btn share-btn" title="Share Playlist">🔗</button>
                    <button class="playlist-action-btn follow-playlist-btn only-logged${playlist.is_following ? ' following' : ''}" title="${playlist.is_following ? 'Unfollow' : 'Follow'}" data-tooltip="You have to login to follow playlists">
                        ${playlist.is_following ? '✓' : '❤️'}
                    </button>
                </div>
            </div>
        `;
        // Share button logic
        const shareBtn = card.querySelector('.share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const url = `${window.location.origin}?playlist=${playlist.id}`;
                try {
                    await navigator.clipboard.writeText(url);
                    shareBtn.textContent = 'Copied!';
                    setTimeout(() => { shareBtn.textContent = '🔗'; }, 1200);
                } catch (err) {
                    shareBtn.textContent = 'Error';
                    setTimeout(() => { shareBtn.textContent = '🔗'; }, 1200);
                }
            });
        }
        return card;
    }

    /**
     * Shows/hides the loading spinner for popular playlists.
     * @param {boolean} show - Whether to show the loader.
     */
    showPopularPlaylistsLoader(show) {
        const container = document.getElementById('popular-playlists-panel');
        if (!container) return;

        if (show) {
            container.innerHTML = '<div class="loading-spinner"></div>';
        }
    }

    /**
     * Clears the popular playlists list.
     */
    clearPopularPlaylistsList() {
        const container = document.getElementById('popular-playlists-panel');
        if (container) {
            container.innerHTML = '';
        }
    }

    /**
     * Mostra i dettagli di una playlist nel pannello Popular Playlists.
     */
    renderPlaylistDetailsInPopular(playlist, onBack, onPlayStation, onToggleFollow, onGoToMap) {
        const container = document.getElementById('popular-playlists-panel');
        if (!container) return;
        container.innerHTML = '';
        const details = document.createElement('div');
        details.className = 'playlist-details';
        const isFollowing = !!playlist.is_following;
        details.innerHTML = `
            <button class="playlist-details-back" title="Back"><span class="playlist-details-back-arrow">←</span> <span class="playlist-details-back-text">Back</span></button>
            <div class="playlist-details-header">
                <div class="playlist-details-icon">🎶</div>
                <div>
                    <div class="playlist-details-title">${playlist.name}</div>
                    <div class="playlist-details-meta">${playlist.is_public ? '<span class=\'playlist-details-public\'>Public</span>' : '<span class=\'playlist-details-private\'>Private</span>'} • <span class="playlist-details-count">${playlist.stations ? playlist.stations.length : 0} station${playlist.stations && playlist.stations.length === 1 ? '' : 's'}</span></div>
                </div>
            </div>
            ${playlist.description ? `<div class="playlist-details-desc">${playlist.description}</div>` : ''}
            <div class="playlist-details-actions-row">
                ${typeof isFollowing !== 'undefined' ? `
                <button class="playlist-action-btn follow-playlist-btn only-logged${isFollowing ? ' following' : ''}" title="${isFollowing ? 'Unfollow' : 'Follow'}" data-tooltip="You have to login to follow playlists">
                    ${isFollowing ? '✓' : '❤️'}
                </button>
                ` : ''}
            </div>
            <div class="playlist-details-stations">
                <div class="playlist-details-stations-title">Stations in this playlist:</div>
                <ul class="playlist-details-station-list">
                    ${(playlist.stations && playlist.stations.length > 0) ? playlist.stations.map(station => `
                        <li class="playlist-details-station-card">
                            <div class="playlist-details-station-logo-wrap">
                                <img src="${station.favicon || './assets/icons/favicon.svg'}" alt="Logo" class="playlist-details-station-logo" onerror="this.onerror=null;this.src='./assets/icons/favicon.svg';">
                            </div>
                            <div class="playlist-details-station-info">
                                <div class="playlist-details-station-name">${station.name}</div>
                                <div class="playlist-details-station-country">${station.country || ''}</div>
                            </div>
                            <div class="playlist-details-station-actions">
                                <button class="playlist-action-btn play-favorite-btn playlist-details-station-map" title="Show on Map">📍</button>
                                <button class="playlist-action-btn play-favorite-btn playlist-details-station-play" title="Play">▶️</button>
                            </div>
                        </li>
                    `).join('') : '<li class="playlist-details-empty">No stations in this playlist.</li>'}
                </ul>
            </div>
        `;
        // Back button
        details.querySelector('.playlist-details-back').addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof onBack === 'function') onBack();
        });
        
        // Follow/Unfollow button
        const followBtn = details.querySelector('.follow-playlist-btn');
        if (followBtn && onToggleFollow) {
            followBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                onToggleFollow(playlist, followBtn);
            });
        }
        
        // Play station buttons
        details.querySelectorAll('.playlist-details-station-play').forEach((btn, idx) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof onPlayStation === 'function') {
                    onPlayStation(playlist.stations[idx]);
                }
            });
        });
        // Map station buttons
        details.querySelectorAll('.playlist-details-station-map').forEach((btn, idx) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof onGoToMap === 'function') {
                    onGoToMap(playlist.stations[idx]);
                }
            });
        });
        // Share button logic (public only, in details)
        if (playlist.is_public) {
            const shareBtn = details.querySelector('.playlist-details-actions-row .share-btn');
            if (shareBtn) {
                shareBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const url = `${window.location.origin}?playlist=${playlist.id}`;
                    try {
                        await navigator.clipboard.writeText(url);
                        shareBtn.textContent = 'Copied!';
                        setTimeout(() => { shareBtn.textContent = '🔗'; }, 1200);
                    } catch (err) {
                        shareBtn.textContent = 'Error';
                        setTimeout(() => { shareBtn.textContent = '🔗'; }, 1200);
                    }
                });
            }
        }
        container.appendChild(details);
    }

    showFiltersTab() {
        // Deseleziona tutte le tab e pannelli
        this.sidebarTabs.forEach(tab => tab.classList.remove('active'));
        this.sidebarPanels.forEach(panel => panel.classList.remove('active'));
        // Seleziona la tab e il pannello filters
        const filtersTab = this.sidebar.querySelector('.filter-tab[data-tab="filters"]');
        const filtersPanel = this.sidebar.querySelector('#filters-panel');
        if (filtersTab) filtersTab.classList.add('active');
        if (filtersPanel) filtersPanel.classList.add('active');
        
        // Show filter actions
        const filterActions = document.getElementById('filter-actions');
        if (filterActions) {
            filterActions.style.display = 'flex';
        }
    }
}