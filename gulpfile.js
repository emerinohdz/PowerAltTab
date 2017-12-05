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
var argv = require("yargs").argv; // cmd arguments support

var webpack = require('webpack-stream');

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
    singleRun: argv.singleRun || false,
    browser: argv.browser || "PhantomJS",
    transpile: argv.transpile || false
};

var enableExtension = function (enable, cb) {
    var option = enable ? "-e" : "-d";
    spawn("gnome-shell-extension-tool", [option, metadata.uuid], {stdio: "inherit"})
            .on("exit", function () {
                cb();
            });
};

/**
 * Native GJS testing using jasmine-gjs.
 */
gulp.task("test", ["build"], function (cb) {
    spawn("jasmine", ["build/test.js"], {stdio: "inherit", stdout: "inherit"})
            .on("exit", function () {
                cb();
            });
});

/**
 * Clean build and dist dir
 */
gulp.task("clean", function () {
    return gulp.src([config.distDir, "build"]).pipe(clean());
});


/**
 * Copy the extension to local extensions folder or specified installDir
 */
gulp.task("copy:extension", function () {
    return gulp.src(["metadata.json", config.distDir + "/extension.js"])
            .pipe(gulp.dest(config.installDir));
});

/**
 * This task uses webpack to generate a single JS extension file. It will
 * use babel for transpiling and UMD for module handling.
 */
gulp.task('build', function () {
    var webpackConfig = require("./webpack.config.js");

    // transpile on demand
    if (config.transpile) {
        webpackConfig.module = {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /(node_modules|bower_components)/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                require('babel-preset-env'),
                            ],
                            plugins: [
                                require('babel-plugin-transform-runtime'),
                                require('babel-plugin-transform-es2015-modules-umd'),
                            ]
                        }
                    }
                },
            ]
        };
    }

    return webpack(webpackConfig)
            .pipe(gulp.dest("build"));
});

/**
 * Create ZIP file for distribution to GSE
 */
gulp.task("dist", ["build", "test"], function () {
    return gulp.src([
        "metadata.json",
        "build "+ "/extension.js"
    ])
            .pipe(zip(metadata.uuid + ".zip"))
            .pipe(gulp.dest(config.distDir));
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
 * Install extension locally (copies and enables).
 */
gulp.task("install", ["copy:extension"], function (cb) {
    return gulp.start("enable");
});

/**
 * Uninstall extension locally. Removes install dir and disables.
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

// run dist by default, which builds and tests the project
gulp.task("default", ["dist"]);
