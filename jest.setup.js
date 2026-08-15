// Jest setup file - loads parser classes for testing

const fs = require('fs');
const path = require('path');
const { TextDecoder, TextEncoder } = require('util');

global.TextDecoder = global.TextDecoder || TextDecoder;
global.TextEncoder = global.TextEncoder || TextEncoder;

const kmlParserSource = fs.readFileSync(
    path.join(__dirname, 'kml-parser.js'),
    'utf8'
);
const gpxParserSource = fs.readFileSync(
    path.join(__dirname, 'gpx-parser.js'),
    'utf8'
);

const kmlWrapper = new Function('global', kmlParserSource + '\nreturn KMLParser;');
const gpxWrapper = new Function('global', gpxParserSource + '\nreturn GPXParser;');
const KMLParser = kmlWrapper(global);
const GPXParser = gpxWrapper(global);

global.KMLParser = KMLParser;
global.GPXParser = GPXParser;
