// ===== NOTIFICATION SERVICE =====
//
// This service provides a simple interface for displaying notifications to the user.
// It creates and manages notification elements in the DOM, supporting different types
// (info, error, success) and auto-dismissal after a configurable duration.
//
// Main responsibilities:
// - Show notifications with different styles/icons based on type
// - Ensure a notification container exists in the DOM
// - Provide convenience methods for error and success notifications
//
// This service is used by controllers, services, and views to inform the user of events.

export class NotificationService {
    /**
     * Constructor for NotificationService.
     * Ensures the notification container exists in the DOM.
     */
    constructor() {
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            console.warn('Notification container not found. Creating one.');
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            document.body.appendChild(this.container);
        }
    }

    /**
     * Shows a notification with a message, type, and duration.
     * @param {string} message - The message to display.
     * @param {string} type - Notification type ('info', 'error', 'success').
     * @param {number} duration - How long to show the notification (ms).
     */
    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;

        let icon = '';
        if (type === 'error') {
            icon = '<i class="fas fa-exclamation-circle"></i>';
        } else if (type === 'success') {
            icon = '<i class="fas fa-check-circle"></i>';
        }

        notification.innerHTML = `${icon} ${message}`;

        this.container.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('show');
            notification.addEventListener('transitionend', () => notification.remove());
        }, duration);
    }

    /**
     * Shows an error notification.
     * @param {string} message - The error message.
     * @param {number} duration - How long to show the notification (ms).
     */
    showError(message, duration = 5000) {
        this.show(message, 'error', duration);
    }

    /**
     * Shows a success notification.
     * @param {string} message - The success message.
     * @param {number} duration - How long to show the notification (ms).
     */
    showSuccess(message, duration = 3000) {
        this.show(message, 'success', duration);
    }
} 