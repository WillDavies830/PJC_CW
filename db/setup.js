const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Create db directory if it doesn't exist
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

// Create and setup database
const db = new sqlite3.Database(path.join(dbDir, 'race-control.db'));

db.serialize(() => {
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS races (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      startTime INTEGER,
      status TEXT DEFAULT 'pending'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raceId INTEGER,
      runnerNumber INTEGER NOT NULL,
      finishTime INTEGER NOT NULL,
      uploadedBy TEXT,
      uploadedAt INTEGER,
      FOREIGN KEY (raceId) REFERENCES races(id)
    )
  `);

  console.log('Database setup complete!');
});

db.close();