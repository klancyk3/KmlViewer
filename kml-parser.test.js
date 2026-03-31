/**
 * Unit Tests for KMLParser
 * 
 * These tests cover:
 * - Basic parsing functionality
 * - Style parsing (inline and referenced)
 * - StyleMap handling
 * - Geometry extraction (Point, LineString, Polygon, MultiGeometry)
 * - Coordinate parsing
 * - Color conversion
 * - Edge cases and error handling
 */

// Mock DOMParser for Node.js environment
if (typeof DOMParser === 'undefined') {
    global.DOMParser = require('xmldom').DOMParser;
}

describe('KMLParser', () => {
    let parser;

    beforeEach(() => {
        parser = new KMLParser();
    });

    describe('Constructor', () => {
        test('should initialize with empty styles map', () => {
            expect(parser.styles).toBeInstanceOf(Map);
            expect(parser.styles.size).toBe(0);
        });

        test('should initialize DOMParser', () => {
            expect(parser.parser).toBeDefined();
        });
    });

    describe('kmlColorToCss', () => {
        test('should convert KML color to CSS rgba format', () => {
            const result = parser.kmlColorToCss('ff0000ff');
            expect(result).toBe('rgba(255, 0, 0, 1.00)');
        });

        test('should handle semi-transparent colors', () => {
            const result = parser.kmlColorToCss('80ff0000');
            expect(result).toMatch(/rgba\(0, 0, 255, 0\.50\)/);
        });

        test('should handle fully transparent colors', () => {
            const result = parser.kmlColorToCss('00ffffff');
            expect(result).toBe('rgba(255, 255, 255, 0.00)');
        });

        test('should return original value if invalid length', () => {
            expect(parser.kmlColorToCss('fff')).toBe('fff');
            expect(parser.kmlColorToCss('ffffffffff')).toBe('ffffffffff');
        });

        test('should handle null or undefined', () => {
            expect(parser.kmlColorToCss(null)).toBe(null);
            expect(parser.kmlColorToCss(undefined)).toBe(undefined);
        });
    });

    describe('getNodeValue', () => {
        test('should extract text content from node', () => {
            const kml = '<root><name>Test Name</name></root>';
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            const result = parser.getNodeValue(xmlDoc.documentElement, 'name');
            expect(result).toBe('Test Name');
        });

        test('should trim whitespace', () => {
            const kml = '<root><name>  Test Name  </name></root>';
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            const result = parser.getNodeValue(xmlDoc.documentElement, 'name');
            expect(result).toBe('Test Name');
        });

        test('should return null if node not found', () => {
            const kml = '<root></root>';
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            const result = parser.getNodeValue(xmlDoc.documentElement, 'name');
            expect(result).toBe(null);
        });
    });

    describe('parseCoordinates', () => {
        test('should parse single coordinate pair', () => {
            const kml = '<Point><coordinates>-122.0822035425683,37.42228990140251</coordinates></Point>';
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            const result = parser.parseCoordinates(xmlDoc.documentElement);
            expect(result).toEqual([
                { lon: -122.0822035425683, lat: 37.42228990140251 }
            ]);
        });

        test('should parse multiple coordinate pairs', () => {
            const kml = `<LineString>
                <coordinates>
                    -122.08,37.42 -122.09,37.43 -122.10,37.44
                </coordinates>
            </LineString>`;
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            const result = parser.parseCoordinates(xmlDoc.documentElement);
            expect(result).toHaveLength(3);
            expect(result[0]).toEqual({ lon: -122.08, lat: 37.42 });
            expect(result[2]).toEqual({ lon: -122.10, lat: 37.44 });
        });

        test('should handle coordinates with altitude', () => {
            const kml = '<Point><coordinates>-122.08,37.42,100</coordinates></Point>';
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            const result = parser.parseCoordinates(xmlDoc.documentElement);
            expect(result).toEqual([
                { lon: -122.08, lat: 37.42 }
            ]);
        });

        test('should filter out invalid coordinates', () => {
            const kml = '<LineString><coordinates>-122.08,37.42 invalid,data -122.10,37.44</coordinates></LineString>';
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            const result = parser.parseCoordinates(xmlDoc.documentElement);
            expect(result).toHaveLength(2);
        });

        test('should return empty array if no coordinates node', () => {
            const kml = '<Point></Point>';
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            const result = parser.parseCoordinates(xmlDoc.documentElement);
            expect(result).toEqual([]);
        });
    });

    describe('parseStyleNode', () => {
        test('should parse LineStyle', () => {
            const kml = `<Style>
                <LineStyle>
                    <color>ff0000ff</color>
                    <width>3</width>
                </LineStyle>
            </Style>`;
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            const result = parser.parseStyleNode(xmlDoc.documentElement);
            expect(result.strokeColor).toBe('rgba(255, 0, 0, 1.00)');
            expect(result.strokeWidth).toBe(3);
        });

        test('should parse PolyStyle', () => {
            const kml = `<Style>
                <PolyStyle>
                    <color>8000ff00</color>
                    <fill>1</fill>
                    <outline>0</outline>
                </PolyStyle>
            </Style>`;
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            const result = parser.parseStyleNode(xmlDoc.documentElement);
            expect(result.fillColor).toMatch(/rgba\(0, 255, 0, 0\.50\)/);
            expect(result.fill).toBe(true);
            expect(result.outline).toBe(false);
        });

        test('should parse both LineStyle and PolyStyle', () => {
            const kml = `<Style>
                <LineStyle>
                    <color>ff0000ff</color>
                    <width>2</width>
                </LineStyle>
                <PolyStyle>
                    <color>8000ff00</color>
                </PolyStyle>
            </Style>`;
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            const result = parser.parseStyleNode(xmlDoc.documentElement);
            expect(result.strokeColor).toBeDefined();
            expect(result.fillColor).toBeDefined();
        });

        test('should handle empty style node', () => {
            const kml = '<Style></Style>';
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            const result = parser.parseStyleNode(xmlDoc.documentElement);
            expect(result).toEqual({});
        });
    });

    describe('extractGeometries', () => {
        test('should extract Point geometry', () => {
            const kml = `<Placemark>
                <Point>
                    <coordinates>-122.08,37.42</coordinates>
                </Point>
            </Placemark>`;
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            const result = parser.extractGeometries(xmlDoc.documentElement);
            expect(result).toHaveLength(1);
            expect(result[0].type).toBe('Point');
            expect(result[0].coordinates).toEqual({ lon: -122.08, lat: 37.42 });
        });

        test('should extract LineString geometry', () => {
            const kml = `<Placemark>
                <LineString>
                    <coordinates>-122.08,37.42 -122.09,37.43</coordinates>
                </LineString>
            </Placemark>`;
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            const result = parser.extractGeometries(xmlDoc.documentElement);
            expect(result).toHaveLength(1);
            expect(result[0].type).toBe('LineString');
            expect(result[0].coordinates).toHaveLength(2);
        });

        test('should extract Polygon geometry', () => {
            const kml = `<Placemark>
                <Polygon>
                    <outerBoundaryIs>
                        <LinearRing>
                            <coordinates>-122.08,37.42 -122.09,37.43 -122.08,37.44 -122.08,37.42</coordinates>
                        </LinearRing>
                    </outerBoundaryIs>
                </Polygon>
            </Placemark>`;
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            const result = parser.extractGeometries(xmlDoc.documentElement);
            expect(result).toHaveLength(1);
            expect(result[0].type).toBe('Polygon');
            expect(result[0].coordinates).toHaveLength(4);
        });

        test('should extract MultiGeometry', () => {
            const kml = `<Placemark>
                <MultiGeometry>
                    <Point>
                        <coordinates>-122.08,37.42</coordinates>
                    </Point>
                    <LineString>
                        <coordinates>-122.08,37.42 -122.09,37.43</coordinates>
                    </LineString>
                </MultiGeometry>
            </Placemark>`;
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            const result = parser.extractGeometries(xmlDoc.documentElement);
            expect(result.length).toBeGreaterThanOrEqual(2);
        });

        test('should return empty array for no geometries', () => {
            const kml = '<Placemark></Placemark>';
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            const result = parser.extractGeometries(xmlDoc.documentElement);
            expect(result).toEqual([]);
        });
    });

    describe('parseStyles', () => {
        test('should parse global styles with IDs', () => {
            const kml = `<kml>
                <Document>
                    <Style id="style1">
                        <LineStyle>
                            <color>ff0000ff</color>
                        </LineStyle>
                    </Style>
                </Document>
            </kml>`;
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            parser.parseStyles(xmlDoc);
            expect(parser.styles.has('style1')).toBe(true);
            expect(parser.styles.get('style1').strokeColor).toBeDefined();
        });

        test('should ignore styles without IDs', () => {
            const kml = `<kml>
                <Document>
                    <Style>
                        <LineStyle>
                            <color>ff0000ff</color>
                        </LineStyle>
                    </Style>
                </Document>
            </kml>`;
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            parser.parseStyles(xmlDoc);
            expect(parser.styles.size).toBe(0);
        });

        test('should parse StyleMap with normal key', () => {
            const kml = `<kml>
                <Document>
                    <Style id="normalStyle">
                        <LineStyle>
                            <color>ff0000ff</color>
                        </LineStyle>
                    </Style>
                    <StyleMap id="styleMap1">
                        <Pair>
                            <key>normal</key>
                            <styleUrl>#normalStyle</styleUrl>
                        </Pair>
                    </StyleMap>
                </Document>
            </kml>`;
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            parser.parseStyles(xmlDoc);
            expect(parser.styles.has('styleMap1')).toBe(true);
            expect(parser.styles.get('styleMap1')).toEqual(parser.styles.get('normalStyle'));
        });

        test('should clear existing styles before parsing', () => {
            parser.styles.set('oldStyle', {});
            const kml = '<kml><Document></Document></kml>';
            const xmlDoc = parser.parser.parseFromString(kml, 'text/xml');
            parser.parseStyles(xmlDoc);
            expect(parser.styles.has('oldStyle')).toBe(false);
        });
    });

    describe('parse', () => {
        test('should parse simple placemark with name', () => {
            const kml = `<?xml version="1.0" encoding="UTF-8"?>
                <kml xmlns="http://www.opengis.net/kml/2.2">
                    <Document>
                        <Placemark>
                            <name>Test Place</name>
                            <Point>
                                <coordinates>-122.08,37.42</coordinates>
                            </Point>
                        </Placemark>
                    </Document>
                </kml>`;
            const result = parser.parse(kml);
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Test Place');
            expect(result[0].type).toBe('feature');
        });

        test('should use "Untitled" for placemarks without name', () => {
            const kml = `<kml>
                <Placemark>
                    <Point>
                        <coordinates>-122.08,37.42</coordinates>
                    </Point>
                </Placemark>
            </kml>`;
            const result = parser.parse(kml);
            expect(result[0].name).toBe('Untitled');
        });

        test('should resolve styleUrl references', () => {
            const kml = `<kml>
                <Document>
                    <Style id="myStyle">
                        <LineStyle>
                            <color>ff0000ff</color>
                        </LineStyle>
                    </Style>
                    <Placemark>
                        <styleUrl>#myStyle</styleUrl>
                        <Point>
                            <coordinates>-122.08,37.42</coordinates>
                        </Point>
                    </Placemark>
                </Document>
            </kml>`;
            const result = parser.parse(kml);
            expect(result[0].style).toBeDefined();
            expect(result[0].style.strokeColor).toBeDefined();
        });

        test('should handle inline styles', () => {
            const kml = `<kml>
                <Placemark>
                    <Style>
                        <LineStyle>
                            <color>ff00ff00</color>
                        </LineStyle>
                    </Style>
                    <Point>
                        <coordinates>-122.08,37.42</coordinates>
                    </Point>
                </Placemark>
            </kml>`;
            const result = parser.parse(kml);
            expect(result[0].style).toBeDefined();
        });

        test('should merge inline style with referenced style', () => {
            const kml = `<kml>
                <Document>
                    <Style id="baseStyle">
                        <LineStyle>
                            <color>ff0000ff</color>
                            <width>2</width>
                        </LineStyle>
                    </Style>
                    <Placemark>
                        <styleUrl>#baseStyle</styleUrl>
                        <Style>
                            <PolyStyle>
                                <color>8000ff00</color>
                            </PolyStyle>
                        </Style>
                        <Point>
                            <coordinates>-122.08,37.42</coordinates>
                        </Point>
                    </Placemark>
                </Document>
            </kml>`;
            const result = parser.parse(kml);
            expect(result[0].style.strokeColor).toBeDefined();
            expect(result[0].style.fillColor).toBeDefined();
        });

        test('should skip placemarks without geometries', () => {
            const kml = `<kml>
                <Placemark>
                    <name>No Geometry</name>
                </Placemark>
            </kml>`;
            const result = parser.parse(kml);
            expect(result).toHaveLength(0);
        });

        test('should parse multiple placemarks', () => {
            const kml = `<kml>
                <Document>
                    <Placemark>
                        <name>Place 1</name>
                        <Point>
                            <coordinates>-122.08,37.42</coordinates>
                        </Point>
                    </Placemark>
                    <Placemark>
                        <name>Place 2</name>
                        <Point>
                            <coordinates>-122.09,37.43</coordinates>
                        </Point>
                    </Placemark>
                </Document>
            </kml>`;
            const result = parser.parse(kml);
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Place 1');
            expect(result[1].name).toBe('Place 2');
        });

        test('should handle complex KML with all features', () => {
            const kml = `<?xml version="1.0" encoding="UTF-8"?>
                <kml xmlns="http://www.opengis.net/kml/2.2">
                    <Document>
                        <Style id="polygonStyle">
                            <LineStyle>
                                <color>ff0000ff</color>
                                <width>2</width>
                            </LineStyle>
                            <PolyStyle>
                                <color>40ffffff</color>
                                <fill>1</fill>
                                <outline>1</outline>
                            </PolyStyle>
                        </Style>
                        <Placemark>
                            <name>Test Polygon</name>
                            <styleUrl>#polygonStyle</styleUrl>
                            <Polygon>
                                <outerBoundaryIs>
                                    <LinearRing>
                                        <coordinates>
                                            -122.08,37.42 -122.09,37.42 -122.09,37.43 -122.08,37.43 -122.08,37.42
                                        </coordinates>
                                    </LinearRing>
                                </outerBoundaryIs>
                            </Polygon>
                        </Placemark>
                    </Document>
                </kml>`;
            const result = parser.parse(kml);
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Test Polygon');
            expect(result[0].style).toBeDefined();
            expect(result[0].geometries).toHaveLength(1);
            expect(result[0].geometries[0].type).toBe('Polygon');
        });
    });
});
