/**
 * Gnome Shell Extension tasks.
 * 
 * @author emerino
 * 
 */

// sys deps
var fs = require('fs');
var path = require('path');
var zip = require('gulp-zip');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var argv = require("yargs").argv; // cmd arguments support

var babel = require('gulp-babel');
var KarmaServer = require('karma').Server;

// gulp plugins
var gulp = require("gulp");
var clean = require('gulp-clean');

//extension metadata
var metadata = JSON.parse(fs.readFileSync("metadata.json"));

var installDir = argv.installDir || path.join(process.env.HOME, ".local/share/gnome-shell/extensions/");

// local config
var config = {
    srcDir: path.join(__dirname, "src"),
    distDir: path.join(__dirname, "dist"),
    installDir: installDir + metadata.uuid,
    singleRun: argv.single || false,
    browser: argv.browser || "Firefox"
};

var enableExtension = function (enable, cb) {
    var option = enable ? "-e" : "-d";
    spawn("gnome-shell-extension-tool", [option, metadata.uuid], {stdio: "inherit"})
            .on("exit", function () {
                cb();
            });
};

var paths = {
    src: ['src/**.js', 'src/*/**.js'],
    dest: 'build/js',
    specSrc: 'test/unit/**/*.js',
    specDest: 'build/test',
    spec: 'build/test/*_spec.js'
};

function build(src, dst) {
    return gulp
            .src(src)
            .pipe(babel({
                presets: [
                    "env",
                    "es2017"
                ],
                plugins: [
                    "transform-runtime",
                    "transform-es2015-modules-umd"
                ],
                //moduleIds: true
            }))
            .pipe(gulp.dest(dst));
}

gulp.task('build-src', function () {
    return build(paths.src, paths.dest);
});

gulp.task('build-test', function () {
    return build(paths.specSrc, paths.specDest);
});

gulp.task("build", ["build-src", "build-test"]);

/**
 * Test tasks. Uses KARMA runner.
 */
gulp.task('test', function (done) {
    // Be sure to return the stream 
    var server = new KarmaServer({
        configFile: __dirname + '/test/karma.conf.js',
        singleRun: config.singleRun,
        browsers: [config.browser]
    }, function (exitCode) {
        if (exitCode) {
            process.exit(exitCode);
        } else {
            done();
        }
    });

    server.on('run_complete', function (browsers, results) {
        //done((results.error) ? results.error : null);
    });

    server.start();
});

/**
 * Clean dist dir
 */
gulp.task("clean", function () {
    return gulp.src([config.distDir]).pipe(clean());
});


/**
 * Create ZIP file for distribution to gse
 */
gulp.task("dist", ["build", "test"], function () {
    return gulp.src([
        "metadata.json",
        config.srcDir + "/**/*"
    ])
            .pipe(zip(metadata.uuid + ".zip"))
            .pipe(gulp.dest(config.distDir));
});

/**
 * Copy the extension to local extensions folder only
 */
gulp.task("copy:extension", function () {
    return gulp.src(["metadata.json", config.distDir + "/extension.js"])
            .pipe(gulp.dest(config.installDir));
});

/**
 * Enable extension.
 */
gulp.task("enable", function (cb) {
    enableExtension(true, cb);
});

/**
 * Disable extension.
 */
gulp.task("disable", function (cb) {
    enableExtension(false, cb);
});

/**
 * Install extension locally.
 */
gulp.task("install", ["copy:extension"], function (cb) {
    return gulp.start("enable");
});

/**
 * Uninstall extension locally. Removes install dir.
 */
gulp.task("uninstall", ["disable"], function (cb) {
    return gulp.src(config.installDir).pipe(clean({force: true}));
});


/**
 * Restart gnome shell task.
 */
gulp.task("restart:gnome-shell", ["copy:extension"], function () {
    var out = fs.openSync('./out.log', 'a');
    var err = fs.openSync('./out.log', 'a');
    var gs = spawn('gnome-shell', ["-r"], {detached: true});
    gs.stdout.on("data", function (chunk) {
        process.stdout.write(chunk.toString());
    });
    gs.stderr.on("data", function (chunk) {
        process.stdout.write(chunk.toString());
    });

    gs.unref();

});

/**
 * Watch files for changes and reinstall then restart gs
 */
gulp.task("default", ["build"], function () {
    gulp.watch([
        config.srcDir + "/**/*",
        "test/**/*.js"
    ], ["build"]);
});
