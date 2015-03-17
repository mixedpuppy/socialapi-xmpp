(function($) {
   "use strict";


   /**
    * This namespace handles the Notification API.
    * 
    * @namespace jsxc.notification
    */
   jsxc.notification = {

      /** Current audio file. */
      audio: null,

      /**
       * Register notification on incoming messages.
       * 
       * @memberOf jsxc.notification
       */
      init: function() {
         $(document).on('postmessagein.jsxc', function(event, bid, msg) {
            msg = (msg.match(/^\?OTR/)) ? jsxc.translate('%%Encrypted message%%') : msg;
            var data = jsxc.storage.getUserItem('buddy', bid);

            jsxc.notification.notify(jsxc.translate('%%New message from%% ') + data.name, msg, undefined, undefined, jsxc.CONST.SOUNDS.MSG);
         });

         $(document).on('callincoming.jingle', function() {
            jsxc.notification.playSound(jsxc.CONST.SOUNDS.CALL, true, true);
         });

         $(document).on('accept.call.jsxc reject.call.jsxc', function() {
            jsxc.notification.stopSound();
         });
      },

      /**
       * Shows a pop up notification and optional play sound.
       * 
       * @param title Title
       * @param msg Message
       * @param d Duration
       * @param force Should message also shown, if tab is visible?
       * @param soundFile Playing given sound file
       * @param loop Loop sound file?
       */
      notify: function(title, msg, d, force, soundFile, loop) {
         if (!jsxc.options.notification || !jsxc.notification.hasPermission()) {
            return; // notifications disabled
         }

         if (!jsxc.isHidden() && !force) {
            return; // Tab is visible
         }

         jsxc.toNotification = setTimeout(function() {

            if (typeof soundFile === 'string') {
               jsxc.notification.playSound(soundFile, loop, force);
            }

            var popup = new Notification(jsxc.translate(title), {
               body: jsxc.translate(msg),
               icon: jsxc.options.root + '/img/XMPP_logo.png'
            });

            var duration = d || jsxc.options.popupDuration;

            if (duration > 0) {
               setTimeout(function() {
                  popup.close();
               }, duration);
            }
         }, jsxc.toNotificationDelay);
      },

      /**
       * Checks if browser has support for notifications and add on chrome to
       * the default api.
       * 
       * @returns {Boolean} True if the browser has support.
       */
      hasSupport: function() {
         if (window.webkitNotifications) {
            // prepare chrome

            window.Notification = function(title, opt) {
               var popup = window.webkitNotifications.createNotification(null, title, opt.body);
               popup.show();

               popup.close = function() {
                  popup.cancel();
               };

               return popup;
            };

            var permission;
            switch (window.webkitNotifications.checkPermission()) {
               case 0:
                  permission = jsxc.CONST.NOTIFICATION_GRANTED;
                  break;
               case 2:
                  permission = jsxc.CONST.NOTIFICATION_DENIED;
                  break;
               default: // 1
                  permission = jsxc.CONST.NOTIFICATION_DEFAULT;
            }
            window.Notification.permission = permission;

            window.Notification.requestPermission = function(func) {
               window.webkitNotifications.requestPermission(func);
            };

            return true;
         } else if (window.Notification) {
            return true;
         } else {
            return false;
         }
      },

      /**
       * Ask user on first incoming message if we should inform him about new
       * messages.
       */
      prepareRequest: function() {

         $(document).one('postmessagein.jsxc', function() {
            jsxc.switchEvents({
               'notificationready.jsxc': function() {
                  jsxc.gui.dialog.close();
                  jsxc.notification.init();
                  jsxc.storage.setUserItem('notification', true);
               },
               'notificationfailure.jsxc': function() {
                  jsxc.gui.dialog.close();
                  jsxc.options.notification = false;
                  jsxc.storage.setUserItem('notification', false);
               }
            });

            setTimeout(function() {
               jsxc.notice.add('%%Notifications%%?', '%%Should_we_notify_you_%%', 'gui.showRequestNotification');
            }, 1000);
         });
      },

      /**
       * Request notification permission.
       */
      requestPermission: function() {
         window.Notification.requestPermission(function(status) {
            if (window.Notification.permission !== status) {
               window.Notification.permission = status;
            }

            if (jsxc.notification.hasPermission()) {
               $(document).trigger('notificationready.jsxc');
            } else {
               $(document).trigger('notificationfailure.jsxc');
            }
         });
      },

      /**
       * Check permission.
       * 
       * @returns {Boolean} True if we have the permission
       */
      hasPermission: function() {
         return window.Notification.permission === jsxc.CONST.NOTIFICATION_GRANTED;
      },

      /**
       * Plays the given file.
       * 
       * @memberOf jsxc.notification
       * @param {string} soundFile File relative to the sound directory
       * @param {boolean} loop True for loop
       * @param {boolean} force Play even if a tab is visible. Default: false.
       */
      playSound: function(soundFile, loop, force) {
         if (!jsxc.master) {
            // only master plays sound
            return;
         }

         if (jsxc.options.get('muteNotification') || jsxc.storage.getUserItem('presence') === 'dnd') {
            // sound mute or own presence is dnd
            return;
         }

         if (!jsxc.isHidden() && !force) {
            // tab is visible
            return;
         }

         // stop current audio file
         jsxc.notification.stopSound();

         var audio = new Audio(jsxc.options.root + '/sound/' + soundFile);
         audio.loop = loop || false;
         audio.play();

         jsxc.notification.audio = audio;
      },

      /**
       * Stop/remove current sound.
       * 
       * @memberOf jsxc.notification
       */
      stopSound: function() {
         var audio = jsxc.notification.audio;

         if (typeof audio !== 'undefined' && audio !== null) {
            audio.pause();
            jsxc.notification.audio = null;
         }
      },

      /**
       * Mute sound.
       * 
       * @memberOf jsxc.notification
       * @param {boolean} external True if triggered from external tab. Default:
       *        false.
       */
      muteSound: function(external) {
         $('#jsxc_menu .jsxc_muteNotification').text(jsxc.translate('%%Unmute%%'));

         if (external !== true) {
            jsxc.options.set('muteNotification', true);
         }
      },

      /**
       * Unmute sound.
       * 
       * @memberOf jsxc.notification
       * @param {boolean} external True if triggered from external tab. Default:
       *        false.
       */
      unmuteSound: function(external) {
         $('#jsxc_menu .jsxc_muteNotification').text(jsxc.translate('%%Mute%%'));

         if (external !== true) {
            jsxc.options.set('muteNotification', false);
         }
      }
   };

}(jQuery));
