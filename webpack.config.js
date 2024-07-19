const webpack = require('webpack');
const WebpackNotifierPlugin = require('webpack-notifier');
const path = require('path');
const cors = require('cors');


module.exports = function (env, argv) {
    // TODO: fix this crap
    // const isProduction = argv.mode === 'production';
    // const assetBaseURL = isProduction
    //     ? 'https://codehs.com/scratchjr_assets/'
    //     : 'http://localhost:8000/scratchjr_assets/';
    // const assetBaseURL = 'http://localhost:8000/scratchjr_assets/';
    // const assetBaseURL = 'http://localhost:3000/scratchjr_assets/';
    // const assetBaseURL = 'http://localhost:3000/';
    const assetBaseURL = 'https://do0bubigj0tft.cloudfront.net/';
    return {
      devtool: 'source-map',
      mode: 'development',
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
                    type: 'javascript/auto',
                    loader: 'file-loader',
                    options: {
                        name: '[name]-[contenthash].[ext]'
                    }
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
            // alias: {
            //     process: 'process/browser'
            // }
        },
        plugins: [
            new WebpackNotifierPlugin({
                title: 'ScratchJr',
                alwaysNotify: true
            }),
            // Define a global constant for asset URLs that can be used anywhere in the code
            new webpack.DefinePlugin({
                ASSET_BASE_URL: JSON.stringify(assetBaseURL)
                // process: 'process/browser'
            }),
            new webpack.ProvidePlugin({
                'window.IntlMessageFormat': ['intl-messageformat', 'default'],
                IntlMessageFormat: ['intl-messageformat', 'default']
            }),
            new webpack.HotModuleReplacementPlugin() // Enable hot reload
        ],
        devServer: {
            static: {
                directory: path.join(__dirname, 'editions/free/src')
            },
            compress: true,
            port: 3000,
            hot: true, // Enable hot reload
            setupMiddlewares: (middlewares, devServer) => {
                if (!devServer.app) {
                    throw new Error('webpack-dev-server is not defined');
                }
                devServer.app.use(cors());
                return middlewares;
            },
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
