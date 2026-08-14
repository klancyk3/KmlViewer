const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5174;

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

app.listen(port, () => {
    console.log(`KML Viewer server running at http://localhost:${port}`);
});
