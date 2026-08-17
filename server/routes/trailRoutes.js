const express = require('express');
const { SUPPORTED_TRAIL_TYPES } = require('../repositories/postgisTrailRepository');

function createTrailRouter(trailRepository) {
    const router = express.Router();

    router.get('/trail-regions', async (req, res) => {
        try {
            res.json(await trailRepository.getRegions());
        } catch (err) {
            console.error('Error reading trail regions:', err);
            res.status(500).send('Error reading trail regions');
        }
    });

    router.get('/trail-gpx', async (req, res) => {
        const requestedRegions = parseCsv(req.query.regions);
        const requestedTypes = parseCsv(req.query.types)
            .filter(type => SUPPORTED_TRAIL_TYPES.includes(type));

        if (requestedRegions.length === 0 || requestedTypes.length === 0) {
            return res.json({ features: [], sourceCount: 0, totalKm: 0 });
        }

        try {
            res.json(await trailRepository.getFeatures(requestedRegions, requestedTypes));
        } catch (err) {
            console.error('Error reading trail features:', err);
            res.status(500).send('Error reading trail features');
        }
    });

    router.get('/user-gpx', async (req, res) => {
        try {
            res.json(await trailRepository.getUserRoutes());
        } catch (err) {
            console.error('Error reading user GPX routes:', err);
            res.status(500).send('Error reading user GPX routes');
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
