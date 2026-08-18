const fs = require('fs');
const os = require('os');
const path = require('path');
const { GpxDirectoryImporter } = require('./gpxDirectoryImporter');

function createImportRepositoryMock() {
    return {
        segments: [],
        summary: null,
        async createRun() {
            return 1;
        },
        async upsertTrailSegment(segment) {
            this.segments.push(segment);
        },
        async finishRun(runId, summary) {
            this.summary = { runId, ...summary };
        }
    };
}

describe('GpxDirectoryImporter', () => {
    let tempDir;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gpx-import-'));
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('imports track segments from GPX files with region and route metadata', async () => {
        const gpxDir = path.join(tempDir, 'dolnoslaskie-260813', 'hiking');
        fs.mkdirSync(gpxDir, { recursive: true });
        fs.writeFileSync(path.join(gpxDir, 'trail.gpx'), `<gpx xmlns:osmt="https://openstreetmap.org/trails">
            <metadata>
                <time>2026-08-17T06:30:00Z</time>
                <osmt:relation_id>123</osmt:relation_id>
                <osmt:colour>blue</osmt:colour>
            </metadata>
            <trk>
                <name>Blue Trail</name>
                <trkseg>
                    <trkpt lat="50" lon="19" />
                    <trkpt lat="51" lon="20" />
                </trkseg>
            </trk>
        </gpx>`);

        const repository = createImportRepositoryMock();
        const importer = new GpxDirectoryImporter({
            sourceDir: tempDir,
            importRepository: repository
        });

        const summary = await importer.import();

        expect(summary).toEqual({
            filesSeen: 1,
            filesImported: 1,
            segmentsImported: 1,
            error: null
        });
        expect(repository.segments[0]).toMatchObject({
            sourceFile: 'dolnoslaskie-260813/hiking/trail.gpx',
            sourceFileName: 'trail.gpx',
            regionKey: 'dolnoslaskie-260813',
            regionName: 'dolnoslaskie',
            trailType: 'hiking',
            trackName: 'Blue Trail',
            segmentIndex: 0,
            pointCount: 2,
            colour: 'blue',
            metadata: {
                relation_id: '123',
                colour: 'blue',
                time: '2026-08-17T06:30:00Z'
            }
        });
        expect(repository.segments[0].wkt).toBe('LINESTRING(19 50,20 51)');
    });

    test('imports TCX trackpoints as route segments', async () => {
        const userDir = path.join(tempDir, '2024');
        fs.mkdirSync(userDir, { recursive: true });
        fs.writeFileSync(path.join(userDir, 'activity.tcx'), `<TrainingCenterDatabase>
            <Activities>
                <Activity Sport="Running">
                    <Id>2024-01-02T12:00:00Z</Id>
                    <Lap>
                        <Track>
                            <Trackpoint>
                                <Position>
                                    <LatitudeDegrees>50.1</LatitudeDegrees>
                                    <LongitudeDegrees>19.1</LongitudeDegrees>
                                </Position>
                            </Trackpoint>
                            <Trackpoint>
                                <Position>
                                    <LatitudeDegrees>50.2</LatitudeDegrees>
                                    <LongitudeDegrees>19.2</LongitudeDegrees>
                                </Position>
                            </Trackpoint>
                        </Track>
                    </Lap>
                </Activity>
            </Activities>
        </TrainingCenterDatabase>`);

        const repository = createImportRepositoryMock();
        const importer = new GpxDirectoryImporter({
            sourceDir: tempDir,
            importRepository: repository,
            sourcePrefix: 'user',
            contextOverride: {
                regionKey: 'user-routes',
                regionName: 'Trasy użytkownika',
                trailType: 'user'
            }
        });

        const summary = await importer.import();

        expect(summary).toEqual({
            filesSeen: 1,
            filesImported: 1,
            segmentsImported: 1,
            error: null
        });
        expect(repository.segments[0]).toMatchObject({
            sourceFile: 'user/2024/activity.tcx',
            sourceFileName: 'activity.tcx',
            regionKey: 'user-routes',
            regionName: 'Trasy użytkownika',
            trailType: 'user',
            trackName: '2024-01-02T12:00:00Z',
            pointCount: 2,
            metadata: {
                sport: 'Running'
            }
        });
        expect(repository.segments[0].wkt).toBe('LINESTRING(19.1 50.1,19.2 50.2)');
    });
});
