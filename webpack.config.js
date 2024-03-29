const webpack = require('webpack');
const WebpackNotifierPlugin = require('webpack-notifier');
const path = require('path');
const { hostname } = require('os');

module.exports = function (env, argv) {
    const isProduction = argv.mode === 'production';
    const assetBaseURL = isProduction
        ? 'https://codehs.com/scratchjr_assets/'
        : 'http://localhost:8000/scratchjr_assets/';

    return {
        devtool: 'source-map',
        entry: {
            app: './src/entry/app.js'
        },
        output: {
            publicPath: assetBaseURL,
            path: path.resolve(__dirname, 'src/build/bundles'),
            filename: '[name].bundle.js'
        },
        performance: {
            hints: false
        },
        watchOptions: {
            ignored: ['node_modules', 'src/build/**/*']
        },
        module: {
            rules: [
                {
                    test: /\.js$/,
                    include: /node_modules/,
                    use: ['strip-sourcemap-loader']
                },
                {
                    test: /\.jsx?$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: ['@babel/preset-env']
                        }
                    }
                },
                {
                    test: /\.wasm$/,
                    type: 'javascript/auto'
                }
            ]
        },
        resolve: {
            fallback: {
                crypto: require.resolve('crypto-browserify'),
                path: require.resolve('path-browserify'),
                buffer: require.resolve('buffer/'),
                stream: require.resolve('stream-browserify'),
                vm: require.resolve('vm-browserify'),
                fs: false
            }
        },
        plugins: [
            new WebpackNotifierPlugin({
                title: 'ScratchJr',
                alwaysNotify: true
            }),
            // Define a global constant for asset URLs that can be used anywhere in the code
            new webpack.DefinePlugin({
                ASSET_BASE_URL: JSON.stringify(assetBaseURL)
            }),
            new webpack.ProvidePlugin({
                IntlMessageFormat: ['intl-messageformat', 'default']
            })
        ],
        devServer: {
            static: {
                directory: path.join(__dirname, 'editions/free/src')
            },
            compress: true,
            port: 3000,
            // https://stackoverflow.com/questions/31602697/webpack-dev-server-cors-issue
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods':
                    'GET, POST, PUT, DELETE, PATCH, OPTIONS',
                'Access-Control-Allow-Headers':
                    'X-Requested-With, content-type, Authorization'
            }
        }
    };
};
