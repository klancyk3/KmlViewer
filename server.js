const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5174;
const externalGpxDir = process.env.EXTERNAL_GPX_DIR || 'D:\\Maps\\Gpx';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

app.post('/save-gpx', (req, res) => {
    const { filename, content } = req.body;
    if (!filename || !content) {
        return res.status(400).send('Missing filename or content');
    }

    const gpxDir = path.join(__dirname, 'gpxes');
    if (!fs.existsSync(gpxDir)) {
        fs.mkdirSync(gpxDir);
    }

    const filePath = path.join(gpxDir, filename);
    fs.writeFile(filePath, content, (err) => {
        if (err) {
            console.error('Error saving GPX:', err);
            return res.status(500).send('Error saving GPX');
        }
        console.log(`GPX saved: ${filename}`);
        res.send('GPX saved successfully');
    });
});

app.get('/gpx-files', (req, res) => {
    const gpxDir = path.join(__dirname, 'gpxes');

    if (!fs.existsSync(gpxDir)) {
        return res.json([]);
    }

    fs.readdir(gpxDir, (err, files) => {
        if (err) {
            console.error('Error reading GPX directory:', err);
            return res.status(500).send('Error reading GPX directory');
        }

        const gpxFiles = files
            .filter(file => file.toLowerCase().endsWith('.gpx'))
            .map(file => {
                const filePath = path.join(gpxDir, file);
                return {
                    filename: file,
                    content: fs.readFileSync(filePath, 'utf8')
                };
            });

        res.json(gpxFiles);
    });
});

function getTrailRegions() {
    if (!fs.existsSync(externalGpxDir)) return [];

    return fs.readdirSync(externalGpxDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => {
            const match = entry.name.match(/^(.+)-\d+$/);
            const key = entry.name;
            const name = match ? match[1] : entry.name;
            const regionDir = path.join(externalGpxDir, entry.name);

            return {
                key,
                name,
                types: ['foot', 'hiking'].filter(type => fs.existsSync(path.join(regionDir, type)))
            };
        })
        .filter(region => region.types.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

app.get('/trail-regions', (req, res) => {
    try {
        res.json(getTrailRegions());
    } catch (err) {
        console.error('Error reading trail regions:', err);
        res.status(500).send('Error reading trail regions');
    }
});

app.get('/trail-gpx', (req, res) => {
    const requestedRegions = String(req.query.regions || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
    const requestedTypes = String(req.query.types || '')
        .split(',')
        .map(value => value.trim())
        .filter(type => ['foot', 'hiking'].includes(type));

    if (requestedRegions.length === 0 || requestedTypes.length === 0) {
        return res.json([]);
    }

    try {
        const regionMap = new Map(getTrailRegions().map(region => [region.key, region]));
        const files = [];

        requestedRegions.forEach(regionKey => {
            const region = regionMap.get(regionKey);
            if (!region) return;

            requestedTypes.forEach(type => {
                if (!region.types.includes(type)) return;

                const typeDir = path.join(externalGpxDir, region.key, type);
                fs.readdirSync(typeDir)
                    .filter(file => file.toLowerCase().endsWith('.gpx'))
                    .forEach(file => {
                        const filePath = path.join(typeDir, file);
                        files.push({
                            filename: file,
                            region: region.key,
                            regionName: region.name,
                            trailType: type,
                            content: fs.readFileSync(filePath, 'utf8')
                        });
                    });
            });
        });

        res.json(files);
    } catch (err) {
        console.error('Error reading trail GPX files:', err);
        res.status(500).send('Error reading trail GPX files');
    }
});

app.listen(port, () => {
    console.log(`KML Viewer server running at http://localhost:${port}`);
});
