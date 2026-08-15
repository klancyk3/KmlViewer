const express = require('express');

function createHealthRouter(database) {
    const router = express.Router();

    router.get('/health/db', async (req, res) => {
        try {
            res.json(await database.getHealth());
        } catch (err) {
            console.error('Database health check failed:', err);
            res.status(503).json({
                configured: database.isConfigured(),
                connected: false,
                error: err.message
            });
        }
    });

    return router;
}

module.exports = { createHealthRouter };
