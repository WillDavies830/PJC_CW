const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 8080;

// Open database connection
const db = new sqlite3.Database(path.join(__dirname, 'db', 'race-control.db'));

// Middleware to parse JSON and serve static files
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Route to get all races
app.get('/api/races', (req, res) => {
  db.all('SELECT * FROM races ORDER BY date DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Route to create a new race
app.post('/api/races', (req, res) => {
  const { name, date } = req.body;
  if (!name || !date) {
    return res.status(400).json({ error: 'Name and date are required' });
  }

  db.run(
    'INSERT INTO races (name, date, status) VALUES (?, ?, ?)',
    [name, date, 'pending'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, name, date, status: 'pending' });
    }
  );
});

// Route to update race start time
app.put('/api/races/:id/start', (req, res) => {
  const raceId = req.params.id;
  const startTime = Date.now(); // Current timestamp

  db.run(
    'UPDATE races SET startTime = ?, status = ? WHERE id = ?',
    [startTime, 'active', raceId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Race not found' });
      }
      res.json({ id: raceId, startTime, status: 'active' });
    }
  );
});

// Route to end a race
app.put('/api/races/:id/end', (req, res) => {
  const raceId = req.params.id;

  db.run(
    'UPDATE races SET status = ? WHERE id = ?',
    ['completed', raceId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Race not found' });
      }
      res.json({ id: raceId, status: 'completed' });
    }
  );
});

// Route to submit race results
app.post('/api/races/:id/results', (req, res) => {
  const raceId = req.params.id;
  const { results, deviceId } = req.body;
  
  if (!results || !Array.isArray(results)) {
    return res.status(400).json({ error: 'Results array is required' });
  }

  // Begin transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    let hasError = false;
    const uploadedAt = Date.now();

    // Insert each result
    results.forEach(result => {
      if (hasError) return;

      const { runnerNumber, finishTime } = result;
      
      if (!runnerNumber || !finishTime) {
        hasError = true;
        return res.status(400).json({ error: 'Runner number and finish time are required for each result' });
      }

      db.run(
        'INSERT INTO results (raceId, runnerNumber, finishTime, uploadedBy, uploadedAt) VALUES (?, ?, ?, ?, ?)',
        [raceId, runnerNumber, finishTime, deviceId, uploadedAt],
        function(err) {
          if (err) {
            hasError = true;
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }
        }
      );
    });

    if (!hasError) {
      db.run('COMMIT', err => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, message: `${results.length} results saved successfully` });
      });
    }
  });
});

// Route to get race results
app.get('/api/races/:id/results', (req, res) => {
  const raceId = req.params.id;

  db.all(
    `SELECT r.*, 
    (SELECT startTime FROM races WHERE id = ?) as raceStartTime 
    FROM results r 
    WHERE r.raceId = ? 
    ORDER BY r.finishTime ASC`,
    [raceId, raceId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Process results to include race time
      const processedResults = rows.map(row => {
        return {
          id: row.id,
          runnerNumber: row.runnerNumber,
          finishTime: row.finishTime,
          raceTime: row.raceStartTime ? row.finishTime - row.raceStartTime : null,
          uploadedBy: row.uploadedBy,
          uploadedAt: row.uploadedAt
        };
      });
      
      res.json(processedResults);
    }
  );
});

// Route to get race details including start time
app.get('/api/races/:id', (req, res) => {
  const raceId = req.params.id;

  db.get('SELECT * FROM races WHERE id = ?', [raceId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Race not found' });
    }
    res.json(row);
  });
});

// Add this new route to server.js before the catch-all route
// Route to delete a race
app.delete('/api/races/:id', (req, res) => {
  const raceId = req.params.id;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // First delete all results associated with the race
    db.run('DELETE FROM results WHERE raceId = ?', [raceId], function(err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      
      // Then delete the race itself
      db.run('DELETE FROM races WHERE id = ?', [raceId], function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        
        if (this.changes === 0) {
          db.run('ROLLBACK');
          return res.status(404).json({ error: 'Race not found' });
        }
        
        db.run('COMMIT', err => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({ success: true, message: 'Race deleted successfully' });
        });
      });
    });
  });
});

// Route to serve the main app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Handle server shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});