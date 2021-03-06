/*
 * Copyright 2019 Nazmul Idris. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Karma configuration
// Generated on Sun Jun 23 2019 11:58:21 GMT-0700 (Pacific Daylight Time)

const webpackConfig = require('./webpack.prod');
const { exec }      = require('child_process');

module.exports = function(config) {
    config.set({
        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: '',

        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: ['jasmine'],

        // list of files / patterns to load in the browser
        files: [
            'test/test*.ts',
            'test/test*.js',
            {
                pattern: 'test/assets/**',
                watched: false,
                included: false,
                served: true
            }],

        // list of files / patterns to exclude
        exclude: [],

        // preprocess matching files before serving them to the browser
        // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {
            'test/**/*.ts': ['webpack'],
            'test/**/*.js': ['webpack']
        },
        webpack: {
            module: webpackConfig.module,
            resolve: webpackConfig.resolve,
            mode: webpackConfig.mode,
            devtool: 'inline-source-map'
        },

        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        reporters: ['spec'],

        // web server port
        port: 9876,

        // enable / disable colors in the output (reporters and logs)
        colors: true,

        // level of logging
        // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
        logLevel: config.LOG_INFO,

        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: true,

        // start these browsers
        // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
        browsers: ['Chrome'],

        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        singleRun: false,

        // Concurrency level
        // how many browser should be started simultaneous
        concurrency: Infinity,
        beforeMiddleware: ['checkXml'],
        plugins: [
            {
                'middleware:checkXml': ['factory', function(config) {
                    return function(request, response, next) {
                        if (request.url === '/tbaiCheckInvoiceXml' || request.url === '/tbaiCheckCancelInvoiceXml') {
                            response.writeHead(200);
                            var schema = "ticketBai V1-2.xsd";
                            if (request.url === '/tbaiCheckCancelInvoiceXml') {
                                schema = "Anula_ticketBai V1-2.xsd";
                            }
                            var cmd = 'cd "' + __dirname + '/test/tbai_validation/schemas"; env XML_CATALOG_FILES=catalog xmllint --schema "' + schema + '" --format -';
                            const child = exec(cmd, (error, stdout, stderr) => {
                                if (error) {
                                    response.end(stderr);
                                } else {
                                    response.end('ok');
                                }
                            });
                            request.on('data', (data) => child.stdin.write(data));
                            request.on('end', () => child.stdin.end());
                        } else {
                            next();
                        }
                    };
                }]
            },
            'karma-*'
        ]
    });
};
