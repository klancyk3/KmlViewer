const express = require('express');
const { SUPPORTED_TRAIL_TYPES } = require('../repositories/postgisTrailRepository');

function createTrailRouter(trailRepository, tile17Repository) {
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
        const bounds = parseBounds(req.query);

        if (requestedRegions.length === 0 || requestedTypes.length === 0) {
            return res.json({ features: [], sourceCount: 0, totalKm: 0 });
        }

        try {
            res.json(await trailRepository.getFeatures(requestedRegions, requestedTypes, bounds));
        } catch (err) {
            console.error('Error reading trail features:', err);
            res.status(500).send('Error reading trail features');
        }
    });

    router.get('/user-gpx', async (req, res) => {
        const bounds = parseBounds(req.query);

        try {
            res.json(bounds
                ? await trailRepository.getUserRoutesInBounds(bounds)
                : await trailRepository.getUserRoutes());
        } catch (err) {
            console.error('Error reading user GPX routes:', err);
            res.status(500).send('Error reading user GPX routes');
        }
    });

    router.get('/tile17', async (req, res) => {
        const bounds = parseBounds(req.query);

        if (!bounds) {
            return res.json({ records: [] });
        }

        try {
            res.json({ records: await tile17Repository.getTilesInBounds(bounds) });
        } catch (err) {
            console.error('Error reading Tile17 records:', err);
            res.status(500).send('Error reading Tile17 records');
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

function parseBounds(query) {
    const minLon = Number.parseFloat(query.minLon);
    const minLat = Number.parseFloat(query.minLat);
    const maxLon = Number.parseFloat(query.maxLon);
    const maxLat = Number.parseFloat(query.maxLat);

    if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) {
        return null;
    }

    if (minLon >= maxLon || minLat >= maxLat) {
        return null;
    }

    return { minLon, minLat, maxLon, maxLat };
}

module.exports = { createTrailRouter, parseCsv, parseBounds };
