// Jest setup file - loads the KMLParser class for testing

const fs = require('fs');
const path = require('path');

// Read the KMLParser source file
const kmlParserSource = fs.readFileSync(
    path.join(__dirname, 'kml-parser.js'),
    'utf8'
);

// Create a wrapper to execute the code and capture the class
const wrapper = new Function('global', kmlParserSource + '\nreturn KMLParser;');
const KMLParser = wrapper(global);

// Make KMLParser available globally
global.KMLParser = KMLParser;
