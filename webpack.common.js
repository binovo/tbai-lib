var path = require('path'),
    ClosurePlugin = require('closure-webpack-plugin');

module.exports = {
    // Change to your "entry-point".
    mode: 'development',
    entry: './src/tbai.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'tbai.js',
        library: 'tbai',
        libraryTarget: 'umd'
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.json'],
        // default is "browser", "module", "main" which leads to the
        // incorrect file for xadesjs and xmlsig.
        mainFields: ["module", "browser", "main"]
    },
    optimization: {
        minimizer: [
            new ClosurePlugin({mode: 'STANDARD'}, {})
        ]
    },
    module: {
        rules: [{
            // Include ts, tsx, js, and jsx files.
            test: /\.(ts|js)x?$/,
            exclude: /node_modules/,
            loader: 'babel-loader',
            options: {
            }
        }]
    }
};
