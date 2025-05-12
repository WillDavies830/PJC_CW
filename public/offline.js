/**
 * Offline Storage Manager
 * Handles local storage of race data when offline
 */
class OfflineStorage {
    constructor() {
      this.storageKey = 'race-control-data';
      this.connectionStatusElement = document.getElementById('connection-status');
      this.syncStatusElement = document.getElementById('sync-status');
      
      // Generate a unique device ID if not already present
      this.deviceId = localStorage.getItem('device-id');
      if (!this.deviceId) {
        this.deviceId = this.generateDeviceId();
        localStorage.setItem('device-id', this.deviceId);
      }
      
      // Initialize online/offline status
      this.isOnline = navigator.onLine;
      this.updateConnectionStatus();
      
      // Set up event listeners
      window.addEventListener('online', () => this.handleConnectionChange(true));
      window.addEventListener('offline', () => this.handleConnectionChange(false));
      
      // Check for any unsynchronized data on startup
      this.checkUnsyncedData();
    }
  
    /**
     * Generate a unique device ID
     * @returns {string} A unique device ID
     */
    generateDeviceId() {
      return 'device_' + Math.random().toString(36).substring(2, 15) + 
             Math.random().toString(36).substring(2, 15);
    }
  
    /**
     * Get the device ID
     * @returns {string} The device ID
     */
    getDeviceId() {
      return this.deviceId;
    }
  
    /**
     * Handle connection status changes
     * @param {boolean} isOnline - Whether the device is online
     */
    handleConnectionChange(isOnline) {
      this.isOnline = isOnline;
      this.updateConnectionStatus();
      this.checkUnsyncedData();
      
      if (isOnline) {
        // Show notification
        showNotification(isOnline ? 'You are back online' : 'You are offline', 3000);
      }
    }
  
    /**
     * Update the connection status display
     */
    updateConnectionStatus() {
      if (this.connectionStatusElement) {
        this.connectionStatusElement.textContent = this.isOnline ? 'Online' : 'Offline';
        this.connectionStatusElement.className = this.isOnline ? 'online' : 'offline';
      }
    }
  
    /**
     * Check if there's any unsynced data and update UI accordingly
     */
    checkUnsyncedData() {
      const data = this.getStoredData();
      const hasUnsyncedData = data && data.results && data.results.length > 0;
      
      if (this.syncStatusElement) {
        if (hasUnsyncedData && this.isOnline) {
          this.syncStatusElement.classList.remove('hidden');
        } else {
          this.syncStatusElement.classList.add('hidden');
        }
      }
      
      return hasUnsyncedData;
    }
  
    /**
     * Store race data locally
     * @param {Object} raceData - The race data to store
     */
    storeRaceData(raceData) {
      localStorage.setItem(this.storageKey, JSON.stringify(raceData));
      this.checkUnsyncedData();
    }
  
    /**
     * Get stored race data
     * @returns {Object|null} The stored race data or null if none exists
     */
    getStoredData() {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : null;
    }
  
    /**
     * Store a race result locally
     * @param {Object} result - The race result to store
     */
    storeResult(result) {
      let data = this.getStoredData() || { raceId: result.raceId, results: [] };
      
      // Make sure we're storing for the same race
      if (data.raceId !== result.raceId) {
        data = { raceId: result.raceId, results: [] };
      }
      
      data.results.push(result);
      this.storeRaceData(data);
    }
  
    /**
     * Clear all stored results
     */
    clearResults() {
      localStorage.removeItem(this.storageKey);
      this.checkUnsyncedData();
    }
  
    /**
     * Check if the device is online
     * @returns {boolean} Whether the device is online
     */
    isDeviceOnline() {
      return this.isOnline;
    }
  
    /**
     * Synchronize stored results with the server
     * @returns {Promise} A promise that resolves when synchronization is complete
     */
    async syncResults() {
      if (!this.isOnline) {
        showNotification('Cannot sync while offline', 3000);
        return false;
      }
      
      const data = this.getStoredData();
      if (!data || !data.results || data.results.length === 0) {
        showNotification('No data to synchronize', 3000);
        return false;
      }
      
      try {
        const response = await fetch(`/api/races/${data.raceId}/results`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            results: data.results,
            deviceId: this.deviceId
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to synchronize results');
        }
        
        this.clearResults();
        showNotification('Results synchronized successfully', 3000);
        return true;
      } catch (error) {
        console.error('Sync error:', error);
        showNotification('Failed to synchronize results', 3000);
        return false;
      }
    }
  }
  
  /**
   * Show a notification to the user
   * @param {string} message - The message to display
   * @param {number} duration - How long to show the notification in milliseconds
   */
  function showNotification(message, duration = 3000) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.classList.remove('hidden');
    
    setTimeout(() => {
      notification.classList.add('hidden');
    }, duration);
  }
  
  // Initialize offline storage
  window.offlineStorage = new OfflineStorage();
  
  // Register service worker for offline capabilities
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('ServiceWorker registered with scope:', registration.scope);
        })
        .catch(err => {
          console.error('ServiceWorker registration failed:', err);
        });
    });
  }