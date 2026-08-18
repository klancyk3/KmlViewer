const express = require('express');
const cors = require('cors');
const { createConfig } = require('./server/config');
const { SavedGpxRepository } = require('./server/repositories/savedGpxRepository');
const { PostgisTrailRepository } = require('./server/repositories/postgisTrailRepository');
const { UserRepository } = require('./server/repositories/userRepository');
const { Tile17Repository } = require('./server/repositories/tile17Repository');
const { PostgresDatabase } = require('./server/database/postgresDatabase');
const { createUserContextMiddleware } = require('./server/middleware/userContextMiddleware');
const { createHealthRouter } = require('./server/routes/healthRoutes');
const { createSavedGpxRouter } = require('./server/routes/savedGpxRoutes');
const { createTrailRouter } = require('./server/routes/trailRoutes');

const config = createConfig();
const app = express();
const savedGpxRepository = new SavedGpxRepository(config.localGpxDir);
const database = new PostgresDatabase(config.databaseUrl);
const trailRepository = new PostgisTrailRepository(database);
const userRepository = new UserRepository(database);
const tile17Repository = new Tile17Repository(database);

app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(createUserContextMiddleware(userRepository));
app.use(express.static('.'));
app.use(createHealthRouter(database));
app.use(createSavedGpxRouter(savedGpxRepository, userRepository));
app.use(createTrailRouter(trailRepository, tile17Repository));

app.listen(config.port, () => {
    console.log(`KML Viewer server running at http://localhost:${config.port}`);
});
