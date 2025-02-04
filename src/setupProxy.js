const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    app.use('/socket', createProxyMiddleware({
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true,
    }));
    app.use('/api/', createProxyMiddleware({
        target: 'http://localhost:8080',
        changeOrigin: true,
    }));
}
