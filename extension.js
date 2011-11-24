
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Shell = imports.gi.Shell;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const Meta = imports.gi.Meta;
const Lang = imports.lang;
const AltTab = imports.ui.altTab;

const THUMBNAIL_DEFAULT_SIZE = 256;
const POPUP_DELAY_TIMEOUT = 150; // milliseconds

function ThumbnailList(windows) {
    this._init(windows);
}


ThumbnailList.prototype = {
    __proto__ : AltTab.SwitcherList.prototype,

    _init : function(windows) {
        AltTab.SwitcherList.prototype._init.call(this);

        this._labels = new Array();
        this._thumbnailBins = new Array();
        this._clones = new Array();
        this._windows = windows;

        for (let i = 0; i < windows.length; i++) {
            let box = new St.BoxLayout({ style_class: 'thumbnail-box',
                                         vertical: true });

            let bin = new St.Bin({ style_class: 'thumbnail' });

            box.add_actor(bin);
            this._thumbnailBins.push(bin);

            let title = windows[i].get_title();
            if (title) {
                let name = new St.Label({ text: title });
                // St.Label doesn't support text-align so use a Bin
                let bin = new St.Bin({ x_align: St.Align.MIDDLE });
                this._labels.push(bin);
                bin.add_actor(name);
                box.add_actor(bin);

                this.addItem(box, name);
            } else {
                this.addItem(box, null);
            }

        }
    },

    addClones : function (availHeight) {
        if (!this._thumbnailBins.length)
            return;

        let totalPadding = this._items[0].get_theme_node().get_horizontal_padding() + this._items[0].get_theme_node().get_vertical_padding();
        totalPadding += this.actor.get_theme_node().get_horizontal_padding() + this.actor.get_theme_node().get_vertical_padding();
        let [labelMinHeight, labelNaturalHeight] = this._labels[0].get_preferred_height(-1);
        let spacing = this._items[0].child.get_theme_node().get_length('spacing');

        availHeight = Math.min(availHeight - labelNaturalHeight - totalPadding - spacing, THUMBNAIL_DEFAULT_SIZE);
        let binHeight = availHeight + this._items[0].get_theme_node().get_vertical_padding() + this.actor.get_theme_node().get_vertical_padding() - spacing;
        binHeight = Math.min(THUMBNAIL_DEFAULT_SIZE, binHeight);

        for (let i = 0; i < this._thumbnailBins.length; i++) {
            let mutterWindow = this._windows[i].get_compositor_private();
            if (!mutterWindow)
                continue;

            let windowTexture = mutterWindow.get_texture ();
            let [width, height] = windowTexture.get_size();
            let scale = Math.min(1.0, THUMBNAIL_DEFAULT_SIZE / width, availHeight / height);
            let clone = new Clutter.Clone ({ source: windowTexture,
                                                reactive: true,
                                                width: width * scale,
                                                height: height * scale });

            this._thumbnailBins[i].set_height(binHeight);
            this._thumbnailBins[i].add_actor(clone);
            this._clones.push(clone);
        }

        // Make sure we only do this once
        this._thumbnailBins = new Array();
    }
};
function SimpleAltTab() {
	this._init();
}

