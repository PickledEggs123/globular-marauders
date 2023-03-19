const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
    entry: './server/setup.js',
    target: 'node',
    externals: [
        function ({ context, request }, callback) {
            if (/pixi/.test(request)) {
                // Externalize
                return callback(null, 'super_stub');
            }

            // Continue without externalizing the import
            callback();
        },
        nodeExternals(),
    ],
    output: {
        path: path.resolve('server-build'),
        filename: 'index.js'
    },
    module: {
        rules: [
            {
                test: /\.mjs$/,
                include: /node_modules/,
                type: 'javascript/auto'
            },
            {
                test: /\.[jt]sx?$/,
                exclude: [
                    /(node_modules)/,
                ],
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: ["@babel/preset-env", "@babel/preset-react", "@babel/preset-typescript"],
                            plugins: [
                                "babel-plugin-transform-scss",
                            ]
                        },
                    },
                    {
                        loader: 'ts-loader',
                        options: {
                            compilerOptions: {
                                noEmit: false,
                            },
                        },
                    },
                ],
            },
            {
                test: /\.svg$/,
                use: [
                    {
                        loader: 'babel-loader',
                    },
                    {
                        loader: 'react-svg-loader',
                        options: {
                            svgo: {
                                plugins: [{ removeTitle: false }],
                                floatPrecision: 2
                            },
                            jsx: true
                        }
                    }
                ],
            },
            {
                test: /\.json$/,
                use: [
                    {
                        loader: 'babel-loader',
                    },
                    {
                        loader: 'json-loader'
                    }
                ],
            },
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.jsx', '.mjs'],
    },
};