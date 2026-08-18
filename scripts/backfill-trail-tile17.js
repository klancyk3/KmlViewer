const { createConfig } = require('../server/config');
const { PostgresDatabase } = require('../server/database/postgresDatabase');
const { Tile17Repository } = require('../server/repositories/tile17Repository');
const { Tile17BackfillService } = require('../server/services/tile17BackfillService');
const { createProgressReporter } = require('./cli-progress');

async function main() {
    const config = createConfig();
    const database = new PostgresDatabase(config.databaseUrl);
    const reporter = createProgressReporter('Backfill Tile17');

    if (!database.isConfigured()) {
        throw new Error('DATABASE_URL is required to backfill Tile17 records');
    }

    const service = new Tile17BackfillService(
        new Tile17Repository(database),
        ({ current, total, detail }) => reporter.update(current, total, detail)
    );
    const summary = await service.backfill();

    reporter.finish(`Processed ${summary.processedTrails} trails`);
    console.log(
        `Tile17 backfill finished: ${summary.processedTrails} trails, ${summary.linkedTiles17} trail-tile links`
    );
}

main().catch(err => {
    console.error('Tile17 backfill failed:', err);
    process.exitCode = 1;
});
