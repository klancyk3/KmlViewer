const { createConfig } = require('../server/config');
const { PostgresDatabase } = require('../server/database/postgresDatabase');
const { SquadratRepository } = require('../server/repositories/squadratRepository');
const { SquadratTrailBackfillService } = require('../server/services/squadratTrailBackfillService');

async function main() {
    const config = createConfig();
    const database = new PostgresDatabase(config.databaseUrl);

    if (!database.isConfigured()) {
        throw new Error('DATABASE_URL is required to backfill trail squadrats');
    }

    const service = new SquadratTrailBackfillService(new SquadratRepository(database));
    const summary = await service.backfill();

    console.log(
        `Trail squadrat backfill finished: ${summary.processedTrails} trails, ${summary.linkedSquadrats} trail-squadrat links`
    );
}

main().catch(err => {
    console.error('Trail squadrat backfill failed:', err);
    process.exitCode = 1;
});
