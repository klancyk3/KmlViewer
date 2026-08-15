const express = require('express');

function createSavedGpxRouter(savedGpxRepository) {
    const router = express.Router();

    router.post('/save-gpx', (req, res) => {
        const { filename, content } = req.body;
        if (!filename || !content) {
            return res.status(400).send('Missing filename or content');
        }

        savedGpxRepository.save(filename, content, (err) => {
            if (err) {
                console.error('Error saving GPX:', err);
                return res.status(500).send('Error saving GPX');
            }

            console.log(`GPX saved: ${filename}`);
            res.send('GPX saved successfully');
        });
    });

    router.get('/gpx-files', (req, res) => {
        try {
            res.json(savedGpxRepository.list());
        } catch (err) {
            console.error('Error reading GPX directory:', err);
            res.status(500).send('Error reading GPX directory');
        }
    });

    return router;
}

module.exports = { createSavedGpxRouter };
