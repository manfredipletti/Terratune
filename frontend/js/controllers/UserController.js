// ===== USER CONTROLLER =====
//
// This controller manages user authentication logic (login, register, logout) for the Terratune app.
// It coordinates between the UserModel (user state), ApiService (backend API), StorageService (local storage),
// NotificationService (user feedback), and the DOM (for modals and user menu).
//
// Main responsibilities:
// - Handle login, registration, and logout flows
// - Manage authentication tokens and user profile state
// - Update the UI based on authentication state (show/hide modals, update user menu)
// - Listen for and handle user interactions with authentication UI elements
//
// This controller directly interacts with DOM elements for modals and user menu.
// All user data/state is managed via UserModel and StorageService.

export class UserController {
    /**
     * Constructor for UserController.
     * @param {UserModel} userModel - The model for user authentication and favorites.
     * @param {ApiService} apiService - The service for backend API calls.
     * @param {StorageService} storageService - The service for local storage management.
     * @param {NotificationService} notificationService - The service for user notifications.
     */
    constructor(userModel, apiService, storageService, notificationService) {
        this.userModel = userModel;
        this.apiService = apiService;
        this.storageService = storageService;
        this.notificationService = notificationService;

        // DOM elements for user menu and authentication modals
        this.userMenuBtn = document.getElementById('user-menu-btn');
        this.userMenuDropdown = document.getElementById('user-menu-dropdown');
        this.logoutBtn = document.getElementById('logout-btn');
        this.loginModal = document.getElementById('login-modal');
        this.registerModal = document.getElementById('register-modal');
        this.loginForm = document.getElementById('login-form');
        this.registerForm = document.getElementById('register-form');
        this.loginModalClose = this.loginModal.querySelector('.modal-close');
        this.registerModalClose = this.registerModal.querySelector('.modal-close');
        this.showRegisterLink = document.getElementById('show-register');
        this.showLoginLink = document.getElementById('show-login');

        // SidebarController reference for refreshing sidebar sections
        this.sidebarController = null;

        this.init();
    }

    /**
     * Initializes the controller, sets up event listeners, and checks initial authentication state.
     */
    init() {
        this.setupEventListeners();
        this.checkInitialAuthState(); // Check auth state on page load
        console.log('User controller initialized');
    }

    /**
     * Sets up event listeners for user menu, modals, and authentication forms.
     */
    setupEventListeners() {
        this.userMenuBtn.addEventListener('click', () => {
            if (this.storageService.getItem('authToken')) {
                this.toggleUserMenu(); // If logged in, show/hide menu
            } else {
                this.showLoginModal(); // If not logged in, show login modal
            }
        });

        this.logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });

        this.loginModalClose.addEventListener('click', () => this.hideLoginModal());
        this.registerModalClose.addEventListener('click', () => this.hideRegisterModal());

        this.showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.hideLoginModal();
            this.showRegisterModal();
        });

        this.showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.hideRegisterModal();
            this.showLoginModal();
        });

        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        this.registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });
    }

    /**
     * Toggles the visibility of the user menu dropdown.
     */
    toggleUserMenu() {
        this.userMenuDropdown.classList.toggle('visible');
    }
