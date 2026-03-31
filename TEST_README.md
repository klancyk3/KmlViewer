# KML Parser Unit Tests

This directory contains comprehensive unit tests for the KML Parser.

## Test Coverage

The test suite covers:

### Core Functionality
- **Constructor**: Initialization of parser and styles map
- **parse()**: Main parsing method with various KML structures
- **parseStyles()**: Global styles and StyleMap parsing
- **parseStyleNode()**: LineStyle and PolyStyle parsing

### Geometry Handling
- **extractGeometries()**: Point, LineString, Polygon, and MultiGeometry extraction
- **parseCoordinates()**: Coordinate parsing with various formats

### Utility Methods
- **kmlColorToCss()**: KML color format conversion to CSS rgba
- **getNodeValue()**: XML node value extraction

### Edge Cases
- Invalid or missing data
- Empty nodes
- Multiple placemarks
- Style merging (inline + referenced)
- Coordinate validation
- Color transparency handling

## Running Tests

### Install Dependencies
First, install the required npm packages:
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
Automatically re-run tests when files change:
```bash
npm run test:watch
```

### Run Tests with Coverage Report
Generate a detailed coverage report:
```bash
npm run test:coverage
```

The coverage report will be generated in the `coverage/` directory. Open `coverage/lcov-report/index.html` in a browser to view the detailed HTML report.

## Test Structure

Each test suite is organized by method/functionality:
- **describe()**: Groups related tests
- **test()**: Individual test cases
- **beforeEach()**: Sets up a fresh parser instance for each test

## Example Test Output

```
PASS  ./kml-parser.test.js
  KMLParser
    Constructor
      ✓ should initialize with empty styles map
      ✓ should initialize DOMParser
    kmlColorToCss
      ✓ should convert KML color to CSS rgba format
      ✓ should handle semi-transparent colors
      ...
```

## Writing Additional Tests

To add more tests, follow this pattern:

```javascript
test('should handle specific case', () => {
    const kml = `<kml>...</kml>`;
    const result = parser.parse(kml);
    expect(result).toBe(expectedValue);
});
```

## Dependencies

- **Jest**: Testing framework
- **jest-environment-jsdom**: Provides browser-like DOM environment
- **xmldom**: XML parsing for Node.js environment

## Troubleshooting

### DOMParser not defined
If you see "DOMParser is not defined", ensure `jest-environment-jsdom` is installed and configured in `jest.config.js`.

### Tests failing with XML parsing errors
Check that the KML strings in tests are properly formatted XML with correct namespaces.

### Module not found errors
Make sure all dependencies are installed with `npm install`.
