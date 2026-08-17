const crypto = require('crypto');

const VISITOR_COOKIE = 'kmlviewer_visitor_id';

function createUserContextMiddleware(userRepository) {
    return async (req, res, next) => {
        const userId = getOrCreateUserId(req, res);
        const context = {
            userId,
            ipAddress: getClientIp(req),
            userAgent: req.get('user-agent') || null,
            path: req.path,
            method: req.method
        };

        req.userContext = context;

        try {
            await userRepository.upsertUser(context);
        } catch (err) {
            console.error('Could not persist user context:', err);
        }

        next();
    };
}

function getOrCreateUserId(req, res) {
    const cookies = parseCookies(req.headers.cookie || '');
    const existing = cookies[VISITOR_COOKIE];
    if (existing && isUuid(existing)) return existing;

    const userId = crypto.randomUUID();
    res.setHeader('Set-Cookie', `${VISITOR_COOKIE}=${userId}; Path=/; SameSite=Lax; Max-Age=31536000`);
    return userId;
}

function parseCookies(cookieHeader) {
    return cookieHeader
        .split(';')
        .map(part => part.trim())
        .filter(Boolean)
        .reduce((cookies, part) => {
            const separatorIndex = part.indexOf('=');
            if (separatorIndex === -1) return cookies;

            cookies[part.slice(0, separatorIndex)] = decodeURIComponent(part.slice(separatorIndex + 1));
            return cookies;
        }, {});
}

function getClientIp(req) {
    const forwardedFor = firstHeaderValue(req.get('x-forwarded-for'));
    const azureClientIp = firstHeaderValue(req.get('x-client-ip'));
    const realIp = firstHeaderValue(req.get('x-real-ip'));
    const cloudflareIp = firstHeaderValue(req.get('cf-connecting-ip'));
    const socketIp = req.ip || req.socket?.remoteAddress || null;

    return normalizeIp(forwardedFor || azureClientIp || realIp || cloudflareIp || socketIp);
}

function firstHeaderValue(value) {
    if (!value) return null;
    return String(value).split(',')[0].trim() || null;
}

function normalizeIp(value) {
    if (!value) return null;

    const withoutPrefix = String(value).replace(/^::ffff:/, '');
    if (withoutPrefix === '::1') return '127.0.0.1';

    return withoutPrefix;
}

function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

module.exports = {
    VISITOR_COOKIE,
    createUserContextMiddleware,
    getClientIp,
    parseCookies
};
