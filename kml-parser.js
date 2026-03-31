class KMLParser {
    constructor() {
        this.parser = new DOMParser();
        this.styles = new Map();
    }

    parse(xmlString) {
        const xmlDoc = this.parser.parseFromString(xmlString, "text/xml");
        this.parseStyles(xmlDoc);

        const placemarks = xmlDoc.getElementsByTagName("Placemark");
        const features = [];

        for (let i = 0; i < placemarks.length; i++) {
            const placemark = placemarks[i];
            const name = this.getNodeValue(placemark, "name") || "Untitled";

            // Resolve style
            let style = null;
            const styleUrl = this.getNodeValue(placemark, "styleUrl");
            if (styleUrl) {
                const id = styleUrl.replace('#', '');
                style = this.styles.get(id);
            }

            // Check for inline style (overrides or provides style if missing)
            const inlineStyleNode = placemark.getElementsByTagName("Style")[0];
            if (inlineStyleNode) {
                // Parse inline style
                const inlineStyle = this.parseStyleNode(inlineStyleNode);
                style = style ? { ...style, ...inlineStyle } : inlineStyle;
            }

            // Try to extract different geometries
            const geometries = this.extractGeometries(placemark);
            if (geometries.length > 0) {
                features.push({
                    type: "feature",
                    name: name,
                    style: style,
                    geometries: geometries
                });
            }
        }

        return features;
    }

    parseStyles(xmlDoc) {
        this.styles.clear();

        // Parse Global Styles
        const styles = xmlDoc.getElementsByTagName("Style");
        for (let i = 0; i < styles.length; i++) {
            const node = styles[i];
            const id = node.getAttribute("id");
            if (!id) continue;

            this.styles.set(id, this.parseStyleNode(node));
        }

        // Parse StyleMap (Map Key/Pair to Url)
        // Usually maps normal/highlight to a styleUrl. We'll verify keys.
        const styleMaps = xmlDoc.getElementsByTagName("StyleMap");
        for (let i = 0; i < styleMaps.length; i++) {
            const node = styleMaps[i];
            const id = node.getAttribute("id");
            if (!id) continue;

            const pairs = node.getElementsByTagName("Pair");
            for (let j = 0; j < pairs.length; j++) {
                const key = this.getNodeValue(pairs[j], "key");
                const url = this.getNodeValue(pairs[j], "styleUrl");
                if (key === "normal" && url) {
                    const targetId = url.replace('#', '');
                    if (this.styles.has(targetId)) {
                        this.styles.set(id, this.styles.get(targetId));
                    }
                }
            }
        }
    }

    parseStyleNode(node) {
        const style = {};

        // LineStyle
        const lineStyle = node.getElementsByTagName("LineStyle")[0];
        if (lineStyle) {
            const color = this.getNodeValue(lineStyle, "color");
            const width = this.getNodeValue(lineStyle, "width");
            style.strokeColor = color ? this.kmlColorToCss(color) : null;
            style.strokeWidth = width ? parseFloat(width) : null;
        }

        // PolyStyle
        const polyStyle = node.getElementsByTagName("PolyStyle")[0];
        if (polyStyle) {
            const color = this.getNodeValue(polyStyle, "color");
            const fill = this.getNodeValue(polyStyle, "fill"); // 0 or 1
            const outline = this.getNodeValue(polyStyle, "outline"); // 0 or 1

            style.fillColor = color ? this.kmlColorToCss(color) : null;
            style.fill = fill !== "0"; // Default true
            style.outline = outline !== "0"; // Default true
        }

        return style;
    }

    kmlColorToCss(kmlColor) {
        // KML: aabbggrr (hex)
        // CSS: #rrggbb or rgba(r,g,b,a)
        if (!kmlColor || kmlColor.length !== 8) return kmlColor;

        const a = parseInt(kmlColor.substr(0, 2), 16) / 255;
        const b = parseInt(kmlColor.substr(2, 2), 16);
        const g = parseInt(kmlColor.substr(4, 2), 16);
        const r = parseInt(kmlColor.substr(6, 2), 16);

        return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
    }

    getNodeValue(parent, tagName) {
        const node = parent.getElementsByTagName(tagName)[0];
        return node ? node.textContent.trim() : null;
    }

    extractGeometries(node) {
        const geometries = [];

        // MultiGeometry
        const multiGeoms = node.getElementsByTagName("MultiGeometry");
        if (multiGeoms.length > 0) {
            for (let i = 0; i < multiGeoms.length; i++) {
                const subGeoms = this.extractGeometries(multiGeoms[i]);
                geometries.push(...subGeoms);
            }
            // Return early if we processed MultiGeometry, though legal KML might have siblings
            return geometries;
        }

        const polygons = node.getElementsByTagName("Polygon");
        for (let i = 0; i < polygons.length; i++) {
            const polygon = polygons[i];
            const outerRings = [];
            const innerRings = [];

            // Parse outer boundaries
            const outerBoundaries = polygon.getElementsByTagName("outerBoundaryIs");
            for (let j = 0; j < outerBoundaries.length; j++) {
                const coords = this.parseCoordinates(outerBoundaries[j]);
                if (coords.length > 0) {
                    outerRings.push(coords);
                }
            }

            // Parse inner boundaries
            const innerBoundaries = polygon.getElementsByTagName("innerBoundaryIs");
            for (let j = 0; j < innerBoundaries.length; j++) {
                const coords = this.parseCoordinates(innerBoundaries[j]);
                if (coords.length > 0) {
                    innerRings.push(coords);
                }
            }

            // Only add polygon if it has at least one outer ring
            if (outerRings.length > 0) {
                geometries.push({
                    type: "Polygon",
                    outerRings: outerRings,
                    innerRings: innerRings
                });
            }
        }

        const lineStrings = node.getElementsByTagName("LineString");
        for (let i = 0; i < lineStrings.length; i++) {
            const coords = this.parseCoordinates(lineStrings[i]);
            if (coords.length > 0) {
                geometries.push({ type: "LineString", coordinates: coords });
            }
        }

        const points = node.getElementsByTagName("Point");
        for (let i = 0; i < points.length; i++) {
            const coords = this.parseCoordinates(points[i]);
            if (coords.length > 0) {
                geometries.push({ type: "Point", coordinates: coords[0] });
            }
        }

        if (node.tagName === "LinearRing") {
            const coords = this.parseCoordinates(node);
            if (coords.length > 0) {
                geometries.push({ type: "LineString", coordinates: coords });
            }
        }

        return geometries;
    }

    parseCoordinates(node) {
        const coordNode = node.getElementsByTagName("coordinates")[0];
        if (!coordNode) return [];

        const text = coordNode.textContent.trim();
        return text.split(/\s+/).map(pair => {
            const parts = pair.split(',');
            if (parts.length < 2) return null;
            const lon = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            if (isNaN(lon) || isNaN(lat)) return null;
            return { lon: lon, lat: lat }; // Store as lon/lat
        }).filter(p => p !== null);
    }
}
