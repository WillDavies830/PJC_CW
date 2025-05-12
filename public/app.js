/**
 * Race Control Application
 * Main application logic
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize app components
    const app = new RaceControlApp();
    app.init();
  });
  
  class RaceControlApp {
    constructor() {
      // Initialize state
      this.currentScreen = 'home-screen';
      this.currentRaceId = null;
      this.currentRace = null;
      this.raceTimer = new RaceTimer();
      this.results = [];
      
      // Cache DOM elements
      this.screens = {
        home: document.getElementById('home-screen'),
        createRace: document.getElementById('create-race-screen'),
        racesList: document.getElementById('races-list-screen'),
        raceControl: document.getElementById('race-control-screen'),
        results: document.getElementById('results-screen')
      };
      
      // Button elements
      this.buttons = {
        createRace: document.getElementById('create-race-button'),
        viewRaces: document.getElementById('view-races-button'),
        cancelCreate: document.getElementById('cancel-create'),
        backToHome: document.getElementById('back-to-home'),
        startTimer: document.getElementById('start-timer-button'),
        recordFinish: document.getElementById('record-button'),
        endRace: document.getElementById('end-race-button'),
        uploadResults: document.getElementById('upload-results-button'),
        clearResults: document.getElementById('clear-results-button'),
        backToRaces: document.getElementById('back-to-races'),
        backFromResults: document.getElementById('back-from-results'),
        syncNow: document.getElementById('sync-now-button')
      };
      
      // Forms
      this.forms = {
        createRace: document.getElementById('create-race-form'),
        recordFinish: document.getElementById('record-finish-form')
      };
      
      // Other elements
      this.elements = {
        racesContainer: document.getElementById('races-container'),
        raceNameDisplay: document.getElementById('race-name-display'),
        resultsRaceName: document.getElementById('results-race-name'),
        resultsList: document.getElementById('results-list'),
        resultsTableContainer: document.getElementById('results-table-container'),
        runnerInput: document.getElementById('runner-input'),
        runnerNumber: document.getElementById('runner-number')
      };
    }
    
    /**
     * Initialize the application
     */
    init() {
      this.bindEventListeners();
      this.showScreen('home-screen');
    }
    
    /**
     * Bind event listeners to UI elements
     */
    bindEventListeners() {
      // Navigation buttons
      this.buttons.createRace.addEventListener('click', () => this.showScreen('create-race-screen'));
      this.buttons.viewRaces.addEventListener('click', () => this.loadRaces());
      this.buttons.cancelCreate.addEventListener('click', () => this.showScreen('home-screen'));
      this.buttons.backToHome.addEventListener('click', () => this.showScreen('home-screen'));
      this.buttons.backToRaces.addEventListener('click', () => this.loadRaces());
      this.buttons.backFromResults.addEventListener('click', () => this.loadRaces());
      
      // Race control buttons
      this.buttons.startTimer.addEventListener('click', () => this.startRace());
      this.buttons.recordFinish.addEventListener('click', () => this.showRunnerInput());
      this.buttons.endRace.addEventListener('click', () => this.endRace());
      this.buttons.uploadResults.addEventListener('click', () => this.uploadResults());
      this.buttons.clearResults.addEventListener('click', () => this.clearResults());
      
      // Sync button
      if (this.buttons.syncNow) {
        this.buttons.syncNow.addEventListener('click', () => window.offlineStorage.syncResults());
      }
      
      // Forms
      this.forms.createRace.addEventListener('submit', (e) => {
        e.preventDefault();
        this.createRace();
      });
      
      this.forms.recordFinish.addEventListener('submit', (e) => {
        e.preventDefault();
        this.recordFinish();
      });
    }
    
    /**
     * Show a specific screen and hide others
     * @param {string} screenId - The ID of the screen to show
     */
    showScreen(screenId) {
      document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
      });
      
      document.getElementById(screenId).classList.add('active');
      this.currentScreen = screenId;
      
      // Special handling for screens
      if (screenId === 'race-control-screen') {
        // Initialize timer display
        this.raceTimer.updateDisplay();
      }
    }
    
    /**
     * Create a new race
     */
    async createRace() {
      const nameInput = document.getElementById('race-name');
      const dateInput = document.getElementById('race-date');
      
      const name = nameInput.value.trim();
      const date = dateInput.value;
      
      if (!name || !date) {
        showNotification('Please fill in all fields', 3000);
        return;
      }
      
      try {
        // Check if we're online first
        if (!window.offlineStorage.isDeviceOnline()) {
          showNotification('Cannot create races while offline', 3000);
          return;
        }
        
        const response = await fetch('/api/races', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name, date })
        });
        
        if (!response.ok) {
          throw new Error('Failed to create race');
        }
        
        const race = await response.json();
        
        // Reset the form
        nameInput.value = '';
        dateInput.value = '';
        
        // Show the race control screen
        this.loadRaceControl(race.id);
        
      } catch (error) {
        console.error('Create race error:', error);
        showNotification('Failed to create race', 3000);
      }
    }
    
    /**
     * Load the list of races
     */
    async loadRaces() {
      try {
        // Check if we're online first
        if (!window.offlineStorage.isDeviceOnline()) {
          showNotification('Cannot load races while offline', 3000);
          return;
        }
        
        const response = await fetch('/api/races');
        
        if (!response.ok) {
          throw new Error('Failed to load races');
        }
        
        const races = await response.json();
        
        // Clear the container
        this.elements.racesContainer.innerHTML = '';
        
        if (races.length === 0) {
          this.elements.racesContainer.innerHTML = '<p>No races found</p>';
        } else {
          // Add each race to the container
          races.forEach(race => {
            const raceCard = document.createElement('div');
            raceCard.className = 'race-card';
            
            const status = race.status === 'pending' ? 'Not Started' : 
                           race.status === 'active' ? 'In Progress' : 'Completed';
            
            const date = new Date(race.date).toLocaleDateString();
            
            raceCard.innerHTML = `
              <h3>${race.name}</h3>
              <p>Date: ${date}</p>
              <p>Status: ${status}</p>
              <div class="race-card-buttons">
                <button class="primary-button control-button">Control Race</button>
                <button class="secondary-button results-button">View Results</button>
              </div>
            `;
            
            // Add event listeners
            raceCard.querySelector('.control-button').addEventListener('click', () => {
              this.loadRaceControl(race.id);
            });
            
            raceCard.querySelector('.results-button').addEventListener('click', () => {
              this.loadRaceResults(race.id);
            });
            
            this.elements.racesContainer.appendChild(raceCard);
          });
        }
        
        // Show the races list screen
        this.showScreen('races-list-screen');
        
      } catch (error) {
        console.error('Load races error:', error);
        showNotification('Failed to load races', 3000);
      }
    }
    
    /**
     * Load the race control screen for a specific race
     * @param {number} raceId - The ID of the race to control
     */
    async loadRaceControl(raceId) {
      try {
        // Check if we're online first to load race details
        if (!window.offlineStorage.isDeviceOnline()) {
          showNotification('Cannot load race details while offline', 3000);
          return;
        }
        
        const response = await fetch(`/api/races/${raceId}`);
        
        if (!response.ok) {
          throw new Error('Failed to load race details');
        }
        
        const race = await response.json();
        this.currentRace = race;
        this.currentRaceId = raceId;
        
        // Update the race name display
        this.elements.raceNameDisplay.textContent = race.name;
        
        // Reset results
        this.results = [];
        this.updateResultsList();
        
        // Reset and update timer
        this.raceTimer.reset();
        
        // Update button states based on race status
        if (race.status === 'pending') {
          this.buttons.startTimer.disabled = false;
          this.buttons.recordFinish.disabled = true;
          this.buttons.endRace.disabled = true;
          this.buttons.uploadResults.disabled = true;
          this.buttons.clearResults.disabled = true;
          this.elements.runnerInput.classList.add('hidden');
        } else if (race.status === 'active') {
          this.buttons.startTimer.disabled = true;
          this.buttons.recordFinish.disabled = false;
          this.buttons.endRace.disabled = false;
          this.buttons.uploadResults.disabled = false;
          this.buttons.clearResults.disabled = false;
          
          // Start the timer with the saved start time
          if (race.startTime) {
            this.raceTimer.start(parseInt(race.startTime));
          }
        } else {
          // Race is completed
          this.buttons.startTimer.disabled = true;
          this.buttons.recordFinish.disabled = true;
          this.buttons.endRace.disabled = true;
          this.buttons.uploadResults.disabled = false;
          this.buttons.clearResults.disabled = false;
          this.elements.runnerInput.classList.add('hidden');
          
          // Show the timer at its final state
          if (race.startTime) {
            this.raceTimer.start(parseInt(race.startTime));
            this.raceTimer.stop();
          }
        }
        
        // Check for locally stored results for this race
        const storedData = window.offlineStorage.getStoredData();
        if (storedData && storedData.raceId === raceId && storedData.results) {
          this.results = storedData.results;
          this.updateResultsList();
          this.buttons.uploadResults.disabled = false;
          this.buttons.clearResults.disabled = false;
        }
        
        // Show the race control screen
        this.showScreen('race-control-screen');
        
      } catch (error) {
        console.error('Load race control error:', error);
        showNotification('Failed to load race control', 3000);
      }
    }
    
    /**
     * Start the race
     */
    async startRace() {
      if (!this.currentRaceId) {
        showNotification('No race selected', 3000);
        return;
      }
      
      try {
        // Check if we're online first
        if (!window.offlineStorage.isDeviceOnline()) {
          showNotification('Cannot start race while offline', 3000);
          return;
        }
        
        // Start the timer
        const startTime = this.raceTimer.start();
        
        const response = await fetch(`/api/races/${this.currentRaceId}/start`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ startTime })
        });
        
        if (!response.ok) {
          // Stop the timer if the request failed
          this.raceTimer.stop();
          throw new Error('Failed to start race');
        }
        
        // Update current race data
        const updatedRace = await response.json();
        this.currentRace = {
          ...this.currentRace,
          startTime: updatedRace.startTime,
          status: updatedRace.status
        };
        
        // Update button states
        this.buttons.startTimer.disabled = true;
        this.buttons.recordFinish.disabled = false;
        this.buttons.endRace.disabled = false;
        this.buttons.uploadResults.disabled = false;
        this.buttons.clearResults.disabled = false;
        
        showNotification('Race started', 3000);
        
      } catch (error) {
        console.error('Start race error:', error);
        showNotification('Failed to start race', 3000);
      }
    }
    
    /**
     * Show the runner input form
     */
    showRunnerInput() {
      this.elements.runnerInput.classList.remove('hidden');
      this.elements.runnerNumber.value = '';
      this.elements.runnerNumber.focus();
    }
    
    /**
     * Record a runner finish
     */
    recordFinish() {
      if (!this.currentRaceId) {
        showNotification('No race selected', 3000);
        return;
      }
      
      if (!this.raceTimer.isRunning) {
        showNotification('Race timer not running', 3000);
        return;
      }
      
      const runnerNumber = parseInt(this.elements.runnerNumber.value);
      if (isNaN(runnerNumber) || runnerNumber <= 0) {
        showNotification('Invalid runner number', 3000);
        return;
      }
      
      // Record the finish time
      const finishTime = this.raceTimer.recordFinish();
      
      // Calculate race time
      const raceTime = finishTime - this.raceTimer.startTime;
      
      // Create result object
      const result = {
        runnerNumber,
        finishTime,
        raceTime
      };
      
      // Add to local results
      this.results.push(result);
      
      // Store results locally for offline support
      window.offlineStorage.storeResult({
        raceId: this.currentRaceId,
        runnerNumber,
        finishTime
      });
      
      // Update the results list
      this.updateResultsList();
      
      // Hide the runner input
      this.elements.runnerInput.classList.add('hidden');
      
      // Enable upload and clear buttons
      this.buttons.uploadResults.disabled = false;
      this.buttons.clearResults.disabled = false;
      
      showNotification(`Runner ${runnerNumber} recorded`, 2000);
    }
    
    /**
     * Update the results list display
     */
    updateResultsList() {
      if (!this.elements.resultsList) return;
      
      // Clear the list
      this.elements.resultsList.innerHTML = '';
      
      if (this.results.length === 0) {
        this.elements.resultsList.innerHTML = '<p>No results recorded yet</p>';
        return;
      }
      
      // Sort results by finish time (ascending)
      const sortedResults = [...this.results].sort((a, b) => a.finishTime - b.finishTime);
      
      // Add each result to the list
      sortedResults.forEach((result, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        
        const position = index + 1;
        const raceTimeFormatted = this.raceTimer.formatTimeVerbose(result.raceTime);
        
        resultItem.innerHTML = `
          <div><strong>#${position}</strong> Runner ${result.runnerNumber}</div>
          <div>${raceTimeFormatted}</div>
        `;
        
        this.elements.resultsList.appendChild(resultItem);
      });
    }
    
    /**
     * End the race
     */
    async endRace() {
      if (!this.currentRaceId) {
        showNotification('No race selected', 3000);
        return;
      }
      
      try {
        // Check if we're online first
        if (!window.offlineStorage.isDeviceOnline()) {
          // If offline, just stop the timer locally
          this.raceTimer.stop();
          showNotification('Race timer stopped', 3000);
          return;
        }
        
        // Stop the timer
        this.raceTimer.stop();
        
        const response = await fetch(`/api/races/${this.currentRaceId}/end`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to end race');
        }
        
        // Update current race data
        const updatedRace = await response.json();
        this.currentRace = {
          ...this.currentRace,
          status: updatedRace.status
        };
        
        // Update button states
        this.buttons.startTimer.disabled = true;
        this.buttons.recordFinish.disabled = true;
        this.buttons.endRace.disabled = true;
        
        showNotification('Race ended', 3000);
        
        // Ask to upload results if there are any and we're online
        if (this.results.length > 0 && window.offlineStorage.isDeviceOnline()) {
          if (confirm('Would you like to upload the race results now?')) {
            this.uploadResults();
          }
        }
        
      } catch (error) {
        console.error('End race error:', error);
        showNotification('Failed to end race', 3000);
      }
    }

        /**
     * Add this method to the RaceControlApp class
     * Delete a race
     * @param {number} raceId - The ID of the race to delete
     */
    async deleteRace(raceId) {
      if (!confirm('Are you sure you want to delete this race? This action cannot be undone.')) {
        return;
      }
      
      try {
        // Check if we're online first
        if (!window.offlineStorage.isDeviceOnline()) {
          showNotification('Cannot delete races while offline', 3000);
          return;
        }
        
        const response = await fetch(`/api/races/${raceId}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          throw new Error('Failed to delete race');
        }
        
        showNotification('Race deleted successfully', 3000);
        
        // Reload the races list
        this.loadRaces();
        
      } catch (error) {
        console.error('Delete race error:', error);
        showNotification('Failed to delete race', 3000);
      }
    }

    /**
 * Load the list of races
 */
    async loadRaces() {
      try {
        // Check if we're online first
        if (!window.offlineStorage.isDeviceOnline()) {
          showNotification('Cannot load races while offline', 3000);
          return;
        }
        
        const response = await fetch('/api/races');
        
        if (!response.ok) {
          throw new Error('Failed to load races');
        }
        
        const races = await response.json();
        
        // Clear the container
        this.elements.racesContainer.innerHTML = '';
        
        if (races.length === 0) {
          this.elements.racesContainer.innerHTML = '<p>No races found</p>';
        } else {
          // Add each race to the container
          races.forEach(race => {
            const raceCard = document.createElement('div');
            raceCard.className = 'race-card';
            
            const status = race.status === 'pending' ? 'Not Started' : 
                          race.status === 'active' ? 'In Progress' : 'Completed';
            
            const date = new Date(race.date).toLocaleDateString();
            
            raceCard.innerHTML = `
              <h3>${race.name}</h3>
              <p>Date: ${date}</p>
              <p>Status: ${status}</p>
              <div class="race-card-buttons">
                <button class="primary-button control-button">Control Race</button>
                <button class="secondary-button results-button">View Results</button>
                <button class="export-button export-csv-button">Export CSV</button>
                <button class="danger-button delete-button">Delete Race</button>
              </div>
            `;
            
            // Add event listeners
            raceCard.querySelector('.control-button').addEventListener('click', () => {
              this.loadRaceControl(race.id);
            });
            
            raceCard.querySelector('.results-button').addEventListener('click', () => {
              this.loadRaceResults(race.id);
            });
            
            raceCard.querySelector('.export-csv-button').addEventListener('click', (e) => {
              e.stopPropagation();
              this.exportRaceResults(race.id, race.name);
            });
            
            raceCard.querySelector('.delete-button').addEventListener('click', (e) => {
              // Stop event propagation to prevent other handlers from firing
              e.stopPropagation();
              this.deleteRace(race.id);
            });
            
            this.elements.racesContainer.appendChild(raceCard);
          });
        }
        
        // Show the races list screen
        this.showScreen('races-list-screen');
        
      } catch (error) {
        console.error('Load races error:', error);
        showNotification('Failed to load races', 3000);
      }
    }

        /**
     * Export race results to CSV
     * @param {number} raceId - The ID of the race to export
     * @param {string} raceName - The name of the race
     */
    async exportRaceResults(raceId, raceName) {
      try {
        // Check if we're online first
        if (!window.offlineStorage.isDeviceOnline()) {
          showNotification('Cannot export results while offline', 3000);
          return;
        }
        
        showNotification('Preparing export...', 2000);
        
        // Fetch race details
        const raceResponse = await fetch(`/api/races/${raceId}`);
        
        if (!raceResponse.ok) {
          throw new Error('Failed to load race details');
        }
        
        const race = await raceResponse.json();
        
        // Fetch race results
        const resultsResponse = await fetch(`/api/races/${raceId}/results`);
        
        if (!resultsResponse.ok) {
          throw new Error('Failed to load race results');
        }
        
        const results = await resultsResponse.json();
        
        // If no results, show a message
        if (results.length === 0) {
          showNotification('No results available to export', 3000);
          return;
        }
        
        // Sort results by race time (ascending)
        const sortedResults = [...results].sort((a, b) => a.raceTime - b.raceTime);
        
        // Format the race date
        const raceDate = new Date(race.date).toLocaleDateString();
        
        // Create CSV content
        let csvContent = 'data:text/csv;charset=utf-8,';
        
        // Add header row
        csvContent += 'Position,Runner Number,Race Time,Finish Time\n';
        
        // Add data rows
        sortedResults.forEach((result, index) => {
          const position = index + 1;
          const raceTimeFormatted = this.formatTimeDisplay(result.raceTime);
          const finishTimeFormatted = new Date(result.finishTime).toLocaleTimeString();
          
          csvContent += `${position},${result.runnerNumber},"${raceTimeFormatted}","${finishTimeFormatted}"\n`;
        });
        
        // Create a filename with race name and date
        const sanitizedRaceName = raceName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `${sanitizedRaceName}_results_${raceDate.replace(/\//g, '-')}.csv`;
        
        // Create download link
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        
        // Trigger download
        link.click();
        
        // Clean up
        document.body.removeChild(link);
        
        showNotification('Export completed', 3000);
        
      } catch (error) {
        console.error('Export race results error:', error);
        showNotification('Failed to export results', 3000);
      }
    }
    
    /**
     * Upload race results to the server
     */
    async uploadResults() {
      if (!this.currentRaceId) {
        showNotification('No race selected', 3000);
        return;
      }
      
      if (this.results.length === 0) {
        showNotification('No results to upload', 3000);
        return;
      }
      
      try {
        // Check if we're online first
        if (!window.offlineStorage.isDeviceOnline()) {
          showNotification('Results saved offline and will sync when online', 3000);
          return;
        }
        
        const response = await fetch(`/api/races/${this.currentRaceId}/results`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            results: this.results.map(result => ({
              runnerNumber: result.runnerNumber,
              finishTime: result.finishTime
            })),
            deviceId: window.offlineStorage.getDeviceId()
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to upload results');
        }
        
        // Clear local results
        this.results = [];
        this.updateResultsList();
        window.offlineStorage.clearResults();
        
        // Update button states
        this.buttons.uploadResults.disabled = true;
        this.buttons.clearResults.disabled = true;
        
        showNotification('Results uploaded successfully', 3000);
        
      } catch (error) {
        console.error('Upload results error:', error);
        showNotification('Failed to upload results', 3000);
      }
    }
    
    /**
     * Clear recorded results
     */
    clearResults() {
      if (this.results.length === 0) {
        return;
      }
      
      if (confirm('Are you sure you want to clear all recorded results?')) {
        this.results = [];
        this.updateResultsList();
        window.offlineStorage.clearResults();
        
        // Update button states
        this.buttons.uploadResults.disabled = true;
        this.buttons.clearResults.disabled = true;
        
        showNotification('Results cleared', 3000);
      }
    }
    
    /**
     * Load race results
     * @param {number} raceId - The ID of the race to load results for
     */
    async loadRaceResults(raceId) {
      try {
        // Check if we're online first
        if (!window.offlineStorage.isDeviceOnline()) {
          showNotification('Cannot load results while offline', 3000);
          return;
        }
        
        // Fetch race details
        const raceResponse = await fetch(`/api/races/${raceId}`);
        
        if (!raceResponse.ok) {
          throw new Error('Failed to load race details');
        }
        
        const race = await raceResponse.json();
        
        // Fetch race results
        const resultsResponse = await fetch(`/api/races/${raceId}/results`);
        
        if (!resultsResponse.ok) {
          throw new Error('Failed to load race results');
        }
        
        const results = await resultsResponse.json();
        
        // Update the race name display
        this.elements.resultsRaceName.textContent = race.name;
        
        // Clear the results container
        this.elements.resultsTableContainer.innerHTML = '';
        
        if (results.length === 0) {
          this.elements.resultsTableContainer.innerHTML = '<p>No results available for this race</p>';
        } else {
          // Sort results by race time (ascending)
          const sortedResults = [...results].sort((a, b) => a.raceTime - b.raceTime);
          
          // Create the results table
          const table = document.createElement('table');
          table.innerHTML = `
            <thead>
              <tr>
                <th>Position</th>
                <th>Runner</th>
                <th>Race Time</th>
                <th>Finish Time</th>
              </tr>
            </thead>
            <tbody></tbody>
          `;
          
          const tbody = table.querySelector('tbody');
          
          // Add each result to the table
          sortedResults.forEach((result, index) => {
            const position = index + 1;
            const raceTimeFormatted = this.formatTimeDisplay(result.raceTime);
            const finishTimeFormatted = new Date(result.finishTime).toLocaleTimeString();
            
            const row = document.createElement('tr');
            row.innerHTML = `
              <td>${position}</td>
              <td>${result.runnerNumber}</td>
              <td>${raceTimeFormatted}</td>
              <td>${finishTimeFormatted}</td>
            `;
            
            tbody.appendChild(row);
          });
          
          this.elements.resultsTableContainer.appendChild(table);
        }
        
        // Show the results screen
        this.showScreen('results-screen');
        
      } catch (error) {
        console.error('Load race results error:', error);
        showNotification('Failed to load race results', 3000);
      }
    }
    
    /**
     * Format time in milliseconds to a readable format
     * @param {number} timeInMs - Time in milliseconds
     * @returns {string} Formatted time string
     */
    formatTimeDisplay(timeInMs) {
      if (timeInMs === null || timeInMs === undefined) return 'N/A';
      
      const totalSeconds = Math.floor(timeInMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      } else {
        return `${seconds}s`;
      }
    }
  }