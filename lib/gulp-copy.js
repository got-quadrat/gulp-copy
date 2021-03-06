'use strict';

var through = require('through2');
var path = require('path');
var fs = require('fs');
var PluginError = require('gulp-util').PluginError;
var minimatch = require('minimatch');

/**
 * gulp copy method
 * @param {string} destination
 * @param {object} opts
 * @returns {object}
 */
function gulpCopy (destination, opts)
{
    var throughOptions = { objectMode: true },
        isString = typeof destination === 'string';

    // Make sure a destination was verified
    if (!isString && typeof destination !== 'object') {
        throw new PluginError('gulp-copy', 'No valid destination specified');
    }

    // Default options
    if (opts === undefined) {
        opts = opts || {};
    }
    else if (typeof opts !== 'object' || opts === null) {
        throw new PluginError('gulp-copy', 'No valid options specified');
    }

    return through(throughOptions, transform);

    /**
     * Transform method, copies the file to its new destination
     * @param {object} file
     * @param {string} encoding
     * @param {function} cb
     */
    function transform(file, encoding, cb)
    {
        var origRel = null, rel = null;
        var fileDestination = null;
        var rightDestination = null;

        if (file.isStream()) {
            return cb(new PluginError('gulp-copy', 'Streaming not supported'));
        }

        if (!file.isNull()) {
            origRel = rel = path.relative(file.cwd, file.path).replace(/\\/g, '/');

            // Strip path prefixes
            if (opts.prefix) {
                var p = opts.prefix;
                while (p-- > 0) {
                    rel = rel.substring(rel.indexOf('/') + 1);
                }
            }


            if (isString) {
                rightDestination = destination;
            } else {
                for (var globPattern in destination) if (destination.hasOwnProperty(globPattern)) {
                    if (minimatch(origRel, globPattern, {debug:false})) {
                        rightDestination = destination[globPattern];
                        break;
                    }
                }
                if (rightDestination === null) {
                    return cb(new PluginError("gulp-copy", "No destination found for \"" + rel + "\""));
                }

            }

            fileDestination = rightDestination + '/' + rel;

            // Make sure destination exists
            if (!doesPathExist(fileDestination)) {
                createDestination(fileDestination.substr(0, fileDestination.lastIndexOf('/')));
            }

            // Copy the file
            copyFile(file.path, fileDestination, function (error) {
                if (error) {
                    throw new PluginError('gulp-copy', 'Could not copy file <' +  file.path + '>: ' + error.message);
                }

                // Update path for file so this path is used later on
                file.path = fileDestination;
                cb(null, file);
            });
        }
        else {
            cb(null, file);
        }
    }
}

/**
 * Recursively creates the path
 * @param {string} destination
 */
function createDestination(destination)
{
    var folders = destination.split('/');
    var path = [];
    var l = folders.length;
    var i = 0;

    for (i; i < l; i++) {
        path.push(folders[i]);

        if (folders[i] !== '' && !doesPathExist(path.join('/'))) {
            try {
                fs.mkdirSync(path.join('/'));
            } catch (error) {
                throw new PluginError('gulp-copy', 'Could not create destination <' +  destination + '>: ' + error.message);
            }
        }
    }
}

/**
 * Check if the path exists
 * @param path
 * @returns {boolean}
 */
function doesPathExist (path)
{
    var pathExists = true;

    try {
        fs.accessSync(path);
    }
    catch (error) {
        pathExists = false;
    }

    return pathExists;
}

/**
 * Copy a file to its new destination
 * @param {string} source
 * @param {string} target
 * @param {function} copyCallback
 */
function copyFile (source, target, copyCallback)
{
    var done = false;
    var readStream = fs.createReadStream(source);
    var writeStream = fs.createWriteStream(target);

    readStream.on('error', copyDone);
    writeStream.on('error', copyDone);

    writeStream.on('close', function() {
        copyDone(null);
    });

    readStream.pipe(writeStream);

    /**
     * Finish copying. Reports error when needed
     * @param [error] optional error
     */
    function copyDone (error)
    {
        if (!done) {
            done = true;
            copyCallback(error);
        }
    }
}

module.exports = gulpCopy;
