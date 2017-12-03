/* 
 * Copyright 2017 NueveBit, todos los derechos reservados.
 */

var path = require('path');

module.exports = {
    entry: "./src/gs/signal_tracker.js",
    output: {
        filename: "dist/extension.js",
        libraryTarget: 'umd',
    },
    resolve: {
        modules: [
            path.resolve('./src'),
            'node_modules'
        ]
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            require('babel-preset-env'),
                            require('babel-preset-es2017'),
                        ],
                        plugins: [
                            require('babel-plugin-transform-runtime'),
                            require('babel-plugin-transform-es2015-modules-umd'),
                        ]
                    }
                }
            }
        ]
    },
    externals: {
        'gnome': 'global',
        'lang': 'imports.lang',
        'gi/meta': 'imports.gi.Meta',
        'gi/shell': 'imports.gi.Shell',
        'ui/main': 'imports.ui.main',
        'ui/popupMenu': 'imports.ui.popupMenu',
        'ui/panelMenu': 'imports.ui.panelMenu',
        'gi/atk': 'imports.gi.Atk',
        'gi/st': 'imports.gi.St',
        'gi/gtk': 'imports.gi.Gtk',
        'gi/gdk': 'imports.gi.Gdk',
        'gi/gobject': 'imports.gi.GObject',
        'gi/gio': 'imports.gi.Gio',
        'gi/soup': 'imports.gi.Soup',
        'gi/glib': 'imports.gi.GLib',
        'gi/clutter': 'imports.gi.Clutter',
        'misc/config': 'imports.misc.config',
        'me': 'imports.misc.extensionUtils.getCurrentExtension()'
    }
};