const express = require('express');
const cors = require('cors');
const { createConfig } = require('./server/config');
const { SavedGpxRepository } = require('./server/repositories/savedGpxRepository');
const { TrailRepository } = require('./server/repositories/trailRepository');
const { createSavedGpxRouter } = require('./server/routes/savedGpxRoutes');
const { createTrailRouter } = require('./server/routes/trailRoutes');

const config = createConfig();
const app = express();
const savedGpxRepository = new SavedGpxRepository(config.localGpxDir);
const trailRepository = new TrailRepository(config.externalGpxDir);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));
app.use(createSavedGpxRouter(savedGpxRepository));
app.use(createTrailRouter(trailRepository));

app.listen(config.port, () => {
    console.log(`KML Viewer server running at http://localhost:${config.port}`);
});
