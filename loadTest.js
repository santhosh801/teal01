'use strict';

const path = require('path');

// Dynamically inject backend/node_modules into module search paths
// so this script can be executed from the root directory.
module.paths.push(path.join(__dirname, 'backend', 'node_modules'));

// Require the actual load test logic from backend
require('./backend/loadTest.js');
