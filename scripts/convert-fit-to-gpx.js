const fs = require('fs/promises');
const path = require('path');
const { default: FitParser } = require('fit-file-parser');

function printUsage() {
    console.log('Usage: node scripts/convert-fit-to-gpx.js <input-path> [output-dir] [--overwrite]');
    console.log('Examples:');
    console.log('  node scripts/convert-fit-to-gpx.js D:\\Tracks\\activity.fit');
    console.log('  node scripts/convert-fit-to-gpx.js D:\\Tracks\\Fit D:\\Tracks\\Gpx --overwrite');
}

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function formatIsoTime(value) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toISOString();
}

function buildTrackPoints(records) {
    return records
        .filter(record => Number.isFinite(record.position_lat) && Number.isFinite(record.position_long))
        .map(record => {
            const altitude = Number.isFinite(record.enhanced_altitude)
                ? record.enhanced_altitude
                : record.altitude;
            const time = formatIsoTime(record.timestamp);

            const lines = [
                `    <trkpt lat="${record.position_lat}" lon="${record.position_long}">`
            ];

            if (Number.isFinite(altitude)) {
                lines.push(`      <ele>${altitude}</ele>`);
            }

            if (time) {
                lines.push(`      <time>${time}</time>`);
            }

            lines.push('    </trkpt>');
            return lines.join('\n');
        });
}

function buildGpx({ trackName, trackPoints }) {
    const nameElement = trackName ? `    <name>${escapeXml(trackName)}</name>\n` : '';
    const segment = trackPoints.join('\n');

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="KmlViewer FIT Converter" xmlns="http://www.topografix.com/GPX/1/1">',
        '  <trk>',
        nameElement.trimEnd(),
        '    <trkseg>',
        segment,
        '    </trkseg>',
        '  </trk>',
        '</gpx>',
        ''
    ].filter(Boolean).join('\n');
}

async function collectFitFiles(inputPath) {
    const stats = await fs.stat(inputPath);
    if (stats.isFile()) {
        if (path.extname(inputPath).toLowerCase() !== '.fit') {
            throw new Error(`Input file is not a .fit file: ${inputPath}`);
        }

        return [inputPath];
    }

    if (!stats.isDirectory()) {
        throw new Error(`Input path is neither file nor directory: ${inputPath}`);
    }

    const entries = await fs.readdir(inputPath, { withFileTypes: true });
    return entries
        .filter(entry => entry.isFile() && path.extname(entry.name).toLowerCase() === '.fit')
        .map(entry => path.join(inputPath, entry.name))
        .sort((left, right) => left.localeCompare(right));
}

async function parseFitFile(filePath) {
    const content = await fs.readFile(filePath);
    const parser = new FitParser({
        mode: 'list',
        force: true,
        lengthUnit: 'm'
    });

    return parser.parseAsync(content);
}

async function convertFile(inputFile, outputDir, overwrite) {
    const parsed = await parseFitFile(inputFile);
    const records = Array.isArray(parsed.records) ? parsed.records : [];
    const trackPoints = buildTrackPoints(records);

    if (trackPoints.length === 0) {
        throw new Error('No GPS track points found in FIT file');
    }

    const session = Array.isArray(parsed.sessions) ? parsed.sessions[0] : null;
    const trackName = session && session.sport
        ? `${path.basename(inputFile, path.extname(inputFile))} (${session.sport})`
        : path.basename(inputFile, path.extname(inputFile));

    const outputFile = path.join(outputDir, `${path.basename(inputFile, path.extname(inputFile))}.gpx`);

    if (!overwrite) {
        try {
            await fs.access(outputFile);
            throw new Error(`Output file already exists: ${outputFile}`);
        }
        catch (error) {
            if (error && error.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    const gpxContent = buildGpx({ trackName, trackPoints });
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(outputFile, gpxContent, 'utf8');

    return outputFile;
}

function resolveOutputDir(inputPath, outputPath) {
    if (outputPath) {
        return path.resolve(outputPath);
    }

    const stats = require('fs').statSync(inputPath);
    return stats.isDirectory()
        ? path.join(path.resolve(inputPath), 'gpx')
        : path.dirname(path.resolve(inputPath));
}

async function main() {
    const args = process.argv.slice(2);
    const overwrite = args.includes('--overwrite');
    const positionalArgs = args.filter(arg => arg !== '--overwrite');

    if (positionalArgs.length < 1 || positionalArgs.length > 2) {
        printUsage();
        process.exitCode = 1;
        return;
    }

    const inputPath = path.resolve(positionalArgs[0]);
    const outputDir = resolveOutputDir(inputPath, positionalArgs[1]);
    const fitFiles = await collectFitFiles(inputPath);

    if (fitFiles.length === 0) {
        throw new Error(`No .fit files found in ${inputPath}`);
    }

    let convertedCount = 0;
    const failures = [];

    for (const fitFile of fitFiles) {
        try {
            const outputFile = await convertFile(fitFile, outputDir, overwrite);
            convertedCount += 1;
            console.log(`OK  ${path.basename(fitFile)} -> ${outputFile}`);
        }
        catch (error) {
            failures.push({ fitFile, message: error.message });
            console.error(`ERR ${path.basename(fitFile)} -> ${error.message}`);
        }
    }

    console.log(`Finished: ${convertedCount}/${fitFiles.length} files converted`);

    if (failures.length > 0) {
        process.exitCode = 1;
    }
}

main().catch(error => {
    console.error(`Conversion failed: ${error.message}`);
    process.exitCode = 1;
});
