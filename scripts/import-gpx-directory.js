const { createConfig } = require('../server/config');
const { PostgresDatabase } = require('../server/database/postgresDatabase');
const { GpxTrailImportRepository } = require('../server/repositories/gpxTrailImportRepository');
const { GpxDirectoryImporter } = require('../server/services/gpxDirectoryImporter');

async function main() {
    const config = createConfig();
    const database = new PostgresDatabase(config.databaseUrl);

    if (!database.isConfigured()) {
        throw new Error('DATABASE_URL is required to import GPX files');
    }

const importer = new GpxDirectoryImporter({
        sourceDir: config.externalGpxDir,
        importRepository: new GpxTrailImportRepository(database)
    });
    const summary = await importer.import();

    console.log(`GPX import finished: ${summary.filesImported}/${summary.filesSeen} files, ${summary.segmentsImported} segments`);
}

main().catch(err => {
    console.error('GPX import failed:', err);
    process.exitCode = 1;
});
