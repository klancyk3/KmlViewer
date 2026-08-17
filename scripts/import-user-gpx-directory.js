const { createConfig } = require('../server/config');
const { PostgresDatabase } = require('../server/database/postgresDatabase');
const { GpxTrailImportRepository } = require('../server/repositories/gpxTrailImportRepository');
const { USER_ROUTE_REGION_KEY, USER_ROUTE_TRAIL_TYPE } = require('../server/repositories/postgisTrailRepository');
const { GpxDirectoryImporter } = require('../server/services/gpxDirectoryImporter');

async function main() {
    const config = createConfig();
    const database = new PostgresDatabase(config.databaseUrl);

    if (!database.isConfigured()) {
        throw new Error('DATABASE_URL is required to import user GPX files');
    }

    const importer = new GpxDirectoryImporter({
        sourceDir: config.userGpxDir,
        importRepository: new GpxTrailImportRepository(database),
        sourcePrefix: 'user',
        contextOverride: {
            regionKey: USER_ROUTE_REGION_KEY,
            regionName: 'Trasy użytkownika',
            trailType: USER_ROUTE_TRAIL_TYPE
        }
    });
    const summary = await importer.import();

    console.log(`User GPX import finished: ${summary.filesImported}/${summary.filesSeen} files, ${summary.segmentsImported} segments`);
}

main().catch(err => {
    console.error('User GPX import failed:', err);
    process.exitCode = 1;
});