// TODO: move to view
    /**
     * Shows/hides the login and registration modals.
     */
    showLoginModal() { this.loginModal.classList.remove('hidden'); }
    hideLoginModal() { this.loginModal.classList.add('hidden'); }
    showRegisterModal() { this.registerModal.classList.remove('hidden'); }
    hideRegisterModal() { this.registerModal.classList.add('hidden'); }

    /**
     * Handles the login form submission, authenticates the user, and updates the UI/state.
     */
    async handleLogin() {
        const username = this.loginForm.elements['login-username'].value;
        const password = this.loginForm.elements['login-password'].value;

        try {
            const data = await this.apiService.post('/auth/login', { username, password });
            if (data.access_token) {
                this.storageService.setItem('authToken', data.access_token);
                await this.fetchUserProfile();
                this.hideLoginModal();
                this.notificationService.showSuccess('Login successful!');
                if (this.sidebarController) {
                    this.sidebarController.loadAndRenderFavorites();
                    this.sidebarController.loadAndRenderPlaylists();
                    this.sidebarController.handleTabSwitch('filters');
                }
                this.userModel.setAuthenticated(true);
                this.updateOnlyLoggedElements();
            } else {
                this.notificationService.showError(data.error || 'Unknown login error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.notificationService.showError(error.message || 'Server error during login');
        }
    }

    /**
     * Handles the registration form submission, registers the user, and updates the UI/state.
     */
    async handleRegister() {
        const username = this.registerForm.elements['register-username'].value;
        const password = this.registerForm.elements['register-password'].value;

        try {
            const data = await this.apiService.post('/auth/register', { username, password });
            if (data.message) {
                this.notificationService.showSuccess('Registration successful! Please log in.');
                this.hideRegisterModal();
                this.showLoginModal();
            } else {
                this.notificationService.showError(data.error || 'Unknown registration error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.notificationService.showError(error.message || 'Server error during registration');
        }
    }

    /**
     * Fetches the user profile from the backend and updates the UserModel and UI.
     * Also loads user favorites after successful login.
     */
    async fetchUserProfile() {
        try {
            const userProfile = await this.apiService.get('/auth/profile');
            this.userModel.user = userProfile;
            this.updateUserUI(userProfile.username);
            this.userModel.loadFavorites(); // Ask model to load favorites
            // Aggiorna sidebar dopo login
            if (this.sidebarController) {
                this.sidebarController.loadAndRenderFavorites();
                this.sidebarController.loadAndRenderPlaylists();
                this.sidebarController.handleTabSwitch('filters');
            }
            this.userModel.setAuthenticated(true);
            this.updateOnlyLoggedElements();
        } catch (error) {
            console.error('Failed to fetch user profile:', error);
            this.handleLogout();
        }
    }

    /**
     * Handles user logout: clears token, user data, updates UI, and shows notification.
     */
    handleLogout() {
        this.storageService.removeItem('authToken');
        // this.userModel.logout();
        this.apiService.logout();
        this.userModel.setLoggedOut();

        if (this.playlistModel && typeof this.playlistModel.clearPlaylists === 'function') {
            this.playlistModel.clearPlaylists();
        }
        this.updateUserUI(null);
        this.userMenuDropdown.classList.remove('visible');
        this.notificationService.show('You have been logged out.', 'info');
        if (this.sidebarController) {
            this.sidebarController.clearFavorites();
            this.sidebarController.clearPlaylists();
            this.sidebarController.showFollowedOnlyPublicPlaylists = false;
            this.sidebarController.loadAndRenderPopularPlaylists(true);
        }
        this.updateOnlyLoggedElements();
    }
// TODO: move to view
    /**
     * Updates the user menu UI with the current username or 'Guest' if not logged in.
     * @param {string|null} username - The username to display
     */
    updateUserUI(username) {
        const userNameElement = this.userMenuBtn.querySelector('.user-name');
        if (username) {
            userNameElement.textContent = username;
        } else {
            userNameElement.textContent = 'Guest';
        }
    }

    /**
     * Checks the initial authentication state on page load and fetches user profile if logged in.
     */
    async checkInitialAuthState() {
        const token = this.storageService.getItem('authToken');
        if (token) {
            await this.fetchUserProfile();
        }
        this.updateOnlyLoggedElements();
    }

    // SidebarController reference for refreshing sidebar sections
    setSidebarController(controller) {
        this.sidebarController = controller;
    }

    setPlaylistModel(model) {
        this.playlistModel = model;
    }

    /**
     * Attiva/disattiva tutti gli elementi .only-logged in base allo stato di login
     */
    updateOnlyLoggedElements() {
        const isLoggedIn = this.userModel.isLoggedIn();
        const elements = document.querySelectorAll('.only-logged');
        elements.forEach(el => {
            if (isLoggedIn) {
                el.classList.remove('deactivated');
            } else {
                el.classList.add('deactivated');
            }
        });
    }
} 