SimpleAltTab.prototype = {
	_init: function() {
        let tracker = Shell.WindowTracker.get_default();
//        tracker.connect('notify::focus-app', Lang.bind(this, this._focusChanged));

        this.actor = new Shell.GenericContainer({ name: 'altTabInvisiblePopup',
                                                  reactive: true,
                                                  visible: false });

        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
//		this.actor.set_size(1280, 800);
//		this.actor.set_x(0);
//		this.actor.set_y(0);

        Main.uiGroup.add_actor(this.actor);

		this._haveModal = false;
		this._windows = null;
		this._lastWindow = null;
		this._currentWindow = null;
		this._currentWindowIndex = 0;
	},

    _getPreferredWidth: function (actor, forHeight, alloc) {
        alloc.min_size = global.screen_width;
        alloc.natural_size = global.screen_width;
    },

    _getPreferredHeight: function (actor, forWidth, alloc) {
        alloc.min_size = global.screen_height;
        alloc.natural_size = global.screen_height;
    },

    _allocate: function (actor, box, flags) {
        let childBox = new Clutter.ActorBox();
        let primary = Main.layoutManager.primaryMonitor;

        let leftPadding = this.actor.get_theme_node().get_padding(St.Side.LEFT);
        let rightPadding = this.actor.get_theme_node().get_padding(St.Side.RIGHT);
        let bottomPadding = this.actor.get_theme_node().get_padding(St.Side.BOTTOM);
        let vPadding = this.actor.get_theme_node().get_vertical_padding();
        let hPadding = leftPadding + rightPadding;

        // Allocate the appSwitcher
        // We select a size based on an icon size that does not overflow the screen
        let [childMinHeight, childNaturalHeight] = this._thumbnails.actor.get_preferred_height(primary.width - hPadding);
        let [childMinWidth, childNaturalWidth] = this._thumbnails.actor.get_preferred_width(childNaturalHeight);
        childBox.x1 = Math.max(primary.x + leftPadding, primary.x + Math.floor((primary.width - childNaturalWidth) / 2));
        childBox.x2 = Math.min(primary.x + primary.width - rightPadding, childBox.x1 + childNaturalWidth);
        childBox.y1 = primary.y + Math.floor((primary.height - childNaturalHeight) / 2);
		this._thumbnails.addClones(primary.height);
        childBox.y2 = childBox.y1 + childNaturalHeight;
		this._thumbnails.actor.allocate(childBox, flags);


		global.log("allocate");
    },

	_initWindowList: function() {
		this._windows = [];
		this._lastWindow = null;
		this._currentWindow = null;
		this._currentWindowIndex = 0;

		let windowActors = global.get_window_actors();

		for (let i in windowActors) {
			let win = windowActors[i].get_meta_window();

			if (win.has_focus()) {
			}

			this._windows.push(win);
		}

//		this._windows.sort(Lang.bind(this, this._sortWindows));
//		this._windows.unshift(this._lastFocused);
	},

	_focusChanged: function() {
		this._lastWindow = this._currentWindow;

		if (global.display.focus_window) {
			this._currentWindow = global.display.focus_window;
		}
	},

	_startSwitcher: function(shellwm, binding, mask, window, backwards) {
        if (!Main.pushModal(this.actor))
            return false;

		if (!this._windows) {
			this._initWindowList();
		}

		this._haveModal = true;
        this._modifierMask = AltTab.primaryModifier(mask);

        this.actor.connect('key-press-event', Lang.bind(this, this._keyPressEvent));
        this.actor.connect('key-release-event', Lang.bind(this, this._keyReleaseEvent));

		/*
		this._windows = this._windows.filter(function(win) {
			return win != this._lastWindow && win != this._currentWindow;
		});*/

		this._windows.sort(Lang.bind(this, this._sortWindows));

		/*
		if (this._lastWindow) {
			this._windows.unshift(this._lastWindow);
		} 

		if (this._currentWindow) {
			this._windows.push(this._currentWindow);
		}
		*/

		this._thumbnails = new ThumbnailList(this._windows);
        this.actor.add_actor(this._thumbnails.actor);
        this._thumbnails.actor.get_allocation_box();

        // Need to force an allocation so we can figure out whether we
        // need to scroll when selecting
        this.actor.opacity = 255;
        this.actor.show();
        this.actor.get_allocation_box();

		global.log("done");
//		this._showNextWindow();

//        this.actor.show();
	},

	_cloneWindow: function(win) {
		let box = new St.BoxLayout({ vertical: false});
		let bin = new St.Bin();

		box.add_actor(bin);

		let mutterWindow = win.get_compositor_private();

		if (!mutterWindow) {
			return null;
		}

		let windowTexture = mutterWindow.get_texture();
		let [width, height] = windowTexture.get_size();

		global.log("width: " + width);
		global.log("height: " + height);

		let clone = new Clutter.Clone ({ source: windowTexture,
										 reactive: true,
										 width: width,
										 height: height });

//		bin.set_height(800);
        let text = new St.Label({ style_class: 'helloworld-label', text: "Hello, world!" });

		let monitor = Main.layoutManager.primaryMonitor;

		text.opacity = 255;

		bin.add_actor(clone);

		return text;
	},

    _sortWindows : function(win1, win2) {
		let t1 = win1.get_user_time();
		let t2 = win2.get_user_time();

		if (t2 > t1) {
			return 1;
		} else {
			return -1;
		}
    },

	_showNextWindow: function() {
		if ((this._currentWindowIndex + 1) == this._windows.length) {
			this._currentWindowIndex = 0;
		} else {
			this._currentWindowIndex++;
		}

//		Main.activateWindow(this._windows[this._currentWindowIndex]);

		if (this._currentWindow) {
			global.log("removing actor: " + this._currentWindow);
			this.actor.remove_actor(this._currentWindow);
			global.log("actor removed");
		}

		this._currentWindow = this._cloneWindow(
				this._windows[this._currentWindowIndex]);

		global.log("showing actor: " + this._currentWindow);
		this.actor.add_actor(this._currentWindow);

//		this._currentWindow.show();
//		this.actor.show();
	},

    _keyPressEvent : function(actor, event) {
        let keysym = event.get_key_symbol();
        let event_state = Shell.get_event_state(event);

        let backwards = event_state & Clutter.ModifierType.SHIFT_MASK;
        let action = global.display.get_keybinding_action(event.get_key_code(), event_state);

        if (keysym == Clutter.Escape) {
			Main.activateWindow(this._windows[this._windows.length - 1]);
            this.destroy();
        } else if (action == Meta.KeyBindingAction.SWITCH_GROUP) {
			global.log("Switch group");
        } else if (action == Meta.KeyBindingAction.SWITCH_GROUP_BACKWARD) {
			global.log("switch group backwards");
        } else if (action == Meta.KeyBindingAction.SWITCH_WINDOWS) {
			this._showNextWindow();
			global.log("switch windows");
        } else if (action == Meta.KeyBindingAction.SWITCH_WINDOWS_BACKWARD) {
			global.log("switch windows backwards");
		}

        return true;
    },

    _keyReleaseEvent : function(actor, event) {
        let [x, y, mods] = global.get_pointer();
        let state = mods & this._modifierMask;

        if (state == 0) {
			global.log("Switching Workspace!");			
			Main.activateWindow(this._windows[this._currentWindowIndex]);
			this.destroy();
		}

        return true;
    },

    _popModal: function() {
        if (this._haveModal) {
            Main.popModal(this.actor);
            this._haveModal = false;
        }
    },

	_onDestroy: function() {
		this._popModal();

		this._windows = null;
		this._currentWindow = null;
//		this._focusChanged();
	},

	destroy: function() {
		this._onDestroy();

		this.actor.destroy();
	}
}

let simpleAltTab;

function init() {
}

function altTab(shellwm, binding, mask, window, backwards) {
	simpleAltTab._startSwitcher(shellwm, binding, mask, window, backwards);
}

function enable() {
	if (!simpleAltTab) {
		simpleAltTab = new SimpleAltTab();
	}

    Main.wm.setKeybindingHandler('switch_windows', altTab);
    Main.wm.setKeybindingHandler('switch_group', altTab);
    Main.wm.setKeybindingHandler('switch_windows_backward', altTab);
    Main.wm.setKeybindingHandler('switch_group_backward', altTab);
}

function disable() {
	if (simpleAltTab) {
		simpleAltTab = null;
	}

    Main.wm.setKeybindingHandler('switch_windows', Lang.bind(Main.wm, Main.wm._startAppSwitcher));
    Main.wm.setKeybindingHandler('switch_group', Lang.bind(Main.wm, Main.wm._startAppSwitcher));
    Main.wm.setKeybindingHandler('switch_windows_backward', Lang.bind(Main.wm, Main.wm._startAppSwitcher));
    Main.wm.setKeybindingHandler('switch_group_backward', Lang.bind(Main.wm, Main.wm._startAppSwitcher));
}
