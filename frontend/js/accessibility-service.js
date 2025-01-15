// Accessibility Service for managing screen reader announcements and other accessibility features
class AccessibilityService {
    constructor() {
        // Create aria-live region for screen reader announcements
        this.announceElement = document.createElement('div');
        this.announceElement.setAttribute('aria-live', 'polite');
        this.announceElement.setAttribute('aria-atomic', 'true');
        this.announceElement.className = 'sr-only';
        this.announceElement.style.position = 'absolute';
        this.announceElement.style.width = '1px';
        this.announceElement.style.height = '1px';
        this.announceElement.style.padding = '0';
        this.announceElement.style.margin = '-1px';
        this.announceElement.style.overflow = 'hidden';
        this.announceElement.style.clip = 'rect(0, 0, 0, 0)';
        this.announceElement.style.whiteSpace = 'nowrap';
        this.announceElement.style.border = '0';
        
        // Add to document when DOM is loaded
        if (document.body) {
            document.body.appendChild(this.announceElement);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                document.body.appendChild(this.announceElement);
            });
        }
    }

    /**
     * Announces a message to screen readers
     * @param {string} message - The message to be announced
     */
    announce(message) {
        if (!message) return;
        
        // Clear existing content first
        this.announceElement.textContent = '';
        
        // Use setTimeout to ensure the change is registered by screen readers
        setTimeout(() => {
            this.announceElement.textContent = message;
        }, 50);
    }

    /**
     * Updates game score with screen reader announcement
     * @param {number} score - Current game score
     */
    announceScore(score) {
        this.announce(`Score updated to ${score} points`);
    }

    /**
     * Announces remaining time
     * @param {number} seconds - Remaining time in seconds
     */
    announceTime(seconds) {
        this.announce(`${seconds} seconds remaining`);
    }

    /**
     * Announces game status changes
     * @param {string} status - Game status message
     */
    announceGameStatus(status) {
        this.announce(status);
    }
}

// Create singleton instance
const accessibilityService = new AccessibilityService();

// Export singleton instance
export default accessibilityService;
