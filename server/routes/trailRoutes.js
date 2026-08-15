const express = require('express');
const { SUPPORTED_TRAIL_TYPES } = require('../repositories/trailRepository');

function createTrailRouter(trailRepository) {
    const router = express.Router();

    router.get('/trail-regions', (req, res) => {
        try {
            res.json(trailRepository.getRegions());
        } catch (err) {
            console.error('Error reading trail regions:', err);
            res.status(500).send('Error reading trail regions');
        }
    });

    router.get('/trail-gpx', (req, res) => {
        const requestedRegions = parseCsv(req.query.regions);
        const requestedTypes = parseCsv(req.query.types)
            .filter(type => SUPPORTED_TRAIL_TYPES.includes(type));

        if (requestedRegions.length === 0 || requestedTypes.length === 0) {
            return res.json([]);
        }

        try {
            res.json(trailRepository.getFiles(requestedRegions, requestedTypes));
        } catch (err) {
            console.error('Error reading trail GPX files:', err);
            res.status(500).send('Error reading trail GPX files');
        }
    });

    return router;
}

function parseCsv(value) {
    return String(value || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

module.exports = { createTrailRouter, parseCsv };
