const { getClientIp, parseCookies } = require('./userContextMiddleware');

function createRequest(headers = {}, ip = '::ffff:127.0.0.1') {
    return {
        ip,
        socket: { remoteAddress: ip },
        get(name) {
            return headers[name.toLowerCase()] || null;
        }
    };
}

describe('userContextMiddleware helpers', () => {
    test('uses first x-forwarded-for address behind Azure proxy', () => {
        const req = createRequest({
            'x-forwarded-for': '83.10.20.30, 10.0.0.5'
        });

        expect(getClientIp(req)).toBe('83.10.20.30');
    });

    test('falls back to x-client-ip header', () => {
        const req = createRequest({
            'x-client-ip': '91.20.30.40'
        });

        expect(getClientIp(req)).toBe('91.20.30.40');
    });

    test('normalizes ipv4-mapped local address', () => {
        expect(getClientIp(createRequest({}, '::ffff:127.0.0.1'))).toBe('127.0.0.1');
    });

    test('parses cookies', () => {
        expect(parseCookies('a=1; kmlviewer_visitor_id=abc')).toEqual({
            a: '1',
            kmlviewer_visitor_id: 'abc'
        });
    });
});
