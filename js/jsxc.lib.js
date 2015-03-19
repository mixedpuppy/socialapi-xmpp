var jsxc;

(function($) {
   "use strict";

   /**
    * JavaScript Xmpp Chat namespace
    * 
    * @namespace jsxc
    */
   jsxc = {
      /** Version of jsxc */
      version: '< $ app.version $ >',

      /** True if i'm the master */
      master: false,

      /** True if the role allocation is finished */
      role_allocation: false,

      /** Timeout for keepalive */
      to: null,

      /** Timeout after normal keepalive starts */
      toBusy: null,

      /** Timeout for notification */
      toNotification: null,

      /** Timeout delay for notification */
      toNotificationDelay: 500,

      /** Interval for keep-alive */
      keepalive: null,

      /** True if last activity was 10 min ago */
      restore: false,

      /** True if restore is complete */
      restoreCompleted: false,

      /** True if login through box */
      triggeredFromBox: false,

      /** True if logout through element click */
      triggeredFromElement: false,

      /** True if logout through logout click */
      triggeredFromLogout: false,

      /** last values which we wrote into localstorage (IE workaround) */
      ls: [],

      /**
       * storage event is even fired if I write something into storage (IE
       * workaround) 0: conform, 1: not conform, 2: not shure
       */
      storageNotConform: null,

      /** Timeout for storageNotConform test */
      toSNC: null,

      /** My bar id */
      bid: null,

      /** Some constants */
      CONST: {
         NOTIFICATION_DEFAULT: 'default',
         NOTIFICATION_GRANTED: 'granted',
         NOTIFICATION_DENIED: 'denied',
         STATUS: [ 'offline', 'dnd', 'xa', 'away', 'chat', 'online' ],
         SOUNDS: {
            MSG: 'incomingMessage.wav',
            CALL: 'Rotary-Phone6.mp3',
            NOTICE: 'Ping1.mp3'
         },
         REGEX: {
            JID: new RegExp('\\b[^"&\'\\/:<>@\\s]+@[\\w-_.]+\\b', 'ig'),
            URL: new RegExp(/((?:https?:\/\/|www\.|([\w\-]+\.[a-zA-Z]{2,3})(?=\b))(?:(?:[\-A-Za-z0-9+&@#\/%?=~_|!:,.;]*\([\-A-Za-z0-9+&@#\/%?=~_|!:,.;]*\)([\-A-Za-z0-9+&@#\/%?=~_|!:,.;]*[\-A-Za-z0-9+&@#\/%=~_|])?)|(?:[\-A-Za-z0-9+&@#\/%?=~_|!:,.;]*[\-A-Za-z0-9+&@#\/%=~_|]))?)/gi)
         },
         NS: {
            CARBONS: 'urn:xmpp:carbons:2',
            FORWARD: 'urn:xmpp:forward:0'
         }
      },

      /**
       * Parse a unix timestamp and return a formatted time string
       * 
       * @memberOf jsxc
       * @param {Object} unixtime
       * @returns time of day and/or date
       */
      getFormattedTime: function(unixtime) {
         var msgDate = new Date(parseInt(unixtime));
         var date = ('0' + msgDate.getDate()).slice(-2);
         var month = ('0' + (msgDate.getMonth() + 1)).slice(-2);
         var year = msgDate.getFullYear();
         var hours = ('0' + msgDate.getHours()).slice(-2);
         var minutes = ('0' + msgDate.getMinutes()).slice(-2);
         var dateNow = new Date(), time = hours + ':' + minutes;

         // compare dates only
         dateNow.setHours(0, 0, 0, 0);
         msgDate.setHours(0, 0, 0, 0);

         if (dateNow.getTime() !== msgDate.getTime()) {
            return date + '.' + month + '.' + year + ' ' + time;
         }
         return time;
      },

      /**
       * Write debug message to console and to log.
       * 
       * @memberOf jsxc
       * @param {String} msg Debug message
       * @param {Object} data
       * @param {String} Could be warn|error|null
       */
      debug: function(msg, data, level) {
         if (level) {
            msg = '[' + level + '] ' + msg;
         }

         if (data) {
            if (jsxc.storage.getItem('debug') === true) {
               console.log(msg, data);
            }

            // try to convert data to string
            var d;
            try {
               // clone html snippet
               d = $("<span>").prepend($(data).clone()).html();
            } catch (err) {
               try {
                  d = JSON.stringify(data);
               } catch (err2) {
                  d = 'see js console';
               }
            }

            jsxc.log = jsxc.log + msg + ': ' + d + '\n';
         } else {
            console.log(msg);
            jsxc.log = jsxc.log + msg + '\n';
         }
      },

      /**
       * Write warn message.
       * 
       * @memberOf jsxc
       * @param {String} msg Warn message
       * @param {Object} data
       */
      warn: function(msg, data) {
         jsxc.debug(msg, data, 'WARN');
      },

      /**
       * Write error message.
       * 
       * @memberOf jsxc
       * @param {String} msg Error message
       * @param {Object} data
       */
      error: function(msg, data) {
         jsxc.debug(msg, data, 'ERROR');
      },

      /** debug log */
      log: '',

      /**
       * Starts the action
       * 
       * @memberOf jsxc
       * @param {object} options
       */
      init: function(options) {

         if (options) {
            // override default options
            $.extend(true, jsxc.options, options);
         }

         /**
          * Getter method for options. Saved options will override default one.
          * 
          * @param {string} key option key
          * @returns default or saved option value
          */
         jsxc.options.get = function(key) {
            var local = jsxc.storage.getUserItem('options') || {};

            return local[key] || jsxc.options[key];
         };

         /**
          * Setter method for options. Will write into localstorage.
          * 
          * @param {string} key option key
          * @param {object} value option value
          */
         jsxc.options.set = function(key, value) {
            jsxc.storage.updateItem('options', key, value, true);
         };

         jsxc.storageNotConform = jsxc.storage.getItem('storageNotConform');
         if (jsxc.storageNotConform === null) {
            jsxc.storageNotConform = 2;
         }

         // detect language
         var lang;
         if (jsxc.storage.getItem('lang') !== null) {
            lang = jsxc.storage.getItem('lang');
         } else if (jsxc.options.autoLang && navigator.language) {
            lang = navigator.language.substr(0, 2);
         } else {
            lang = jsxc.options.defaultLang;
         }

         // set language
         jsxc.l = jsxc.l10n.en;
         $.extend(jsxc.l, jsxc.l10n[lang]);

         // Check localStorage
         if (typeof (localStorage) === 'undefined') {
            jsxc.debug("Browser doesn't support localStorage.");
            return;
         }

         if (jsxc.storage.getItem('debug') === true) {
            jsxc.options.otr.debug = true;
         }

         // Register event listener for the storage event
         window.addEventListener('storage', jsxc.storage.onStorage, false);

         var lastActivity = jsxc.storage.getItem('lastActivity') || 0;

         if ((new Date()).getTime() - lastActivity < jsxc.options.loginTimeout) {
            jsxc.restore = true;
         }

         // Check if we have to establish a new connection
         if (!jsxc.storage.getItem('rid') || !jsxc.storage.getItem('sid') || !jsxc.restore) {
console.log("establish new connection");
            // Looking for a login form
            if (!jsxc.options.loginForm.form || !(jsxc.el_exists(jsxc.options.loginForm.form) && jsxc.el_exists(jsxc.options.loginForm.jid) && jsxc.el_exists(jsxc.options.loginForm.pass))) {

               if (jsxc.options.displayRosterMinimized()) {
console.log("init roster from jsxc.init");
                  // Show minimized roster
                  jsxc.storage.setUserItem('roster', 'hidden');
                  jsxc.gui.roster.init();
                  jsxc.gui.roster.noConnection();
               }

               return;
            }

            if (typeof jsxc.options.formFound === 'function') {
               jsxc.options.formFound.call();
            }

            // create jquery object
            var form = jsxc.options.loginForm.form = $(jsxc.options.loginForm.form);
            var events = form.data('events') || {
               submit: []
            };
            var submits = [];

            // save attached submit events and remove them. Will be reattached
            // in jsxc.submitLoginForm
            $.each(events.submit, function(index, val) {
               submits.push(val.handler);
            });

            form.data('submits', submits);
            form.off('submit');

            // Add jsxc login action to form
            form.submit(function() {

               var settings = jsxc.prepareLogin();

               if (settings !== false && (settings.xmpp.onlogin === "true" || settings.xmpp.onlogin === true)) {
                  jsxc.options.loginForm.triggered = true;

                  jsxc.xmpp.login();

                  // Trigger submit in jsxc.xmpp.connected()
                  return false;
               }

               return true;
            });

         } else {

            // Restore old connection

            jsxc.bid = jsxc.jidToBid(jsxc.storage.getItem('jid'));

            jsxc.gui.init();

            // Looking for logout element
            if (jsxc.options.logoutElement !== null && jsxc.options.logoutElement.length > 0) {
               jsxc.options.logoutElement.one('click', function() {
                  jsxc.options.logoutElement = $(this);
                  jsxc.triggeredFromLogout = true;
                  return jsxc.xmpp.logout();
               });
            }

            if (typeof (jsxc.storage.getItem('alive')) === 'undefined' || !jsxc.restore) {
               jsxc.onMaster();
            } else {
               jsxc.checkMaster();
            }
         }
      },

      /**
       * Load settings and prepare jid.
       * 
       * @memberOf jsxc
       * @returns Loaded settings
       */
      prepareLogin: function() {
         var username = $(jsxc.options.loginForm.jid).val();
         var password = $(jsxc.options.loginForm.pass).val();

         if (typeof jsxc.options.loadSettings !== 'function') {
            jsxc.error('No loadSettings function given. Abort.');
            return;
         }

         jsxc.gui.showWaitAlert(jsxc.l.Logging_in);

         var settings = jsxc.options.loadSettings.call(this, username, password);

         if (settings === false || settings === null || typeof settings === 'undefined') {
            jsxc.warn('No settings provided');

            return false;
         }

         if (typeof settings.xmpp.username === 'string') {
            username = settings.xmpp.username;
         }

         var resource = (settings.xmpp.resource) ? '/' + settings.xmpp.resource : '';
         var domain = settings.xmpp.domain;
         var jid;

         if (username.match(/@(.*)$/)) {
            jid = (username.match(/\/(.*)$/)) ? username : username + resource;
         } else {
            jid = username + '@' + domain + resource;
         }

         if (typeof jsxc.options.loginForm.preJid === 'function') {
            jid = jsxc.options.loginForm.preJid(jid);
         }

         jsxc.bid = jsxc.jidToBid(jid);

         settings.xmpp.username = jid.split('@')[0];
         settings.xmpp.domain = jid.split('@')[1].split('/')[0];
         settings.xmpp.resource = jid.split('@')[1].split('/')[1] || "";

         $.each(settings, function(key, val) {
            jsxc.options.set(key, val);
         });

         jsxc.options.xmpp.jid = jid;
         jsxc.options.xmpp.password = password;
dump("settings: "+JSON.stringify(settings)+"\n")
         return settings;
      },

      /**
       * Called if the script is a slave
       */
      onSlave: function() {
         jsxc.debug('I am the slave.');

         jsxc.role_allocation = true;

         jsxc.restoreRoster();
         jsxc.restoreWindows();
         jsxc.restoreCompleted = true;

         $(document).trigger('restoreCompleted.jsxc');
      },

      /**
       * Called if the script is the master
       */
      onMaster: function() {
         jsxc.debug('I am master.');

         jsxc.master = true;

         // Init local storage
         jsxc.storage.setItem('alive', 0);
         jsxc.storage.setItem('alive_busy', 0);
         if (!jsxc.storage.getUserItem('windowlist')) {
            jsxc.storage.setUserItem('windowlist', []);
         }

         // Sending keepalive signal
         jsxc.startKeepAlive();

         if (jsxc.options.get('otr').enable) {
            // create or load DSA key and call _onMaster
            jsxc.otr.createDSA();
         } else {
            jsxc._onMaster();
         }
      },

      /**
       * Second half of the onMaster routine
       */
      _onMaster: function() {

         // create otr objects, if we lost the master
         if (jsxc.role_allocation) {
            $.each(jsxc.storage.getUserItem('windowlist'), function(index, val) {
               jsxc.otr.create(val);
            });
         }

         jsxc.role_allocation = true;

         if (jsxc.restore && !jsxc.restoreCompleted) {
            jsxc.restoreRoster();
            jsxc.restoreWindows();
            jsxc.restoreCompleted = true;

            $(document).trigger('restoreCompleted.jsxc');
         }

         // Prepare notifications
         if (jsxc.restore) {
            var noti = jsxc.storage.getUserItem('notification') || 2;
            if (jsxc.options.notification && noti > 0 && jsxc.notification.hasSupport()) {
               if (jsxc.notification.hasPermission()) {
                  jsxc.notification.init();
               } else {
                  jsxc.notification.prepareRequest();
               }
            } else {
               // No support => disable
               jsxc.options.notification = false;
            }
         }

         $(document).on('connectionReady.jsxc', function() {
            jsxc.gui.updateAvatar($('#jsxc_avatar'), jsxc.storage.getItem('jid'), 'own');
         });

         jsxc.xmpp.login();
      },

      /**
       * Checks if there is a master
       */
      checkMaster: function() {
         jsxc.debug('check master');

         jsxc.to = window.setTimeout(jsxc.onMaster, 1000);
         jsxc.storage.ink('alive');
      },

      /**
       * Start sending keep-alive signal
       */
      startKeepAlive: function() {
         jsxc.keepalive = window.setInterval(jsxc.keepAlive, jsxc.options.timeout - 1000);
      },

      /**
       * Sends the keep-alive signal to signal that the master is still there.
       */
      keepAlive: function() {
         jsxc.storage.ink('alive');

         if (jsxc.role_allocation) {
            jsxc.storage.setItem('lastActivity', (new Date()).getTime());
         }
      },

      /**
       * Send one keep-alive signal with higher timeout, and than resume with
       * normal signal
       */
      keepBusyAlive: function() {
         if (jsxc.toBusy) {
            window.clearTimeout(jsxc.toBusy);
         }

         if (jsxc.keepalive) {
            window.clearInterval(jsxc.keepalive);
         }

         jsxc.storage.ink('alive_busy');
         jsxc.toBusy = window.setTimeout(jsxc.startKeepAlive, jsxc.options.busyTimeout - 1000);
      },

      /**
       * Generates a random integer number between 0 and max
       * 
       * @param {Integer} max
       * @return {Integer} random integer between 0 and max
       */
      random: function(max) {
         return Math.floor(Math.random() * max);
      },

      /**
       * Checks if there is a element with the given selector
       * 
       * @param {String} selector jQuery selector
       * @return {Boolean}
       */
      el_exists: function(selector) {
         return $(selector).length > 0;
      },

      /**
       * Creates a CSS compatible string from a JID
       * 
       * @param {type} jid Valid Jabber ID
       * @returns {String} css Compatible string
       */
      jidToCid: function(jid) {
         jsxc.warn('jsxc.jidToCid is deprecated!');

         var cid = Strophe.getBareJidFromJid(jid).replace('@', '-').replace(/\./g, '-').toLowerCase();

         return cid;
      },

      /**
       * Create comparable bar jid.
       * 
       * @memberOf jsxc
       * @param jid
       * @returns comparable bar jid
       */
      jidToBid: function(jid) {
         return Strophe.getBareJidFromJid(jid).toLowerCase();
      },

      /**
       * Restore roster
       */
      restoreRoster: function() {
         var buddies = jsxc.storage.getUserItem('buddylist');

         if (!buddies || buddies.length === 0) {
            jsxc.debug('No saved buddylist.');

            jsxc.gui.roster.empty();

            return;
         }

         $.each(buddies, function(index, value) {
            jsxc.gui.roster.add(value);
         });

         $(document).trigger('cloaded.roster.jsxc');
      },

      /**
       * Restore all windows
       */
      restoreWindows: function() {
         var windows = jsxc.storage.getUserItem('windowlist');

         if (windows === null) {
            return;
         }

         $.each(windows, function(index, bid) {
            var window = jsxc.storage.getUserItem('window', bid);

            if (!window) {
               jsxc.debug('Associated window-element is missing: ' + bid);
               return true;
            }

            // init master window list if necessary
            jsxc.gui.window.init(bid);
            // open socialapi window
            jsxc.gui.window.open(bid);

            //if (!window.minimize) {
            //   jsxc.gui.window.show(bid);
            //} else {
            //   jsxc.gui.window.hide(bid);
            //}

            //jsxc.gui.window.setText(bid, window.text);
         });
      },

      /**
       * This method submits the specified login form.
       */
      submitLoginForm: function() {
         var form = jsxc.options.loginForm.form.off('submit');

         // Attach original events
         var submits = form.data('submits') || [];
         $.each(submits, function(index, val) {
            form.submit(val);
         });

         if (form.find('#submit').length > 0) {
            form.find('#submit').click();
         } else {
            form.submit();
         }
      },

      /**
       * Escapes some characters to HTML character
       */
      escapeHTML: function(text) {
         text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
         return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      },

      /**
       * Removes all html tags.
       * 
       * @memberOf jsxc
       * @param text
       * @returns stripped text
       */
      removeHTML: function(text) {
         return $('<span>').html(text).text();
      },

      /**
       * Executes only one of the given events
       * 
       * @param {string} obj.key event name
       * @param {function} obj.value function to execute
       * @returns {string} namespace of all events
       */
      switchEvents: function(obj) {
         var ns = Math.random().toString(36).substr(2, 12);
         var self = this;

         $.each(obj, function(key, val) {
            $(document).one(key + '.' + ns, function() {
               $(document).off('.' + ns);

               val.apply(self, arguments);
            });
         });

         return ns;
      },

      /**
       * Checks if tab is hidden.
       * 
       * @returns {boolean} True if tab is hidden
       */
      isHidden: function() {
         var hidden = false;

         if (typeof document.hidden !== 'undefined') {
            hidden = document.hidden;
         } else if (typeof document.webkitHidden !== 'undefined') {
            hidden = document.webkitHidden;
         } else if (typeof document.mozHidden !== 'undefined') {
            hidden = document.mozHidden;
         } else if (typeof document.msHidden !== 'undefined') {
            hidden = document.msHidden;
         }

         // handle multiple tabs
         if (hidden && jsxc.master) {
            jsxc.storage.ink('hidden', 0);
         } else if (!hidden && !jsxc.master) {
            jsxc.storage.ink('hidden');
         }

         return hidden;
      },

      /**
       * Replace %%tokens%% with correct translation.
       * 
       * @param {String} text Given text
       * @returns {String} Translated string
       */
      translate: function(text) {
         return text.replace(/%%([a-zA-Z0-9_-}{ .!,?/'@]+)%%/g, function(s, key) {
            var k = key.replace(/ /gi, '_').replace(/[.!,?/'@]/g, '');

            if (!jsxc.l[k]) {
               jsxc.warn('No translation for: ' + k);
            }

            return jsxc.l[k] || key.replace(/_/g, ' ');
         });
      },

      /**
       * Executes the given function in jsxc namespace.
       * 
       * @memberOf jsxc
       * @param {string} fnName Function name
       * @param {array} fnParams Function parameters
       * @returns Function return value
       */
      exec: function(fnName, fnParams) {
         var fnList = fnName.split('.');
         var fn = jsxc[fnList[0]];
         var i;
         for (i = 1; i < fnList.length; i++) {
            fn = fn[fnList[i]];
         }

         if (typeof fn === 'function') {
            return fn.apply(null, fnParams);
         }
      }
   };

   /**
    * Set some options for the chat.
    * 
    * @namespace jsxc.options
    */
   jsxc.options = {

      /** name of container application (e.g. owncloud or SOGo) */
      app_name: 'web applications',

      /** Timeout for the keepalive signal */
      timeout: 3000,

      /** Timeout for the keepalive signal if the master is busy */
      busyTimeout: 15000,

      /** OTR options */
      otr: {
         enable: true,
         ERROR_START_AKE: false,
         debug: false,
         SEND_WHITESPACE_TAG: true,
         WHITESPACE_START_AKE: true
      },

      /** xmpp options */
      xmpp: {
         url: null,
         jid: null,
         domain: null,
         password: null,
         overwrite: false,
         onlogin: true
      },

      /** default xmpp priorities */
      priority: {
         online: 0,
         chat: 0,
         away: 0,
         xa: 0,
         dnd: 0
      },

      /** If all 3 properties are set, the login form is used */
      loginForm: {
         /** jquery object from form */
         form: null,

         /** jquery object from input element which contains the jid */
         jid: null,

         /** jquery object from input element which contains the password */
         pass: null,

         /** manipulate JID from input element */
         preJid: function(jid) {
            return jid;
         },

         /**
          * Action after connected: submit [String] Submit form, false [boolean]
          * Do nothing, continue [String] Start chat
          */
         onConnected: 'submit',

         /**
          * Action after auth fail: submit [String] Submit form, false [boolean]
          * Do nothing, ask [String] Show auth fail dialog
          */
         onAuthFail: 'submit'
      },

      /** jquery object from logout element */
      logoutElement: null,

      /** How many messages should be logged? */
      numberOfMsg: 10,

      /** Default language */
      defaultLang: 'en',

      /** auto language detection */
      autoLang: true,

      /** Place for roster */
      rosterAppend: 'body',

      /** Should we use the HTML5 notification API? */
      notification: true,

      /** duration for notification */
      popupDuration: 6000,

      /** Absolute path root of JSXC installation */
      root: '',

      /** Timeout for restore in ms */
      loginTimeout: 1000 * 60 * 10,

      /**
       * This function decides wether the roster will be displayed or not if no
       * connection is found.
       */
      displayRosterMinimized: function() {
         return false;
      },

      /** Set to true if you want to hide offline buddies. */
      hideOffline: false,

      /** Mute notification sound? */
      muteNotification: false,

      /**
       * If no avatar is found, this function is called.
       * 
       * @param jid Jid of that user.
       * @this {jQuery} Elements to update with probable .jsxc_avatar elements
       */
      defaultAvatar: function() {

      },

      /**
       * Returns permanent saved settings and overwrite default jsxc.options.
       * 
       * @memberOf jsxc.options
       * @param username String username
       * @param password String password
       * @returns {object} at least xmpp.url
       */
      loadSettings: function() {

      },

      /**
       * Call this function to save user settings permanent.
       * 
       * @memberOf jsxc.options
       * @param data Holds all data as key/value
       * @returns {boolean} false if function failes
       */
      saveSettinsPermanent: function() {

      },

      carbons: {
         /** Enable carbon copies? */
         enable: false
      }
   };

   /**
    * Handle functions for chat window's and buddylist
    * 
    * @namespace jsxc.gui
    */
   jsxc.gui = {
      /** Smilie token to file mapping */
      emotions: [ [ 'O:-) O:)', 'angel' ], [ '>:-( >:( &gt;:-( &gt;:(', 'angry' ], [ ':-) :)', 'smile' ], [ ':-D :D', 'grin' ], [ ':-( :(', 'sad' ], [ ';-) ;)', 'wink' ], [ ':-P :P', 'tonguesmile' ], [ '=-O', 'surprised' ], [ ':kiss: :-*', 'kiss' ], [ '8-) :cool:', 'sunglassess' ], [ ':\'-( :\'( :&amp;apos;-(', 'crysad' ], [ ':-/', 'doubt' ], [ ':-X :X', 'zip' ], [ ':yes:', 'thumbsup' ], [ ':no:', 'thumbsdown' ], [ ':beer:', 'beer' ], [ ':devil:', 'devil' ], [ ':kiss: :kissing:', 'kissing' ], [ '@->-- :rose: @-&gt;--', 'rose' ], [ ':music:', 'music' ], [ ':love:', 'love' ], [ ':zzz:', 'tired' ] ],

      /**
       * Different uri query actions as defined in XEP-0147.
       * 
       * @namespace jsxc.gui.queryActions
       */
      queryActions: {
         /** xmpp:JID?message[;body=TEXT] */
         message: function(jid, params) {
            var win = jsxc.gui.window.open(jsxc.jidToBid(jid));

            if (params && typeof params.body === 'string') {
               win.find('.jsxc_textinput').val(params.body);
            }
         },

         /** xmpp:JID?remove */
         remove: function(jid) {
            jsxc.gui.showRemoveDialog(jsxc.jidToBid(jid));
         },

         /** xmpp:JID?subscribe[;name=NAME] */
         subscribe: function(jid, params) {
            jsxc.gui.showContactDialog(jid);

            if (params && typeof params.name) {
               $('#jsxc_alias').val(params.name);
            }
         },

         /** xmpp:JID?vcard */
         vcard: function(jid) {
            jsxc.gui.showVcard(jid);
         }
      },

      /**
       * Creates application skeleton.
       * 
       * @memberOf jsxc.gui
       */
      init: function() {
         //Prevent duplicate windowList
         if ($('#jsxc_windowList').length > 0) {
            return;
         }
         
         //$('body').append($(jsxc.gui.template.get('windowList')));
         
         //$(window).resize(jsxc.gui.updateWindowListSB);
         //$('#jsxc_windowList').resize(jsxc.gui.updateWindowListSB);
         //
         //$('#jsxc_windowListSB .jsxc_scrollLeft').click(function() {
         //   jsxc.gui.scrollWindowListBy(-200);
         //});
         //$('#jsxc_windowListSB .jsxc_scrollRight').click(function() {
         //   jsxc.gui.scrollWindowListBy(200);
         //});
         //$('#jsxc_windowList').on('wheel', function(ev) {
         //   if ($('#jsxc_windowList').data('isOver')) {
         //      jsxc.gui.scrollWindowListBy((ev.originalEvent.wheelDelta > 0) ? 200 : -200);
         //   }
         //});

         //jsxc.gui.tooltip('#jsxc_windowList');

         //if (!jsxc.el_exists('#jsxc_roster')) {
//            jsxc.gui.roster.init();
         //}

         // prepare regexp for emotions
         $.each(jsxc.gui.emotions, function(i, val) {
            // escape characters
            var reg = val[0].replace(/(\/|\||\*|\.|\+|\?|\^|\$|\(|\)|\[|\]|\{|\})/g, '\\$1');
            reg = '(' + reg.split(' ').join('|') + ')';
            jsxc.gui.emotions[i][2] = new RegExp(reg, 'g');
         });

         // We need this often, so we creates some template jquery objects
         jsxc.gui.windowTemplate = $(jsxc.gui.template.get('chatWindow'));
         jsxc.gui.buddyTemplate = $(jsxc.gui.template.get('rosterBuddy'));
      },

      /**
       * Init tooltip plugin for given jQuery selector.
       * 
       * @param {String} selector jQuery selector
       * @memberOf jsxc.gui
       */
      tooltip: function(selector) {
         $(selector).tooltip({
            show: {
               delay: 600
            },
            content: function() {
               return $(this).attr('title').replace(/\n/g, '<br />');
            }
         });
      },

      /**
       * Updates Information in roster and chatbar
       * 
       * @param {String} bid bar jid
       */
      update: function(bid) {
         var data = jsxc.storage.getUserItem('buddy', bid);

         if (!data) {
            jsxc.debug('No data for ' + bid);
            return;
         }

         var ri = jsxc.gui.roster.getItem(bid); // roster item from user
         var we = jsxc.gui.window.get(bid); // window element from user
         var ue = ri.add(we); // both
         var spot = $('.jsxc_spot[data-bid="' + bid + '"]');

         // Attach data to corresponding roster item
         ri.data(data);

         // Add online status
         ue.add(spot).removeClass('jsxc_' + jsxc.CONST.STATUS.join(' jsxc_')).addClass('jsxc_' + jsxc.CONST.STATUS[data.status]);

         // Change name and add title
         ue.find('.jsxc_name').add(spot).text(data.name).attr('title', jsxc.l.is + ' ' + jsxc.CONST.STATUS[data.status]);

         // Update gui according to encryption state
         switch (data.msgstate) {
            case 0:
               we.find('.jsxc_transfer').removeClass('jsxc_enc jsxc_fin').attr('title', jsxc.l.your_connection_is_unencrypted);
               we.find('.jsxc_settings .jsxc_verification').addClass('jsxc_disabled');
               we.find('.jsxc_settings .jsxc_transfer').text(jsxc.l.start_private);
               break;
            case 1:
               we.find('.jsxc_transfer').addClass('jsxc_enc').attr('title', jsxc.l.your_connection_is_encrypted);
               we.find('.jsxc_settings .jsxc_verification').removeClass('jsxc_disabled');
               we.find('.jsxc_settings .jsxc_transfer').text(jsxc.l.close_private);
               break;
            case 2:
               we.find('.jsxc_settings .jsxc_verification').addClass('jsxc_disabled');
               we.find('.jsxc_transfer').removeClass('jsxc_enc').addClass('jsxc_fin').attr('title', jsxc.l.your_buddy_closed_the_private_connection);
               we.find('.jsxc_settings .jsxc_transfer').text(jsxc.l.close_private);
               break;
         }

         // update gui according to verification state
         if (data.trust) {
            we.find('.jsxc_transfer').addClass('jsxc_trust').attr('title', jsxc.l.your_buddy_is_verificated);
         } else {
            we.find('.jsxc_transfer').removeClass('jsxc_trust');
         }

         // update gui according to subscription state
         if (data.sub && data.sub !== 'both') {
            ue.addClass('jsxc_oneway');
         } else {
            ue.removeClass('jsxc_oneway');
         }

         var info = '<b>' + Strophe.getBareJidFromJid(data.jid) + '</b>\n';
         info += jsxc.translate('%%Subscription%%: %%' + data.sub + '%%\n');
         info += jsxc.translate('%%Status%%: %%' + jsxc.CONST.STATUS[data.status] + '%%');

         ri.find('.jsxc_name').attr('title', info);

         if (data.avatar && data.avatar.length > 0) {
            jsxc.gui.updateAvatar(ue, data.jid, data.avatar);
         } else {
            jsxc.options.defaultAvatar.call(ue, data.jid);
         }
      },

      /**
       * Update avatar on all given elements.
       * 
       * @memberOf jsxc.gui
       * @param {jQuery} el Elements with subelement .jsxc_avatar
       * @param {string} jid Jid
       * @param {string} aid Avatar id (sha1 hash of image)
       */
      updateAvatar: function(el, jid, aid) {

         if (typeof aid === 'undefined') {
            if (typeof jsxc.options.defaultAvatar === 'function') {
               jsxc.options.defaultAvatar.call(el, jid);
            }
            return;
         }

         var avatarSrc = jsxc.storage.getUserItem('avatar', aid);

         var setAvatar = function(src) {
            if (src === 0 || src === '0') {
               jsxc.options.defaultAvatar.call(el, jid);
               return;
            }

            el.find('.jsxc_avatar').removeAttr('style');

            el.find('.jsxc_avatar').css({
               'background-image': 'url(' + src + ')',
               'text-indent': '999px'
            });
         };

         if (avatarSrc !== null) {
            setAvatar(avatarSrc);
         } else {
            jsxc.xmpp.conn.vcard.get(function(stanza) {
               jsxc.debug('vCard', stanza);

               var vCard = $(stanza).find("vCard > PHOTO");
               var src;

               if (vCard.length === 0) {
                  jsxc.debug('No photo provided');
                  src = '0';
               } else if (vCard.find('EXTVAL').length > 0) {
                  src = vCard.find('EXTVAL').text();
               } else {
                  var img = vCard.find('BINVAL').text();
                  var type = vCard.find('TYPE').text();
                  src = 'data:' + type + ';base64,' + img;
               }

               // concat chunks
               src = src.replace(/[\t\r\n\f]/gi, '');

               jsxc.storage.setUserItem('avatar', aid, src);
               setAvatar(src);
            }, Strophe.getBareJidFromJid(jid), function(msg) {
               jsxc.warn('Could not load vcard.', msg);

               jsxc.storage.setUserItem('avatar', aid, 0);
               setAvatar(0);
            });
         }
      },

      /**
       * Updates scrollbar handlers.
       * 
       * @memberOf jsxc.gui
       */
      updateWindowListSB: function() {

         if ($('#jsxc_windowList>ul').width() > $('#jsxc_windowList').width()) {
            $('#jsxc_windowListSB > div').removeClass('jsxc_disabled');
         } else {
            $('#jsxc_windowListSB > div').addClass('jsxc_disabled');
            $('#jsxc_windowList>ul').css('right', '0px');
         }
      },

      /**
       * Scroll window list by offset.
       * 
       * @memberOf jsxc.gui
       * @param offset
       */
      //scrollWindowListBy: function(offset) {
      //
      //   var scrollWidth = $('#jsxc_windowList>ul').width();
      //   var width = $('#jsxc_windowList').width();
      //   var el = $('#jsxc_windowList>ul');
      //   var right = parseInt(el.css('right')) - offset;
      //   var padding = $("#jsxc_windowListSB").width();
      //
      //   if (scrollWidth < width) {
      //      return;
      //   }
      //
      //   if (right > 0) {
      //      right = 0;
      //   }
      //
      //   if (right < width - scrollWidth - padding) {
      //      right = width - scrollWidth - padding;
      //   }
      //
      //   el.css('right', right + 'px');
      //},

      /**
       * Returns the window element
       * 
       * @param {String} bid
       * @returns {jquery} jQuery object of the window element
       */
      //getWindow: function(bid) {
      //   jsxc.warn('jsxc.gui.getWindow is deprecated!');
      //
      //   return jsxc.gui.window.get(bid);
      //},

      /**
       * Toggle list with timeout, like menu or settings
       * 
       * @memberof jsxc.gui
       */
      toggleList: function() {
         var self = $(this);
         console.log("toggleList for ",self);

         self.disableSelection();

         var ul = self.find('ul');
         var slideUp = null;

         slideUp = function() {
            ul.slideUp({
               complete: function() {
            console.log("slideUp complete");
                  self.removeClass('jsxc_opened');
               }
            });

            $('body').off('click', null, slideUp);
         };

         $(this).click(function() {
            console.log("click on menu");

            if (ul.is(":hidden")) {
               // hide other lists
               console.log("hide other lists!");
               $('body').click();
               $('body').one('click', slideUp);
            } else {
               $('body').off('click', null, slideUp);
            }

            ul.slideToggle();

            window.clearTimeout(ul.data('timer'));

            self.toggleClass('jsxc_opened');

            return false;
         }).mouseleave(function() {
            console.log("mouseleave on menu");
            if (!ul.is(":hidden"))
               ul.data('timer', window.setTimeout(slideUp, 2000));
         }).mouseenter(function() {
            console.log("mouseenter on menu");
            window.clearTimeout(ul.data('timer'));
         });
      },

      /**
       * Creates and show loginbox
       */
      showLoginBox: function() {
         // Set focus to password field
         $(document).on("complete.dialog.jsxc", function() {
            $('#jsxc_password').focus();
         });

         jsxc.gui.dialog.open(jsxc.gui.template.get('loginBox'));

         $('#jsxc_dialog').find('form').submit(function() {

            $(this).find('input[type=submit]').prop('disabled', true);

            jsxc.options.loginForm.form = $(this);
            jsxc.options.loginForm.jid = $(this).find('#jsxc_username');
            jsxc.options.loginForm.pass = $(this).find('#jsxc_password');

            var settings = jsxc.prepareLogin();

            jsxc.triggeredFromBox = true;
            jsxc.options.loginForm.triggered = false;

            if (settings === false) {
               jsxc.gui.showAuthFail();
            } else {
               jsxc.xmpp.login(jsxc.options.xmpp.jid, jsxc.options.xmpp.password);
            }

            return false;
         });
      },

      /**
       * Creates and show the fingerprint dialog
       * 
       * @param {String} bid
       */
      showFingerprints: function(bid) {
         jsxc.gui.dialog.open(jsxc.gui.template.get('fingerprintsDialog', bid));
      },

      /**
       * Creates and show the verification dialog
       * 
       * @param {String} bid
       */
      showVerification: function(bid) {

         // Check if there is a open dialog
         if ($('#jsxc_dialog').length > 0) {
            setTimeout(function() {
               jsxc.gui.showVerification(bid);
            }, 3000);
            return;
         }

         // verification only possible if the connection is encrypted
         if (jsxc.storage.getUserItem('buddy', bid).msgstate !== OTR.CONST.MSGSTATE_ENCRYPTED) {
            jsxc.warn('Connection not encrypted');
            return;
         }

         jsxc.gui.dialog.open(jsxc.gui.template.get('authenticationDialog', bid));

         // Add handler

         $('#jsxc_dialog > div:gt(0)').hide();
         $('#jsxc_dialog select').change(function() {
            $('#jsxc_dialog > div:gt(0)').hide();
            $('#jsxc_dialog > div:eq(' + $(this).prop('selectedIndex') + ')').slideDown({
               complete: function() {
                  jsxc.gui.dialog.resize();
               }
            });
         });

         // Manual
         $('#jsxc_dialog > div:eq(1) a.creation').click(function() {
            if (jsxc.master) {
               jsxc.otr.objects[bid].trust = true;
            }

            jsxc.storage.updateUserItem('buddy', bid, 'trust', true);

            jsxc.gui.dialog.close();

            jsxc.storage.updateUserItem('buddy', bid, 'trust', true);
            jsxc.gui.window.postMessage(bid, 'sys', jsxc.l.conversation_is_now_verified);
            jsxc.gui.update(bid);
         });

         // Question
         $('#jsxc_dialog > div:eq(2) a.creation').click(function() {
            var div = $('#jsxc_dialog > div:eq(2)');
            var sec = div.find('#jsxc_secret2').val();
            var quest = div.find('#jsxc_quest').val();

            if (sec === '' || quest === '') {
               // Add information for the user which form is missing
               div.find('input[value=""]').addClass('jsxc_invalid').keyup(function() {
                  if ($(this).val().match(/.*/)) {
                     $(this).removeClass('jsxc_invalid');
                  }
               });
               return;
            }

            if (jsxc.master) {
               jsxc.otr.sendSmpReq(bid, sec, quest);
            } else {
               jsxc.storage.setUserItem('smp_' + bid, {
                  sec: sec,
                  quest: quest
               });
            }

            jsxc.gui.dialog.close();

            jsxc.gui.window.postMessage(bid, 'sys', jsxc.l.authentication_query_sent);
         });

         // Secret
         $('#jsxc_dialog > div:eq(3) .creation').click(function() {
            var div = $('#jsxc_dialog > div:eq(3)');
            var sec = div.find('#jsxc_secret').val();

            if (sec === '') {
               // Add information for the user which form is missing
               div.find('#jsxc_secret').addClass('jsxc_invalid').keyup(function() {
                  if ($(this).val().match(/.*/)) {
                     $(this).removeClass('jsxc_invalid');
                  }
               });
               return;
            }

            if (jsxc.master) {
               jsxc.otr.sendSmpReq(bid, sec);
            } else {
               jsxc.storage.setUserItem('smp_' + bid, {
                  sec: sec,
                  quest: null
               });
            }

            jsxc.gui.dialog.close();

            jsxc.gui.window.postMessage(bid, 'sys', jsxc.l.authentication_query_sent);
         });
      },

      /**
       * Create and show approve dialog
       * 
       * @param {type} from valid jid
       */
      showApproveDialog: function(from) {
         jsxc.gui.dialog.open(jsxc.gui.template.get('approveDialog'), {
            'noClose': true
         });

         $('#jsxc_dialog .jsxc_their_jid').text(Strophe.getBareJidFromJid(from));

         $('#jsxc_dialog .jsxc_deny').click(function(ev) {
            ev.stopPropagation();

            jsxc.xmpp.resFriendReq(from, false);

            jsxc.gui.dialog.close();
         });

         $('#jsxc_dialog .jsxc_approve').click(function(ev) {
            ev.stopPropagation();

            var data = jsxc.storage.getUserItem('buddy', jsxc.jidToBid(from));

            jsxc.xmpp.resFriendReq(from, true);

            // If friendship is not mutual show contact dialog
            if (!data || data.sub === 'from') {
               $(document).one('close.dialog.jsxc', function() {
                  jsxc.gui.showContactDialog(from);
               });
            }

            jsxc.gui.dialog.close();
         });
      },

      /**
       * Create and show dialog to add a buddy
       * 
       * @param {string} [username] jabber id
       */
      showContactDialog: function(username) {
         jsxc.gui.dialog.open(jsxc.gui.template.get('contactDialog'));

         // If we got a friendship request, we would display the username in our
         // response
         if (username) {
            $('#jsxc_username').val(username);
         }

         $('#jsxc_dialog form').submit(function() {
            var username = $('#jsxc_username').val();
            var alias = $('#jsxc_alias').val();

            if (!username.match(/@(.*)$/)) {
               username += '@' + Strophe.getDomainFromJid(jsxc.storage.getItem('jid'));
            }

            // Check if the username is valid
            if (!username || !username.match(jsxc.CONST.REGEX.JID)) {
               // Add notification
               $('#jsxc_username').addClass('jsxc_invalid').keyup(function() {
                  if ($(this).val().match(jsxc.CONST.REGEX.JID)) {
                     $(this).removeClass('jsxc_invalid');
                  }
               });
               return false;
            }
            jsxc.xmpp.addBuddy(username, alias);

            jsxc.gui.dialog.close();

            return false;
         });
      },

      /**
       * Create and show dialog to remove a buddy
       * 
       * @param {type} bid
       * @returns {undefined}
       */
      showRemoveDialog: function(bid) {

         jsxc.gui.dialog.open(jsxc.gui.template.get('removeDialog', bid));

         var data = jsxc.storage.getUserItem('buddy', bid);

         $('#jsxc_dialog .creation').click(function(ev) {
            ev.stopPropagation();

            if (jsxc.master) {
               jsxc.xmpp.removeBuddy(data.jid);
            } else {
               // inform master
               jsxc.storage.setUserItem('deletebuddy', bid, {
                  jid: data.jid
               });
            }

            jsxc.gui.dialog.close();
         });
      },

      /**
       * Create and show a wait dialog
       * 
       * @param {type} msg message to display to the user
       * @returns {undefined}
       */
      showWaitAlert: function(msg) {
         jsxc.gui.dialog.open(jsxc.gui.template.get('waitAlert', null, msg), {
            'noClose': true
         });
      },

      /**
       * Create and show a wait dialog
       * 
       * @param {type} msg message to display to the user
       * @returns {undefined}
       */
      showAlert: function(msg) {
         jsxc.gui.dialog.open(jsxc.gui.template.get('alert', null, msg));
      },

      /**
       * Create and show a auth fail dialog
       * 
       * @returns {undefined}
       */
      showAuthFail: function() {
         jsxc.gui.dialog.open(jsxc.gui.template.get('authFailDialog'));

         if (jsxc.options.loginForm.triggered !== false) {
            $('#jsxc_dialog .jsxc_cancel').hide();
         }

         $('#jsxc_dialog .creation').click(function() {
            jsxc.gui.dialog.close();
         });

         $('#jsxc_dialog .jsxc_cancel').click(function() {
            jsxc.submitLoginForm();
         });
      },

      /**
       * Create and show a confirm dialog
       * 
       * @param {String} msg Message
       * @param {function} confirm
       * @param {function} dismiss
       * @returns {undefined}
       */
      showConfirmDialog: function(msg, confirm, dismiss) {
         jsxc.gui.dialog.open(jsxc.gui.template.get('confirmDialog', null, msg), {
            noClose: true
         });

         if (confirm) {
            $('#jsxc_dialog .creation').click(confirm);
         }

         if (dismiss) {
            $('#jsxc_dialog .jsxc_cancel').click(dismiss);
         }
      },

      /**
       * Show about dialog.
       * 
       * @memberOf jsxc.gui
       */
      showAboutDialog: function() {
         jsxc.gui.dialog.open(jsxc.gui.template.get('aboutDialog'));

         $('#jsxc_dialog .jsxc_debuglog').click(function() {
            jsxc.gui.showDebugLog();
         });
      },

      /**
       * Show debug log.
       * 
       * @memberOf jsxc.gui
       */
      showDebugLog: function() {
         var userInfo = '<h3>User information</h3>';

         if (navigator) {
            var key;
            for (key in navigator) {
               if (navigator.hasOwnProperty(key) && typeof navigator[key] === 'string') {
                  userInfo += '<b>' + key + ':</b> ' + navigator[key] + '<br />';
               }
            }
         }

         if (window.screen) {
            userInfo += '<b>Height:</b> ' + window.screen.height + '<br />';
            userInfo += '<b>Width:</b> ' + window.screen.width + '<br />';
         }

         userInfo += '<b>jsxc version:</b> ' + jsxc.version + '<br />';

         jsxc.gui.dialog.open('<div class="jsxc_log">' + userInfo + '<h3>Log</h3><pre>' + jsxc.escapeHTML(jsxc.log) + '</pre></div>');
      },

      /**
       * Show vCard of user with the given bar jid.
       * 
       * @memberOf jsxc.gui
       * @param {String} jid
       */
      showVcard: function(jid) {
         var bid = jsxc.jidToBid(jid);
         jsxc.gui.dialog.open(jsxc.gui.template.get('vCard', bid));

         var data = jsxc.storage.getUserItem('buddy', bid);

         if (data) {
            // Display resources and corresponding information
            var i, j, res, identities, identity = null, cap, client;
            for (i = 0; i < data.res.length; i++) {
               res = data.res[i];

               identities = [];
               cap = jsxc.xmpp.getCapabilitiesByJid(bid + '/' + res);

               if (cap !== null && cap.identities !== null) {
                  identities = cap.identities;
               }

               client = '';
               for (j = 0; j < identities.length; j++) {
                  identity = identities[j];
                  if (identity.category === 'client') {
                     if (client !== '') {
                        client += ',\n';
                     }

                     client += identity.name + ' (' + identity.type + ')';
                  }
               }

               var status = jsxc.storage.getUserItem('res', bid)[res];

               $('#jsxc_dialog ul.jsxc_vCard').append('<li class="jsxc_sep"><strong>' + jsxc.translate('%%Resource%%') + ':</strong> ' + res + '</li>');
               $('#jsxc_dialog ul.jsxc_vCard').append('<li><strong>' + jsxc.translate('%%Client%%') + ':</strong> ' + client + '</li>');
               $('#jsxc_dialog ul.jsxc_vCard').append('<li>' + jsxc.translate('<strong>%%Status%%:</strong> %%' + jsxc.CONST.STATUS[status] + '%%') + '</li>');
            }
         }

         var printProp = function(el, depth) {
            var content = '';

            el.each(function() {
               var item = $(this);
               var children = $(this).children();

               content += '<li>';

               var prop = jsxc.translate('%%' + item[0].tagName + '%%');

               if (prop !== ' ') {
                  content += '<strong>' + prop + ':</strong> ';
               }

               if (item[0].tagName === 'PHOTO') {

               } else if (children.length > 0) {
                  content += '<ul>';
                  content += printProp(children, depth + 1);
                  content += '</ul>';
               } else if (item.text() !== '') {
                  content += jsxc.escapeHTML(item.text());
               }

               content += '</li>';

               if (depth === 0 && $('#jsxc_dialog ul.jsxc_vCard').length > 0) {
                  if ($('#jsxc_dialog ul.jsxc_vCard li.jsxc_sep:first').length > 0) {
                     $('#jsxc_dialog ul.jsxc_vCard li.jsxc_sep:first').before(content);
                  } else {
                     $('#jsxc_dialog ul.jsxc_vCard').append(content);
                  }
                  content = '';
               }
            });

            if (depth > 0) {
               return content;
            }
         };

         var failedToLoad = function() {
            if ($('#jsxc_dialog ul.jsxc_vCard').length === 0) {
               return;
            }

            $('#jsxc_dialog p').remove();

            var content = '<p>';
            content += jsxc.translate('%%Sorry, your buddy doesn\'t provide any information.%%');
            content += '</p>';

            $('#jsxc_dialog').append(content);
         };

         jsxc.xmpp.loadVcard(bid, function(stanza) {

            if ($('#jsxc_dialog ul.jsxc_vCard').length === 0) {
               return;
            }

            $('#jsxc_dialog p').remove();

            var photo = $(stanza).find("vCard > PHOTO");

            if (photo.length > 0) {
               var img = photo.find('BINVAL').text();
               var type = photo.find('TYPE').text();
               var src = 'data:' + type + ';base64,' + img;

               if (photo.find('EXTVAL').length > 0) {
                  src = photo.find('EXTVAL').text();
               }

               // concat chunks
               src = src.replace(/[\t\r\n\f]/gi, '');

               var img_el = $('<img class="jsxc_vCard" alt="avatar" />');
               img_el.attr('src', src);

               $('#jsxc_dialog h3').before(img_el);
            }

            if ($(stanza).find('vCard').length === 0 || ($(stanza).find('vcard > *').length === 1 && photo.length === 1)) {
               failedToLoad();
               return;
            }

            printProp($(stanza).find('vcard > *'), 0);

         }, failedToLoad);
      },

      showSettings: function() {
         jsxc.gui.dialog.open(jsxc.gui.template.get('settings'));

         if (jsxc.options.get('xmpp').overwrite === 'false' || jsxc.options.get('xmpp').overwrite === false) {
            $('.jsxc_fieldsetXmpp').hide();
         }

         $('#jsxc_dialog form').each(function() {
            var self = $(this);

            self.find('input[type!="submit"]').each(function() {
               var id = this.id.split("-");
               var prop = id[0];
               var key = id[1];
               var type = this.type;

               var data = jsxc.options.get(prop);

               if (data && typeof data[key] !== 'undefined') {
                  if (type === 'checkbox') {
                     if (data[key] !== 'false' && data[key] !== false) {
                        this.checked = 'checked';
                     }
                  } else {
                     $(this).val(data[key]);
                  }
               }
            });
         });

         $('#jsxc_dialog form').submit(function() {

            var self = $(this);
            var data = {};

            self.find('input[type!="submit"]').each(function() {
               var id = this.id.split("-");
               var prop = id[0];
               var key = id[1];
               var val;
               var type = this.type;

               if (type === 'checkbox') {
                  val = this.checked;
               } else {
                  val = $(this).val();
               }

               if (!data[prop]) {
                  data[prop] = {};
               }

               data[prop][key] = val;
            });

            $.each(data, function(key, val) {
               jsxc.options.set(key, val);
            });

            var err = jsxc.options.saveSettinsPermanent.call(this, data);

            if (typeof self.attr('data-onsubmit') === 'string') {
               jsxc.exec(self.attr('data-onsubmit'), [ err ]);
            }

            setTimeout(function() {
               self.find('input[type="submit"]').effect('highlight', {
                  color: (err) ? 'green' : 'red'
               }, 4000);
            }, 200);

            return false;
         });
      },

      /**
       * Show prompt for notification permission.
       * 
       * @memberOf jsxc.gui
       */
      showRequestNotification: function() {
         jsxc.gui.showConfirmDialog(jsxc.translate("%%Should we notify you_%%"), function() {
            jsxc.gui.dialog.open(jsxc.gui.template.get('pleaseAccept'), {
               noClose: true
            });

            jsxc.notification.requestPermission();
         }, function() {
            $(document).trigger('notificationfailure.jsxc');
         });
      },

      showUnknownSender: function(bid) {
         jsxc.gui.showConfirmDialog(jsxc.translate('%%You_received_a_message_from_an_unknown_sender%% (' + bid + '). %%Do_you_want_to_display_them%%'), function() {

            jsxc.gui.dialog.close();

            jsxc.storage.saveBuddy(bid, {
               jid: bid,
               name: bid,
               status: 0,
               sub: 'none',
               res: []
            });

            jsxc.gui.window.open(bid);

         }, function() {
            // reset state
            jsxc.storage.removeUserItem('chat', bid);
         });
      },

      /**
       * Change own presence to pres.
       * 
       * @memberOf jsxc.gui
       * @param pres {CONST.STATUS} New presence state
       * @param external {boolean} True if triggered from other tab.
       */
      changePresence: function(pres, external) {

         if (external !== true) {
            jsxc.storage.setUserItem('presence', pres);
         }

         if (jsxc.master) {
            jsxc.xmpp.sendPres();
         }

         $('#jsxc_presence > span').text($('#jsxc_presence > ul .jsxc_' + pres).text());

         jsxc.gui.updatePresence('own', pres);
      },

      /**
       * Update all presence objects for given user.
       * 
       * @memberOf jsxc.gui
       * @param bid bar jid of user.
       * @param {CONST.STATUS} pres New presence state.
       */
      updatePresence: function(bid, pres) {

         if (bid === 'own') {
            if (pres === 'dnd') {
               $('#jsxc_menu .jsxc_muteNotification').addClass('jsxc_disabled');
               jsxc.notification.muteSound(true);
            } else {
               $('#jsxc_menu .jsxc_muteNotification').removeClass('jsxc_disabled');

               if (!jsxc.options.get('muteNotification')) {
                  jsxc.notification.unmuteSound(true);
               }
            }
         }

         $('.jsxc_presence[data-bid="' + bid + '"]').removeClass('jsxc_' + jsxc.CONST.STATUS.join(' jsxc_')).addClass('jsxc_' + pres);
      },

      /**
       * Switch read state to UNread.
       * 
       * @memberOf jsxc.gui
       * @param bid
       */
      unreadMsg: function(bid) {
         var win = jsxc.gui.window.get(bid);

         jsxc.gui.roster.getItem(bid).add(win).addClass('jsxc_unreadMsg');
         jsxc.storage.updateUserItem('window', bid, 'unread', true);
      },

      /**
       * Switch read state to read.
       * 
       * @memberOf jsxc.gui
       * @param bid
       */
      readMsg: function(bid) {
         var win = jsxc.gui.window.get(bid);

         if (win.hasClass('jsxc_unreadMsg')) {
            jsxc.gui.roster.getItem(bid).add(win).removeClass('jsxc_unreadMsg');
            jsxc.storage.updateUserItem('window', bid, 'unread', false);
         }
      },

      /**
       * This function searches for URI scheme according to XEP-0147.
       * 
       * @memberOf jsxc.gui
       * @param container In which element should we search?
       */
      detectUriScheme: function(container) {
         container = (container) ? $(container) : $('body');

         container.find("a[href^='xmpp:']").each(function() {

            var element = $(this);
            var href = element.attr('href').replace(/^xmpp:/, '');
            var jid = href.split('?')[0];
            var action, params = {};

            if (href.indexOf('?') < 0) {
               action = 'message';
            } else {
               var pairs = href.substring(href.indexOf('?') + 1).split(';');
               action = pairs[0];

               var i, key, value;
               for (i = 1; i < pairs.length; i++) {
                  key = pairs[i].split('=')[0];
                  value = (pairs[i].indexOf('=') > 0) ? pairs[i].substring(pairs[i].indexOf('=') + 1) : null;

                  params[decodeURIComponent(key)] = decodeURIComponent(value);
               }
            }

            if (typeof jsxc.gui.queryActions[action] === 'function') {
               element.addClass('jsxc_uriScheme jsxc_uriScheme_' + action);

               element.off('click').click(function(ev) {
                  ev.stopPropagation();

                  jsxc.gui.queryActions[action].call(jsxc, jid, params);

                  return false;
               });
            }
         });
      },

      detectEmail: function(container) {
         container = (container) ? $(container) : $('body');

         container.find('a[href^="mailto:"]').each(function() {
            var spot = $("<span>X</span>").addClass("jsxc_spot");
            var href = $(this).attr("href").replace(/^ *mailto:/, "").trim();

            if (href !== '' && href !== Strophe.getBareJidFromJid(jsxc.storage.getItem("jid"))) {
               var bid = jsxc.jidToBid(href);
               var self = $(this);
               var s = self.prev();

               if (!s.hasClass('jsxc_spot')) {
                  s = spot.clone().attr('data-bid', bid);

                  self.before(s);
               }

               s.off('click');

               if (jsxc.storage.getUserItem('buddy', bid)) {
                  jsxc.gui.update(bid);
                  s.click(function() {
                     jsxc.gui.window.open(bid);

                     return false;
                  });
               } else {
                  s.click(function() {
                     jsxc.gui.showContactDialog(href);

                     return false;
                  });
               }
            }
         });
      }
   };

   /**
    * Handle functions related to the gui of the roster
    * 
    * @namespace jsxc.gui.roster
    */
   jsxc.gui.roster = {

      /**
       * Init the roster skeleton
       * 
       * @memberOf jsxc.gui.roster
       * @returns {undefined}
       */
      init: function() {
console.log("roster.init called");

         if (jsxc.el_exists('#jsxc_roster')) {
            return;
         }
         $(jsxc.options.rosterAppend + ':first').append($(jsxc.gui.template.get('roster')));

         if (jsxc.options.get('hideOffline')) {
            $('#jsxc_menu .jsxc_hideOffline').text(jsxc.translate('%%Show offline%%'));
            $('#jsxc_buddylist').addClass('jsxc_hideOffline');
         }

         $('#jsxc_menu .jsxc_logout').click(function() {
            jsxc.options.logoutElement = $(this);
            jsxc.triggeredFromLogout = true;
            return jsxc.xmpp.logout();
         });

         $('#jsxc_menu .jsxc_reload').click(function() {
            location.reload();
         });

         $('#jsxc_menu .jsxc_settings').click(function() {
            jsxc.gui.showSettings();
         });

         $('#jsxc_menu .jsxc_hideOffline').click(function() {
            var hideOffline = !jsxc.options.get('hideOffline');

            if (hideOffline) {
               $('#jsxc_buddylist').addClass('jsxc_hideOffline');
            } else {
               $('#jsxc_buddylist').removeClass('jsxc_hideOffline');
            }

            $(this).text(hideOffline ? jsxc.translate('%%Show offline%%') : jsxc.translate('%%Hide offline%%'));

            jsxc.options.set('hideOffline', hideOffline);
         });

         if (jsxc.options.get('muteNotification')) {
            jsxc.notification.muteSound();
         }

         $('#jsxc_menu .jsxc_muteNotification').click(function() {

            if (jsxc.storage.getUserItem('presence') === 'dnd') {
               return;
            }

            // invert current choice
            var mute = !jsxc.options.get('muteNotification');

            if (mute) {
               jsxc.notification.muteSound();
            } else {
               jsxc.notification.unmuteSound();
            }
         });

         $('#jsxc_roster .jsxc_addBuddy').click(function() {
            jsxc.gui.showContactDialog();
         });

         $('#jsxc_roster .jsxc_onlineHelp').click(function() {
            window.open("http://www.jsxc.org/manual.html", "onlineHelp");
         });

         $('#jsxc_roster .jsxc_about').click(function() {
            jsxc.gui.showAboutDialog();
         });

         $('#jsxc_toggleRoster').click(function() {
            jsxc.gui.roster.toggle();
         });

         $('#jsxc_presence > ul > li').click(function() {
            var self = $(this);

            jsxc.gui.changePresence(self.data('pres'));
         });

         //$('#jsxc_buddylist').slimScroll({
         //   distance: '3px',
         //   height: ($('#jsxc_roster').height() - 31) + 'px',
         //   width: $('#jsxc_buddylist').width() + 'px',
         //   color: '#fff',
         //   opacity: '0.5'
         //});

         $('#jsxc_roster > .jsxc_bottom > div').each(function() {
            jsxc.gui.toggleList.call($(this));
         });

         if (jsxc.storage.getUserItem('roster') === 'hidden') {
            //$('#jsxc_roster').css('right', '-200px');
            $('#jsxc_windowList > ul').css('paddingRight', '10px');
         }

         var pres = jsxc.storage.getUserItem('presence') || 'online';
         $('#jsxc_presence > span').text($('#jsxc_presence > ul .jsxc_' + pres).text());
         jsxc.gui.updatePresence('own', pres);

         jsxc.gui.tooltip('#jsxc_roster');

         jsxc.notice.load();

         $(document).trigger('ready.roster.jsxc');
      },

      /**
       * Create roster item and add it to the roster
       * 
       * @param {String} bid bar jid
       */
      add: function(bid) {
         var data = jsxc.storage.getUserItem('buddy', bid);
         var bud = jsxc.gui.buddyTemplate.clone().attr('data-bid', bid).attr('data-type', data.type || 'chat');

         jsxc.gui.roster.insert(bid, bud);

         bud.click(function() {
            jsxc.gui.window.open(bid);
         });

         bud.find('.jsxc_chaticon').click(function() {
            jsxc.gui.window.open(bid);
         });

         bud.find('.jsxc_rename').click(function() {
            jsxc.gui.roster.rename(bid);
            return false;
         });

         bud.find('.jsxc_delete').click(function() {
            jsxc.gui.showRemoveDialog(bid);
            return false;
         });

         var expandClick = function() {
            bud.trigger('extra.jsxc');

            bud.toggleClass('jsxc_expand');

            jsxc.gui.updateAvatar(bud, data.jid, data.avatar);
            return false;
         };

         bud.find('.jsxc_control').click(expandClick);
         bud.dblclick(expandClick);

         bud.find('.jsxc_vcardicon').click(function() {
            jsxc.gui.showVcard(data.jid);
            return false;
         });

         jsxc.gui.update(bid);

         // update scrollbar
         //$('#jsxc_buddylist').slimScroll({
         //   scrollTo: '0px'
         //});

         $(document).trigger('add.roster.jsxc', [ bid, data, bud ]);
      },

      getItem: function(bid) {
         return $("#jsxc_buddylist > li[data-bid='" + bid + "']");
      },

      /**
       * Insert roster item. First order: online > away > offline. Second order:
       * alphabetical of the name
       * 
       * @param {type} bid
       * @param {jquery} li roster item which should be insert
       * @returns {undefined}
       */
      insert: function(bid, li) {

         var data = jsxc.storage.getUserItem('buddy', bid);
         var listElements = $('#jsxc_buddylist > li');
         var insert = false;

         // Insert buddy with no mutual friendship to the end
         var status = (data.sub === 'both') ? data.status : -1;

         listElements.each(function() {

            var thisStatus = ($(this).data('sub') === 'both') ? $(this).data('status') : -1;

            if (($(this).data('name').toLowerCase() > data.name.toLowerCase() && thisStatus === status) || thisStatus < status) {

               $(this).before(li);
               insert = true;

               return false;
            }
         });

         if (!insert) {
            li.appendTo('#jsxc_buddylist');
         }
      },

      /**
       * Initiate reorder of roster item
       * 
       * @param {type} bid
       * @returns {undefined}
       */
      reorder: function(bid) {
         jsxc.gui.roster.insert(bid, jsxc.gui.roster.remove(bid));
      },

      /**
       * Removes buddy from roster
       * 
       * @param {String} bid bar jid
       * @return {JQueryObject} Roster list element
       */
      remove: function(bid) {
         return jsxc.gui.roster.getItem(bid).detach();
      },

      /**
       * Removes buddy from roster and clean up
       * 
       * @param {String} bid bar compatible jid
       */
      purge: function(bid) {
         if (jsxc.master) {
            jsxc.storage.removeUserItem('buddy', bid);
            jsxc.storage.removeUserItem('otr', bid);
            jsxc.storage.removeUserItem('otr_version_' + bid);
            jsxc.storage.removeUserItem('chat', bid);
            jsxc.storage.removeUserItem('window', bid);
            jsxc.storage.removeUserElement('buddylist', bid);
            jsxc.storage.removeUserElement('windowlist', bid);
         }

         jsxc.gui.window._close(bid);
         jsxc.gui.roster.remove(bid);
      },

      /**
       * Create input element for rename action
       * 
       * @param {type} bid
       * @returns {undefined}
       */
      rename: function(bid) {
         var name = jsxc.gui.roster.getItem(bid).find('.jsxc_name');
         var options = jsxc.gui.roster.getItem(bid).find('.jsxc_options, .jsxc_control');
         var input = $('<input type="text" name="name"/>');

         options.hide();
         name = name.replaceWith(input);

         input.val(name.text());
         input.keypress(function(ev) {
            if (ev.which !== 13) {
               return;
            }

            options.show();
            input.replaceWith(name);
            jsxc.gui.roster._rename(bid, $(this).val());

            $('html').off('click');
         });

         // Disable html click event, if click on input
         input.click(function() {
            return false;
         });

         $('html').one('click', function() {
            options.show();
            input.replaceWith(name);
            jsxc.gui.roster._rename(bid, input.val());
         });
      },

      /**
       * Rename buddy
       * 
       * @param {type} bid
       * @param {type} newname new name of buddy
       * @returns {undefined}
       */
      _rename: function(bid, newname) {
         if (jsxc.master) {
            var d = jsxc.storage.getUserItem('buddy', bid);
            var iq = $iq({
               type: 'set'
            }).c('query', {
               xmlns: 'jabber:iq:roster'
            }).c('item', {
               jid: Strophe.getBareJidFromJid(d.jid),
               name: newname
            });
            jsxc.xmpp.conn.sendIQ(iq);
         }

         jsxc.storage.updateUserItem('buddy', bid, 'name', newname);
         jsxc.gui.update(bid);
      },

      /**
       * Toogle complete roster
       * 
       * @param {Integer} d Duration in ms
       */
      toggle: function(d) {
         var duration = d || 500;

         var roster = $('#jsxc_roster');
         var wl = $('#jsxc_windowList');

         var roster_width = roster.innerWidth();
         var roster_right = parseFloat($('#jsxc_roster').css('right'));
         var state = (roster_right < 0) ? 'shown' : 'hidden';

         jsxc.storage.setUserItem('roster', state);

         roster.animate({
            right: ((roster_width + roster_right) * -1) + 'px'
         }, duration);
         wl.animate({
            right: (10 - roster_right) + 'px'
         }, duration);

         $(document).trigger('toggle.roster.jsxc', [ state, duration ]);
      },

      /**
       * Shows a text with link to a login box that no connection exists.
       */
      noConnection: function() {
         $('#jsxc_roster').addClass('jsxc_noConnection');

         jsxc.gui.showLoginBox();
         $('#jsxc_roster').append($('<p>' + jsxc.l.no_connection + '</p>').append(' <a>' + jsxc.l.relogin + '</a>').click(function() {
            jsxc.gui.showLoginBox();
         }));
      },

      /**
       * Shows a text with link to add a new buddy.
       * 
       * @memberOf jsxc.gui.roster
       */
      empty: function() {
         var text = $('<p>' + jsxc.l.Your_roster_is_empty_add_a + '</p>');
         var link = $('<a>' + jsxc.l.new_buddy + '</a>');

         link.click(function() {
            jsxc.gui.showContactDialog();
         });
         text.append(link);
         text.append('.');

         $('#jsxc_roster').prepend(text);
      }
   };

   /**
    * Wrapper for dialog
    * 
    * @namespace jsxc.gui.dialog
    */
   jsxc.gui.dialog = {
      /**
       * Open a Dialog.
       * 
       * @memberOf jsxc.gui.dialog
       * @param {String} data Data of the dialog
       * @param {Object} [o] Options for the dialog
       * @param {Boolean} [o.noClose] If true, hide all default close options
       * @returns {jQuery} Dialog object
       */
      open: function(data, o) {

         var opt = o || {};

         // default options
         var options = {};
         options = {
            onComplete: function() {
               $('#jsxc_dialog .jsxc_close').click(function(ev) {
                  ev.preventDefault();

                  jsxc.gui.dialog.close();
               });

               // workaround for old colorbox version (used by firstrunwizard)
               if (options.closeButton === false) {
                  $('#cboxClose').hide();
               }

               $.colorbox.resize();

               $(document).trigger('complete.dialog.jsxc');
            },
            onClosed: function() {
               $(document).trigger('close.dialog.jsxc');
            },
            onCleanup: function() {
               $(document).trigger('cleanup.dialog.jsxc');
            },
            opacity: 0.5
         };

         if (opt.noClose) {
            options.overlayClose = false;
            options.escKey = false;
            options.closeButton = false;
            delete opt.noClose;
         }

         $.extend(options, opt);

         options.html = '<div id="jsxc_dialog">' + data + '</div>';

         $.colorbox(options);

         return $('#jsxc_dialog');
      },

      /**
       * Close current dialog.
       */
      close: function() {
         jsxc.debug('close dialog');
         $.colorbox.close();
      },

      /**
       * Resizes current dialog.
       * 
       * @param {Object} options e.g. width and height
       */
      resize: function(options) {
         $.colorbox.resize(options);
      }
   };

   /**
    * Handle functions related to the gui of the window
    * 
    * @namespace jsxc.gui.window
    */
   jsxc.gui.window = {
      /**
       * Init a window skeleton
       * 
       * @memberOf jsxc.gui.window
       * @param {String} bid
       * @returns {jQuery} Window object
       */
      init: function(bid) {
         if (jsxc.gui.window.get(bid).length > 0) {
            return jsxc.gui.window.get(bid);
         }

         var win = jsxc.gui.windowTemplate.clone().attr('data-bid', bid).hide().appendTo('body').show('slow');
         var data = jsxc.storage.getUserItem('buddy', bid);

         // Attach jid to window
         win.data('jid', data.jid);

         // Add handler

         jsxc.gui.toggleList.call(win.find('.jsxc_settings'));

         win.find('.jsxc_verification').click(function() {
            jsxc.gui.showVerification(bid);
         });

         win.find('.jsxc_fingerprints').click(function() {
            jsxc.gui.showFingerprints(bid);
         });

         win.find('.jsxc_transfer').click(function() {
            jsxc.otr.toggleTransfer(bid);
         });

         win.find('.jsxc_bar').click(function() {
            jsxc.gui.window.toggle(bid);
         });

         win.find('.jsxc_close').click(function() {
            jsxc.gui.window.close(bid);
         });

         win.find('.jsxc_clear').click(function() {
            jsxc.gui.window.clear(bid);
         });

         win.find('.jsxc_tools').click(function() {
            return false;
         });

         win.find('.jsxc_textinput').keyup(function(ev) {
            var body = $(this).val();

            if (ev.which === 13) {
               body = '';
            }

            jsxc.storage.updateUserItem('window', bid, 'text', body);

            if (ev.which === 27) {
               jsxc.gui.window.close(bid);
            }
         }).keypress(function(ev) {
            if (ev.which !== 13 || !$(this).val()) {
               return;
            }

            jsxc.gui.window.postMessage(bid, 'out', $(this).val());

            $(this).val('');
         }).focus(function() {
            // remove unread flag
            jsxc.gui.readMsg(bid);
         }).mouseenter(function() {
            $('#jsxc_windowList').data('isOver', true);
         }).mouseleave(function() {
            $('#jsxc_windowList').data('isOver', false);
         });

         win.find('.jsxc_textarea').click(function() {
            win.find('.jsxc_textinput').focus();
         });

         //win.find('.jsxc_textarea').slimScroll({
         //   height: '234px',
         //   distance: '3px'
         //});

         //win.find('.jsxc_fade').hide();

         win.find('.jsxc_name').disableSelection();

         //win.find('.slimScrollDiv').resizable({
         //   handles: 'w, nw, n',
         //   minHeight: 234,
         //   minWidth: 250,
         //   resize: function(event, ui) {
         //      win.width(ui.size.width);
         //      win.find('.jsxc_textarea').slimScroll({
         //         height: ui.size.height
         //      });
         //      win.find('.jsxc_emoticons').css('top', (ui.size.height + 6) + 'px');
         //   }
         //});

         if ($.inArray(bid, jsxc.storage.getUserItem('windowlist')) < 0) {

            // add window to windowlist
            var wl = jsxc.storage.getUserItem('windowlist');
            wl.push(bid);
            jsxc.storage.setUserItem('windowlist', wl);

            // init window element in storage
            jsxc.storage.setUserItem('window', bid, {
               minimize: true,
               text: '',
               unread: false
            });
         } else {

            if (jsxc.storage.getUserItem('window', bid).unread) {
               jsxc.gui.unreadMsg(bid);
            }
         }

         $.each(jsxc.gui.emotions, function(i, val) {
            var ins = val[0].split(' ')[0];
            var li = $('<li><div title="' + ins + '" class="jsxc_' + val[1] + '"/></li>');
            li.click(function() {
               win.find('input').val(win.find('input').val() + ins);
               win.find('input').focus();
            });
            win.find('.jsxc_emoticons ul').append(li);
         });

         jsxc.gui.toggleList.call(win.find('.jsxc_emoticons'));

         jsxc.gui.window.restoreChat(bid);

         jsxc.gui.update(bid);

         //jsxc.gui.updateWindowListSB();

         // create related otr object
         if (jsxc.master && !jsxc.otr.objects[bid]) {
            jsxc.otr.create(bid);
         } else {
            jsxc.otr.enable(bid);
         }

         $(document).trigger('init.window.jsxc', [ win ]);

         return win;
      },

      /**
       * Returns the window element
       * 
       * @param {String} bid
       * @returns {jquery} jQuery object of the window element
       */
      get: function(id) {
         return $(".jsxc_windowItem[data-bid='" + jsxc.jidToBid(id) + "']");
      },

      /**
       * Open a window, related to the bid. If the window doesn't exist, it will
       * be created.
       * 
       * @param {String} bid
       * @returns {jQuery} Window object
       */
      open: function(bid) {
         return openChat(bid);

         //var win = jsxc.gui.window.init(bid);
         //jsxc.gui.window.show(bid);
         //jsxc.gui.window.highlight(bid);
         //
         //var padding = $("#jsxc_windowListSB").width();
         //var innerWidth = $('#jsxc_windowList>ul').width();
         //var outerWidth = $('#jsxc_windowList').width() - padding;
         //
         //if (innerWidth > outerWidth) {
         //   var offset = parseInt($('#jsxc_windowList>ul').css('right'));
         //   var width = win.outerWidth(true);
         //
         //   var right = innerWidth - win.position().left - width + offset;
         //   var left = outerWidth - (innerWidth - win.position().left) - offset;
         //
         //   if (left < 0) {
         //      jsxc.gui.scrollWindowListBy(left * -1);
         //   }
         //
         //   if (right < 0) {
         //      jsxc.gui.scrollWindowListBy(right);
         //   }
         //}
         //
         //return win;
      },

      /**
       * Close chatwindow and clean up
       * 
       * @param {String} bid bar jid
       */
      close: function(bid) {

         if (jsxc.gui.window.get(bid).length === 0) {
            jsxc.warn('Want to close a window, that is not open.');
            return;
         }

         jsxc.storage.removeUserElement('windowlist', bid);
         jsxc.storage.removeUserItem('window', bid);

         if (jsxc.storage.getUserItem('buddylist').indexOf(bid) < 0) {
            // delete data from unknown sender

            jsxc.storage.removeUserItem('buddy', bid);
            jsxc.storage.removeUserItem('chat', bid);
         }

         jsxc.gui.window.get(bid).remove();
         jsxc.gui.window._close(bid);
      },

      /**
       * Close chatwindow
       * 
       * @param {String} bid
       */
      _close: function(bid) {
         window.close()
      //   jsxc.gui.window.get(bid).hide('slow', function() {
      //      $(this).remove();
      //
      //      jsxc.gui.updateWindowListSB();
      //   });
      },

      /**
       * Toggle between minimize and maximize of the text area
       * 
       * @param {String} bid bar jid
       */
      toggle: function(bid) {

         //var win = jsxc.gui.window.get(bid);
         //
         //if (win.parents("#jsxc_windowList").length === 0) {
         //   return;
         //}

         //if (win.find('.jsxc_fade').is(':hidden')) {
         //   jsxc.gui.window.show(bid);
         //} else {
         //   jsxc.gui.window.hide(bid);
         //}
         //
         //jsxc.gui.updateWindowListSB();
      },

      /**
       * Maximize text area and save
       * 
       * @param {String} bid
       */
      show: function(bid) {

         //jsxc.storage.updateUserItem('window', bid, 'minimize', false);

         jsxc.gui.window._show(bid);
      },

      /**
       * Maximize text area
       * 
       * @param {String} bid
       * @returns {undefined}
       */
      _show: function(bid) {
         var win = jsxc.gui.window.get(bid);
         //jsxc.gui.window.get(bid).find('.jsxc_fade').slideDown();
         win.removeClass('jsxc_min');

         // If the area is hidden, the scrolldown function doesn't work. So we
         // call it here.
         jsxc.gui.window.scrollDown(bid);

         if (jsxc.restoreCompleted) {
            win.find('.jsxc_textinput').focus();
         }

         win.trigger('show.window.jsxc');
      },

      /**
       * Minimize text area and save
       * 
       * @param {String} bid
       */
      hide: function(bid) {
         jsxc.storage.updateUserItem('window', bid, 'minimize', true);

         jsxc.gui.window._hide(bid);
      },

      /**
       * Minimize text area
       * 
       * @param {String} bid
       */
      _hide: function(bid) {
         //jsxc.gui.window.get(bid).addClass('jsxc_min').find(' .jsxc_fade').slideUp();

         jsxc.gui.window.get(bid).trigger('hidden.window.jsxc');
      },

      /**
       * Highlight window
       * 
       * @param {type} bid
       */
      highlight: function(bid) {
         var el = jsxc.gui.window.get(bid).find(' .jsxc_bar');

         if (!el.is(':animated')) {
            el.effect('highlight', {
               color: 'orange'
            }, 2000);
         }
      },

      /**
       * Scroll chat area to the bottom
       * 
       * @param {String} bid bar jid
       */
      scrollDown: function(bid) {
         var chat = jsxc.gui.window.get(bid).find('.jsxc_textarea');

         // check if chat exist
         if (chat.length === 0) {
            return;
         }
         chat.get(0).scrollTop = chat.get(0).scrollHeight;
         //chat.slimScroll({
         //   scrollTo: (chat.get(0).scrollHeight + 'px')
         //});
      },

      /**
       * Write Message to chat area and save
       * 
       * @param {String} bid bar jid
       * @param {String} direction 'in' message is received or 'out' message is
       *        send
       * @param {String} msg Message to display
       * @param {boolean} encrypted Was this message encrypted? Default: false
       * @param {boolean} forwarded Was this message forwarded? Default: false
       * @param {integer} stamp Timestamp
       */
      postMessage: function(bid, direction, msg, encrypted, forwarded, stamp) {
         var data = jsxc.storage.getUserItem('buddy', bid);
         var html_msg = msg;

         // remove html tags and reencode html tags
         msg = jsxc.removeHTML(msg);
         msg = jsxc.escapeHTML(msg);

         // exceptions:

         if (direction === 'out' && data.msgstate === OTR.CONST.MSGSTATE_FINISHED && forwarded !== true) {
            direction = 'sys';
            msg = jsxc.l.your_message_wasnt_send_please_end_your_private_conversation;
         }

         if (direction === 'in' && data.msgstate === OTR.CONST.MSGSTATE_FINISHED) {
            direction = 'sys';
            msg = jsxc.l.unencrypted_message_received + ' ' + msg;
         }

         if (direction === 'out' && data.sub === 'from') {
            direction = 'sys';
            msg = jsxc.l.your_message_wasnt_send_because_you_have_no_valid_subscription;
         }

         encrypted = encrypted || data.msgstate === OTR.CONST.MSGSTATE_ENCRYPTED;
         var post = jsxc.storage.saveMessage(bid, direction, msg, encrypted, forwarded, stamp);

         if (direction === 'in') {
            $(document).trigger('postmessagein.jsxc', [ bid, html_msg ]);
         }

         if (direction === 'out' && jsxc.master && forwarded !== true) {
            jsxc.xmpp.sendMessage(bid, html_msg, post.uid);
         }

         jsxc.gui.window._postMessage(bid, post);

         if (direction === 'out' && msg === '?') {
            jsxc.gui.window.postMessage(bid, 'sys', '42');
         }
      },

      /**
       * Write Message to chat area
       * 
       * @param {String} bid bar jid
       * @param {Object} post Post object with direction, msg, uid, received
       * @param {Bool} restore If true no highlights are used and so unread flag
       *        set
       */
      _postMessage: function(bid, post, restore) {
         var win = jsxc.gui.window.get(bid);
         var msg = post.msg;
         var direction = post.direction;
         var uid = post.uid;

         if (win.find('.jsxc_textinput').is(':not(:focus)') && jsxc.restoreCompleted && direction === 'in' && !restore) {
            jsxc.gui.window.highlight(bid);
         }

         msg = msg.replace(jsxc.CONST.REGEX.URL, function(url) {

            var href = (url.match(/^https?:\/\//i)) ? url : 'http://' + url;

            return '<a href="' + href + '" target="_blank">' + url + '</a>';
         });

         msg = msg.replace(new RegExp('(xmpp:)?(' + jsxc.CONST.REGEX.JID.source + ')(\\?[^\\s]+\\b)?', 'i'), function(match, protocol, jid, action) {
            if (protocol === 'xmpp:') {
               if (typeof action === 'string') {
                  jid += action;
               }

               return '<a href="xmpp:' + jid + '">' + jid + '</a>';
            }

            return '<a href="mailto:' + jid + '" target="_blank">' + jid + '</a>';
         });

         $.each(jsxc.gui.emotions, function(i, val) {
            msg = msg.replace(val[2], function(match, p1) {

               // escape value for alt and title, this prevents double
               // replacement
               var esc = '', i;
               for (i = 0; i < p1.length; i++) {
                  esc += '&#' + p1.charCodeAt(i) + ';';
               }

               return '<div title="' + esc + '" class="jsxc_emoticon jsxc_' + val[1] + '"/>';
            });
         });

         var msgDiv = $("<div>"), msgTsDiv = $("<div>");
         msgDiv.addClass('jsxc_chatmessage jsxc_' + direction);
         msgDiv.attr('id', uid);
         msgDiv.html('<div>' + msg + '</div>');
         msgTsDiv.addClass('jsxc_timestamp');
         msgTsDiv.html(jsxc.getFormattedTime(post.stamp));

         if (post.received || false) {
            msgDiv.addClass('jsxc_received');
         }

         if (post.forwarded) {
            msgDiv.addClass('jsxc_forwarded');
         }

         if (post.encrypted) {
            msgDiv.addClass('jsxc_encrypted');
         }

         if (direction === 'sys') {
            jsxc.gui.window.get(bid).find('.jsxc_textarea').append('<div style="clear:both"/>');
         } else if (typeof post.stamp !== 'undefined') {
            msgDiv.append(msgTsDiv);
         }

         win.find('.jsxc_textarea').append(msgDiv);

         jsxc.gui.detectUriScheme(win);
         jsxc.gui.detectEmail(win);

         jsxc.gui.window.scrollDown(bid);

         // if window has no focus set unread flag
         if (!win.find('.jsxc_textinput').is(':focus') && jsxc.restoreCompleted && !restore) {
            jsxc.gui.unreadMsg(bid);
         }
      },

      /**
       * Set text into input area
       * 
       * @param {type} bid
       * @param {type} text
       * @returns {undefined}
       */
      setText: function(bid, text) {
         jsxc.gui.window.get(bid).find('.jsxc_textinput').val(text);
      },

      /**
       * Load old log into chat area
       * 
       * @param {type} bid
       * @returns {undefined}
       */
      restoreChat: function(bid) {
         var chat = jsxc.storage.getUserItem('chat', bid);

         while (chat !== null && chat.length > 0) {
            var c = chat.pop();
            jsxc.gui.window._postMessage(bid, c, true);
         }
      },

      /**
       * Clear chat history
       * 
       * @param {type} bid
       * @returns {undefined}
       */
      clear: function(bid) {
         jsxc.storage.setUserItem('chat', bid, []);
         jsxc.gui.window.get(bid).find('.jsxc_textarea').empty();
      }
   };

   /**
    * Hold all HTML templates.
    * 
    * @namespace jsxc.gui.template
    */
   jsxc.gui.template = {
      /**
       * Return requested template and replace all placeholder
       * 
       * @memberOf jsxc.gui.template;
       * @param {type} name template name
       * @param {type} bid
       * @param {type} msg
       * @returns {String} HTML Template
       */
      get: function(name, bid, msg) {

         // common placeholder
         var ph = {
            my_priv_fingerprint: jsxc.storage.getUserItem('priv_fingerprint') ? jsxc.storage.getUserItem('priv_fingerprint').replace(/(.{8})/g, '$1 ') : jsxc.l.not_available,
            my_jid: jsxc.storage.getItem('jid') || '',
            my_node: Strophe.getNodeFromJid(jsxc.storage.getItem('jid') || '') || '',
            root: jsxc.options.root,
            app_name: jsxc.options.app_name
         };

         // placeholder depending on bid
         if (bid) {
            var data = jsxc.storage.getUserItem('buddy', bid);

            $.extend(ph, {
               bid_priv_fingerprint: (data && data.fingerprint) ? data.fingerprint.replace(/(.{8})/g, '$1 ') : jsxc.l.not_available,
               bid_jid: bid,
               bid_name: (data && data.name) ? data.name : bid
            });
         }

         // placeholder depending on msg
         if (msg) {
            $.extend(ph, {
               msg: msg
            });
         }

         var ret = jsxc.gui.template[name];

         if (typeof (ret) === 'string') {
            ret = jsxc.translate(ret);

            ret = ret.replace(/\{\{([a-zA-Z0-9_\-]+)\}\}/g, function(s, key) {
               return (typeof ph[key] === 'string') ? ph[key] : s;
            });

            return ret;
         }

         jsxc.debug('Template not available: ' + name);
         return name;
      },
      authenticationDialog: '<h3>Verification</h3>\
            <p>%%Authenticating_a_buddy_helps_%%</p>\
            <div>\
              <p style="margin:0px;">%%How_do_you_want_to_authenticate_your_buddy%%</p>\
              <select size="1">\
                <option>%%Select_method%%</option>\
                <option>%%Manual%%</option>\
                <option>%%Question%%</option>\
                <option>%%Secret%%</option>\
              </select>\
            </div>\
            <div style="display:none">\
              <p class=".jsxc_explanation">%%To_verify_the_fingerprint_%%</p>\
              <p><strong>%%Your_fingerprint%%</strong><br />\
              <span style="text-transform:uppercase">{{my_priv_fingerprint}}</span></p>\
              <p><strong>%%Buddy_fingerprint%%</strong><br />\
              <span style="text-transform:uppercase">{{bid_priv_fingerprint}}</span></p><br />\
              <p class="jsxc_right"><a href="#" class="jsxc_close button">%%Close%%</a> <a href="#" class="button creation">%%Compared%%</a></p>\
            </div>\
            <div style="display:none">\
              <p class=".jsxc_explanation">%%To_authenticate_using_a_question_%%</p>\
              <p><label for="jsxc_quest">%%Question%%:</label><input type="text" name="quest" id="jsxc_quest" /></p>\
              <p><label for="jsxc_secret2">%%Secret%%:</label><input type="text" name="secret2" id="jsxc_secret2" /></p>\
              <p class="jsxc_right"><a href="#" class="button jsxc_close">%%Close%%</a> <a href="#" class="button creation">%%Ask%%</a></p>\
            </div>\
            <div style="display:none">\
              <p class=".jsxc_explanation">%%To_authenticate_pick_a_secret_%%</p>\
              <p><label for="jsxc_secret">%%Secret%%:</label><input type="text" name="secret" id="jsxc_secret" /></p>\
              <p class="jsxc_right"><a href="#" class="button jsxc_close">%%Close%%</a> <a href="#" class="button creation">%%Compare%%</a></p>\
            </div>',
      fingerprintsDialog: '<div>\
          <p class="jsxc_maxWidth">%%A_fingerprint_%%</p>\
          <p><strong>%%Your_fingerprint%%</strong><br />\
          <span style="text-transform:uppercase">{{my_priv_fingerprint}}</span></p>\
          <p><strong>%%Buddy_fingerprint%%</strong><br />\
          <span style="text-transform:uppercase">{{bid_priv_fingerprint}}</span></p><br />\
          <p class="jsxc_right"><a href="#" class="button jsxc_close">%%Close%%</a></p>\
        </div>',
      chatWindow: '<div class="jsxc_windowItem">\
            <div class="jsxc_window">\
                <div class="jsxc_bar">\
                     <div class="jsxc_avatar">☺</div>\
                     <div class="jsxc_tools">\
                           <div class="jsxc_settings">\
                               <ul>\
                                   <li class="jsxc_fingerprints jsxc_otr jsxc_disabled">%%Fingerprints%%</li>\
                                   <li class="jsxc_verification">%%Authentication%%</li>\
                                   <li class="jsxc_transfer jsxc_otr jsxc_disabled">%%start_private%%</li>\
                                   <li class="jsxc_clear">%%clear_history%%</li>\
                               </ul>\
                           </div>\
                           <div class="jsxc_transfer jsxc_otr jsxc_disabled"/>\
                           <div class="jsxc_close">×</div>\
                     </div>\
                     <div class="jsxc_name"/>\
                     <div class="jsxc_cycle"/>\
                </div>\
               <div class="jsxc_textarea"/>\
               <div class="jsxc_emoticons"><ul/></div>\
               <input type="text" class="jsxc_textinput" placeholder="...%%Message%%" />\
            </div>\
        </div>',
      roster: '<div id="jsxc_roster">\
           <ul id="jsxc_buddylist"></ul>\
           <div class="jsxc_bottom jsxc_presence" data-bid="own">\
              <div id="jsxc_avatar">\
                 <div class="jsxc_avatar">☺</div>\
              </div>\
              <div id="jsxc_menu">\
                 <span></span>\
                 <ul>\
                     <li class="jsxc_settings">%%Settings%%</li>\
                     <li class="jsxc_muteNotification">%%Mute%%</li>\
                     <li class="jsxc_addBuddy">%%Add_buddy%%</li>\
                     <li class="jsxc_hideOffline">%%Hide offline%%</li>\
                     <li class="jsxc_onlineHelp">%%Online help%%</li>\
                     <li class="jsxc_about">%%About%%</li>\
                     <li class="jsxc_reload">%%Reload%%</li>\
                     <li class="jsxc_logout">%%Logout%%</li>\
                 </ul>\
              </div>\
              <div id="jsxc_notice">\
                 <span></span>\
                 <ul></ul>\
              </div>\
              <div id="jsxc_presence">\
                 <span>%%Online%%</span>\
                 <ul>\
                     <li data-pres="online" class="jsxc_online">%%Online%%</li>\
                     <li data-pres="chat" class="jsxc_chat">%%Chatty%%</li>\
                     <li data-pres="away" class="jsxc_away">%%Away%%</li>\
                     <li data-pres="xa" class="jsxc_xa">%%Extended away%%</li>\
                     <li data-pres="dnd" class="jsxc_dnd">%%dnd%%</li>\
                     <!-- <li data-pres="offline" class="jsxc_offline">%%Offline%%</li> -->\
                 </ul>\
              </div>\
           </div>\
           <div id="jsxc_toggleRoster"></div>\
       </div>',
      windowList: '<div id="jsxc_windowList">\
               <ul></ul>\
            </div>\
            <div id="jsxc_windowListSB">\
               <div class="jsxc_scrollLeft jsxc_disabled">&lt;</div>\
               <div class="jsxc_scrollRight jsxc_disabled">&gt;</div>\
            </div>',
      rosterBuddy: '<li>\
            <div class="jsxc_avatar">☺</div>\
            <div class="jsxc_control"></div>\
            <div class="jsxc_name"/>\
            <div class="jsxc_options jsxc_right">\
                <div class="jsxc_rename" title="%%rename_buddy%%">✎</div>\
                <div class="jsxc_delete" title="%%delete_buddy%%">✘</div>\
            </div>\
            <div class="jsxc_options jsxc_left">\
                <div class="jsxc_chaticon" title="%%send_message%%"/>\
                <div class="jsxc_vcardicon" title="%%get_info%%">i</div>\
            </div>\
        </li>',
      loginBox: '<h3>%%Login%%</h3>\
        <form>\
            <p><label for="jsxc_username">%%Username%%:</label>\
               <input type="text" name="username" id="jsxc_username" required="required" value="{{my_node}}"/></p>\
            <p><label for="jsxc_password">%%Password%%:</label>\
               <input type="password" name="password" required="required" id="jsxc_password" /></p>\
            <div class="bottom_submit_section">\
                <input type="reset" class="button jsxc_close" name="clear" value="%%Cancel%%"/>\
                <input type="submit" class="button creation" name="commit" value="%%Connect%%"/>\
            </div>\
        </form>',
      contactDialog: '<h3>%%Add_buddy%%</h3>\
         <p class=".jsxc_explanation">%%Type_in_the_full_username_%%</p>\
         <form>\
         <p><label for="jsxc_username">* %%Username%%:</label>\
            <input type="text" name="username" id="jsxc_username" pattern="^[^\\x22&\'\\/:<>@\\s]+(@[.\\-_\\w]+)?" required="required" /></p>\
         <p><label for="jsxc_alias">%%Alias%%:</label>\
            <input type="text" name="alias" id="jsxc_alias" /></p>\
         <p class="jsxc_right">\
            <input class="button" type="submit" value="%%Add%%" />\
         </p>\
         <form>',
      approveDialog: '<h3>%%Subscription_request%%</h3>\
        <p>%%You_have_a_request_from%% <b class="jsxc_their_jid"></b>.</p>\
        <p class="jsxc_right"><a href="#" class="button jsxc_deny">%%Deny%%</a> <a href="#" class="button creation jsxc_approve">%%Approve%%</a></p>',
      removeDialog: '<h3>%%Remove buddy%%</h3>\
        <p class="jsxc_maxWidth">%%You_are_about_to_remove_%%</p>\
        <p class="jsxc_right"><a href="#" class="button jsxc_cancel jsxc_close">%%Cancel%%</a> <a href="#" class="button creation">%%Remove%%</a></p>',
      waitAlert: '<h3>{{msg}}</h3>\
        <p>%%Please_wait%%</p>\
        <p class="jsxc_center"><img src="{{root}}img/loading.gif" alt="wait" width="32px" height="32px" /></p>',
      alert: '<h3>%%Alert%%</h3>\
        <p>{{msg}}</p>\
        <p class="jsxc_right"><a href="#" class="button jsxc_close jsxc_cancel">%%Ok%%</a></p>',
      authFailDialog: '<h3>%%Login_failed%%</h3>\
        <p>%%Sorry_we_cant_authentikate_%%</p>\
        <p class="jsxc_right">\
            <a class="button jsxc_cancel">%%Continue_without_chat%%</a>\
            <a class="button creation">%%Retry%%</a>\
        </p>',
      confirmDialog: '<p>{{msg}}</p>\
        <p class="jsxc_right">\
            <a class="button jsxc_cancel jsxc_close">%%Dismiss%%</a>\
            <a class="button creation">%%Confirm%%</a>\
        </p>',
      pleaseAccept: '<p>%%Please_accept_%%</p>',
      aboutDialog: '<h3>JavaScript XMPP Chat</h3>\
         <p><b>Version: </b>' + jsxc.version + '<br />\
         <a href="http://jsxc.org/" target="_blank">www.jsxc.org</a><br />\
         <br />\
         <i>Released under the MIT license</i><br />\
         <br />\
         Real-time chat app for {{app_name}} and more.<br />\
         Requires an external <a href="https://xmpp.org/xmpp-software/servers/" target="_blank">XMPP server</a>.<br />\
         <br />\
         <b>Credits: </b> <a href="http://www.beepzoid.com/old-phones/" target="_blank">David English (Ringtone)</a>,\
         <a href="https://soundcloud.com/freefilmandgamemusic/ping-1?in=freefilmandgamemusic/sets/free-notification-sounds-and" target="_blank">CameronMusic (Ping)</a></p>\
         <p class="jsxc_right"><a class="button jsxc_debuglog" href="#">Show debug log</a></p>',
      vCard: '<h3>%%Info_about%% {{bid_name}}</h3>\
         <ul class="jsxc_vCard"></ul>\
         <p><img src="{{root}}img/loading.gif" alt="wait" width="32px" height="32px" /> %%Please_wait%%...</p>',
      settings: '<h3>%%User_settings%%</h3>\
         <p></p>\
         <form>\
            <fieldset class="jsxc_fieldsetXmpp jsxc_fieldset">\
               <legend>%%Login options%%</legend>\
               <label for="xmpp-url">%%BOSH url%%</label><input type="text" id="xmpp-url" readonly="readonly"/><br />\
               <label for="xmpp-username">%%Username%%</label><input type="text" id="xmpp-username"/><br />\
               <label for="xmpp-domain">%%Domain%%</label><input type="text" id="xmpp-domain"/><br />\
               <label for="xmpp-resource">%%Resource%%</label><input type="text" id="xmpp-resource"/><br />\
               <label for="xmpp-onlogin">%%On login%%</label><input type="checkbox" id="xmpp-onlogin" /><br />\
               <input type="submit" value="%%Save%%"/>\
            </fieldset>\
         </form>\
         <p></p>\
         <form>\
            <fieldset class="jsxc_fieldsetPriority jsxc_fieldset">\
               <legend>%%Priority%%</legend>\
               <label for="priority-online">%%Online%%</label><input type="number" value="0" id="priority-online" min="-128" max="127" step="1" required="required"/><br />\
               <label for="priority-chat">%%Chatty%%</label><input type="number" value="0" id="priority-chat" min="-128" max="127" step="1" required="required"/><br />\
               <label for="priority-away">%%Away%%</label><input type="number" value="0" id="priority-away" min="-128" max="127" step="1" required="required"/><br />\
               <label for="priority-xa">%%Extended_away%%</label><input type="number" value="0" id="priority-xa" min="-128" max="127" step="1" required="required"/><br />\
               <label for="priority-dnd">%%dnd%%</label><input type="number" value="0" id="priority-dnd" min="-128" max="127" step="1" required="required"/><br />\
               <input type="submit" value="%%Save%%"/>\
            </fieldset>\
         </form>\
         <p></p>\
         <form data-onsubmit="xmpp.carbons.refresh">\
            <fieldset class="jsxc_fieldsetCarbons jsxc_fieldset">\
               <legend>%%Carbon copy%%</legend>\
               <label for="carbons-enable">%%Enable%%</label><input type="checkbox" id="carbons-enable" /><br />\
               <input type="submit" value="%%Save%%"/>\
            </fieldset>\
         </form>'
   };

}(jQuery));
