const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

const db = new DatabaseSync(config.DB_PATH);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

module.exports = db;
