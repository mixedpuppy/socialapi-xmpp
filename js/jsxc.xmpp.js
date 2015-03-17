(function($) {
   "use strict";

   /**
    * Handle XMPP stuff.
    * 
    * @namespace jsxc.xmpp
    */
   jsxc.xmpp = {
      conn: null, // connection

      /**
       * Create new connection or attach to old
       * 
       * @name login
       * @memberOf jsxc.xmpp
       */
      /**
       * Create new connection with given parameters.
       * 
       * @name login^2
       * @param {string} jid
       * @param {string} password
       * @memberOf jsxc.xmpp
       */
      /**
       * Attach connection with given parameters.
       * 
       * @name login^3
       * @param {string} jid
       * @param {string} sid
       * @param {string} rid
       * @memberOf jsxc.xmpp
       */
      login: function() {

         if (jsxc.xmpp.conn && jsxc.xmpp.conn.connected) {
            return;
         }

         var jid = null, password = null, sid = null, rid = null;

         switch (arguments.length) {
            case 2:
               jid = arguments[0];
               password = arguments[1];
               break;
            case 3:
               jid = arguments[0];
               sid = arguments[1];
               rid = arguments[2];
               break;
            default:
               jid = jsxc.storage.getItem('jid');
               sid = jsxc.storage.getItem('sid');
               rid = jsxc.storage.getItem('rid');
         }

         var url = jsxc.options.get('xmpp').url;

         // Register eventlistener
         $(document).on('connected.jsxc', jsxc.xmpp.connected);
         $(document).on('attached.jsxc', jsxc.xmpp.attached);
         $(document).on('disconnected.jsxc', jsxc.xmpp.disconnected);
         $(document).on('ridChange', jsxc.xmpp.onRidChange);
         $(document).on('connfail.jsxc', jsxc.xmpp.onConnfail);
         $(document).on('authfail.jsxc', jsxc.xmpp.onAuthFail);

         Strophe.addNamespace('RECEIPTS', 'urn:xmpp:receipts');

         // Create new connection (no login)
         jsxc.xmpp.conn = new Strophe.Connection(url);

         // Override default function to preserve unique id
         var stropheGetUniqueId = jsxc.xmpp.conn.getUniqueId;
         jsxc.xmpp.conn.getUniqueId = function(suffix) {
            var uid = stropheGetUniqueId.call(jsxc.xmpp.conn, suffix);
            jsxc.storage.setItem('_uniqueId', jsxc.xmpp.conn._uniqueId);

            return uid;
         };

         if (jsxc.storage.getItem('debug') === true) {
            jsxc.xmpp.conn.xmlInput = function(data) {
               console.log('<', data);
            };
            jsxc.xmpp.conn.xmlOutput = function(data) {
               console.log('>', data);
            };
         }

         var callback = function(status, condition) {

            jsxc.debug(Object.getOwnPropertyNames(Strophe.Status)[status] + ': ' + condition);

            switch (status) {
               case Strophe.Status.CONNECTED:
                  jsxc.bid = jsxc.jidToBid(jsxc.xmpp.conn.jid.toLowerCase());
                  $(document).trigger('connected.jsxc');
                  break;
               case Strophe.Status.ATTACHED:
                  $(document).trigger('attached.jsxc');
                  break;
               case Strophe.Status.DISCONNECTED:
                  $(document).trigger('disconnected.jsxc');
                  break;
               case Strophe.Status.CONNFAIL:
                  $(document).trigger('connfail.jsxc');
                  break;
               case Strophe.Status.AUTHFAIL:
                  $(document).trigger('authfail.jsxc');
                  break;
            }
         };

         if (jsxc.xmpp.conn.caps) {
            jsxc.xmpp.conn.caps.node = 'http://jsxc.org/';
         }

         if (jsxc.restore && sid && rid) {
            jsxc.debug('Try to attach');
            jsxc.debug('SID: ' + sid);
            jsxc.xmpp.conn.attach(jid, sid, rid, callback);
         } else {
            jsxc.debug('New connection');

            if (jsxc.xmpp.conn.caps) {
               // Add system handler, because user handler isn't called before
               // we are authenticated
               jsxc.xmpp.conn._addSysHandler(function(stanza) {
                  var from = jsxc.xmpp.conn.domain, c = stanza.querySelector('c'), ver = c.getAttribute('ver'), node = c.getAttribute('node');

                  var _jidNodeIndex = JSON.parse(localStorage.getItem('strophe.caps._jidNodeIndex')) || {};

                  jsxc.xmpp.conn.caps._jidVerIndex[from] = ver;
                  _jidNodeIndex[from] = node;

                  localStorage.setItem('strophe.caps._jidVerIndex', JSON.stringify(jsxc.xmpp.conn.caps._jidVerIndex));
                  localStorage.setItem('strophe.caps._jidNodeIndex', JSON.stringify(_jidNodeIndex));
               }, Strophe.NS.CAPS);
            }

            jsxc.xmpp.conn.connect(jid || jsxc.options.xmpp.jid, password || jsxc.options.xmpp.password, callback);
         }
      },

      /**
       * Logs user out of his xmpp session and does some clean up.
       * 
       * @returns {Boolean}
       */
      logout: function() {

         // instruct all tabs
         jsxc.storage.removeItem('sid');

         // clean up
         jsxc.storage.removeUserItem('buddylist');
         jsxc.storage.removeUserItem('windowlist');
         jsxc.storage.removeItem('_uniqueId');

         if (!jsxc.master) {
            $('#jsxc_roster').remove();
            $('#jsxc_windowlist').remove();
            return true;
         }

         if (jsxc.xmpp.conn === null) {
            return true;
         }

         // Hide dropdown menu
         $('body').click();

         jsxc.triggeredFromElement = true;

         // restore all otr objects
         $.each(jsxc.storage.getUserItem('otrlist') || {}, function(i, val) {
            jsxc.otr.create(val);
         });

         var numOtr = Object.keys(jsxc.otr.objects || {}).length + 1;
         var disReady = function() {
            if (--numOtr <= 0) {
               jsxc.xmpp.conn.flush();

               setTimeout(function() {
                  jsxc.xmpp.conn.disconnect();
               }, 600);
            }
         };

         // end all private conversations
         $.each(jsxc.otr.objects || {}, function(key, obj) {
            if (obj.msgstate === OTR.CONST.MSGSTATE_ENCRYPTED) {
               obj.endOtr.call(obj, function() {
                  obj.init.call(obj);
                  jsxc.otr.backup(key);

                  disReady();
               });
            } else {
               disReady();
            }
         });

         disReady();

         // Trigger real logout in jsxc.xmpp.disconnected()
         return false;
      },

      /**
       * Triggered if connection is established
       * 
       * @private
       */
      connected: function() {

         jsxc.xmpp.conn.pause();

         var nomJid = Strophe.getBareJidFromJid(jsxc.xmpp.conn.jid).toLowerCase() + '/' + Strophe.getResourceFromJid(jsxc.xmpp.conn.jid);

         // Save sid and jid
         jsxc.storage.setItem('sid', jsxc.xmpp.conn._proto.sid);
         jsxc.storage.setItem('jid', nomJid);

         jsxc.storage.setItem('lastActivity', (new Date()).getTime());

         // make shure roster will be reloaded
         jsxc.storage.removeUserItem('buddylist');

         jsxc.storage.removeUserItem('windowlist');
         jsxc.storage.removeUserItem('own');
         jsxc.storage.removeUserItem('avatar', 'own');
         jsxc.storage.removeUserItem('otrlist');

         if (jsxc.options.loginForm.triggered) {
            switch (jsxc.options.loginForm.onConnected || 'submit') {
               case 'submit':
                  jsxc.submitLoginForm();
                  /* falls through */
               case false:
                  jsxc.xmpp.connectionReady();
                  return;
            }
         }

         // start chat

         jsxc.gui.init();
         $('#jsxc_roster').removeClass('jsxc_noConnection');
         jsxc.onMaster();
         jsxc.xmpp.conn.resume();
         jsxc.gui.dialog.close();
         $(document).trigger('attached.jsxc');
      },

      /**
       * Triggered if connection is attached
       * 
       * @private
       */
      attached: function() {

         jsxc.xmpp.conn.addHandler(jsxc.xmpp.onRosterChanged, 'jabber:iq:roster', 'iq', 'set');
         jsxc.xmpp.conn.addHandler(jsxc.xmpp.onMessage, null, 'message', 'chat');
         jsxc.xmpp.conn.addHandler(jsxc.xmpp.onReceived, null, 'message');
         jsxc.xmpp.conn.addHandler(jsxc.xmpp.onPresence, null, 'presence');

         var caps = jsxc.xmpp.conn.caps;
         var domain = jsxc.xmpp.conn.domain;

         if (caps && jsxc.options.get('carbons').enable) {
            var conditionalEnable = function() {
               if (jsxc.xmpp.conn.caps.hasFeatureByJid(domain, jsxc.CONST.NS.CARBONS)) {
                  jsxc.xmpp.carbons.enable();
               }
            };

            if (typeof caps._knownCapabilities[caps._jidVerIndex[domain]] === 'undefined') {
               var _jidNodeIndex = JSON.parse(localStorage.getItem('strophe.caps._jidNodeIndex')) || {};

               $(document).on('caps.strophe', function onCaps(ev, from) {

                  if (from !== domain) {
                     return;
                  }

                  conditionalEnable();

                  $(document).off('caps.strophe', onCaps);
               });

               caps._requestCapabilities(jsxc.xmpp.conn.domain, _jidNodeIndex[domain], caps._jidVerIndex[domain]);
            } else {
               // We know server caps
               conditionalEnable();
            }
         }

         // Only load roaster if necessary
         if (!jsxc.restore || !jsxc.storage.getUserItem('buddylist')) {
            // in order to not overide existing presence information, we send
            // pres first after roster is ready
            $(document).one('cloaded.roster.jsxc', jsxc.xmpp.sendPres);

            $('#jsxc_roster > p:first').remove();

            var iq = $iq({
               type: 'get'
            }).c('query', {
               xmlns: 'jabber:iq:roster'
            });

            jsxc.xmpp.conn.sendIQ(iq, jsxc.xmpp.onRoster);
         } else {
            jsxc.xmpp.sendPres();
         }

         jsxc.xmpp.connectionReady();
      },

      /**
       * Triggered if the connection is ready
       */
      connectionReady: function() {

         // Load saved unique id
         jsxc.xmpp.conn._uniqueId = jsxc.storage.getItem('_uniqueId') || new Date().getTime();

         $(document).trigger('connectionReady.jsxc');
      },

      /**
       * Sends presence stanza to server.
       */
      sendPres: function() {
         // disco stuff
         if (jsxc.xmpp.conn.disco) {
            jsxc.xmpp.conn.disco.addIdentity('client', 'web', 'JSXC');
            jsxc.xmpp.conn.disco.addFeature(Strophe.NS.DISCO_INFO);
            jsxc.xmpp.conn.disco.addFeature(Strophe.NS.RECEIPTS);
         }

         // create presence stanza
         var pres = $pres();

         if (jsxc.xmpp.conn.caps) {
            // attach caps
            pres.c('c', jsxc.xmpp.conn.caps.generateCapsAttrs()).up();
         }

         var presState = jsxc.storage.getUserItem('presence') || 'online';
         if (presState !== 'online') {
            pres.c('show').t(presState).up();
         }

         var priority = jsxc.options.get('priority');
         if (priority && typeof priority[presState] !== 'undefined' && parseInt(priority[presState]) !== 0) {
            pres.c('priority').t(priority[presState]).up();
         }

         jsxc.debug('Send presence', pres.toString());
         jsxc.xmpp.conn.send(pres);
      },

      /**
       * Triggered if lost connection
       * 
       * @private
       */
      disconnected: function() {
         jsxc.debug('disconnected');

         jsxc.storage.removeItem('sid');
         jsxc.storage.removeItem('rid');
         jsxc.storage.removeItem('lastActivity');
         jsxc.storage.removeItem('hidden');
         jsxc.storage.removeUserItem('avatar', 'own');
         jsxc.storage.removeUserItem('otrlist');

         $(document).off('connected.jsxc', jsxc.xmpp.connected);
         $(document).off('attached.jsxc', jsxc.xmpp.attached);
         $(document).off('disconnected.jsxc', jsxc.xmpp.disconnected);
         $(document).off('ridChange', jsxc.xmpp.onRidChange);
         $(document).off('connfail.jsxc', jsxc.xmpp.onConnfail);
         $(document).off('authfail.jsxc', jsxc.xmpp.onAuthFail);

         jsxc.xmpp.conn = null;

         $('#jsxc_windowList').remove();

         if (jsxc.triggeredFromElement) {
            $('#jsxc_roster').remove();

            if (jsxc.triggeredFromLogout) {
               window.location = jsxc.options.logoutElement.attr('href');
            }
         } else {
            jsxc.gui.roster.noConnection();
         }

         window.clearInterval(jsxc.keepalive);
      },

      /**
       * Triggered on connection fault
       * 
       * @param {String} condition information why we lost the connection
       * @private
       */
      onConnfail: function(ev, condition) {
         jsxc.debug('XMPP connection failed: ' + condition);

         if (jsxc.options.loginForm.triggered) {
            jsxc.submitLoginForm();
         }
      },

      /**
       * Triggered on auth fail.
       * 
       * @private
       */
      onAuthFail: function() {
         if (jsxc.options.loginForm.triggered) {
            switch (jsxc.options.loginForm.onAuthFail || 'ask') {
               case 'ask':
                  jsxc.gui.showAuthFail();
                  break;
               case 'submit':
                  jsxc.submitLoginForm();
                  break;
            }
         }
      },

      /**
       * Triggered on initial roster load
       * 
       * @param {dom} iq
       * @private
       */
      onRoster: function(iq) {
         /*
          * <iq from='' type='get' id=''> <query xmlns='jabber:iq:roster'> <item
          * jid='' name='' subscription='' /> ... </query> </iq>
          */

         jsxc.debug('Load roster', iq);

         var buddies = [];

         $(iq).find('item').each(function() {
            var jid = $(this).attr('jid');
            var name = $(this).attr('name') || jid;
            var bid = jsxc.jidToBid(jid);
            var sub = $(this).attr('subscription');

            buddies.push(bid);

            jsxc.storage.removeUserItem('res', bid);

            jsxc.storage.saveBuddy(bid, {
               jid: jid,
               name: name,
               status: 0,
               sub: sub,
               res: []
            });

            jsxc.gui.roster.add(bid);
         });

         if (buddies.length === 0) {
            jsxc.gui.roster.empty();
         }

         jsxc.storage.setUserItem('buddylist', buddies);

         jsxc.debug('Roster loaded');
         $(document).trigger('cloaded.roster.jsxc');
      },

      /**
       * Triggerd on roster changes
       * 
       * @param {dom} iq
       * @returns {Boolean} True to preserve handler
       * @private
       */
      onRosterChanged: function(iq) {
         /*
          * <iq from='' type='set' id=''> <query xmlns='jabber:iq:roster'> <item
          * jid='' name='' subscription='' /> </query> </iq>
          */

         jsxc.debug('onRosterChanged', iq);

         $(iq).find('item').each(function() {
            var jid = $(this).attr('jid');
            var name = $(this).attr('name') || jid;
            var bid = jsxc.jidToBid(jid);
            var sub = $(this).attr('subscription');
            // var ask = $(this).attr('ask');

            if (sub === 'remove') {
               jsxc.gui.roster.purge(bid);
            } else {
               var bl = jsxc.storage.getUserItem('buddylist');

               if (bl.indexOf(bid) < 0) {
                  bl.push(bid); // (INFO) push returns the new length
                  jsxc.storage.setUserItem('buddylist', bl);
               }

               var temp = jsxc.storage.saveBuddy(bid, {
                  jid: jid,
                  name: name,
                  sub: sub
               });

               if (temp === 'updated') {

                  jsxc.gui.update(bid);
                  jsxc.gui.roster.reorder(bid);
               } else {
                  jsxc.gui.roster.add(bid);
               }
            }

            // Remove pending friendship request from notice list
            if (sub === 'from' || sub === 'both') {
               var notices = jsxc.storage.getUserItem('notices');
               var noticeKey = null, notice;

               for (noticeKey in notices) {
                  notice = notices[noticeKey];

                  if (notice.fnName === 'gui.showApproveDialog' && notice.fnParams[0] === jid) {
                     jsxc.debug('Remove notice with key ' + noticeKey);

                     jsxc.notice.remove(noticeKey);
                  }
               }
            }
         });

         if (!jsxc.storage.getUserItem('buddylist') || jsxc.storage.getUserItem('buddylist').length === 0) {
            jsxc.gui.roster.empty();
         } else {
            $('#jsxc_roster > p:first').remove();
         }

         // preserve handler
         return true;
      },

      /**
       * Triggered on incoming presence stanzas
       * 
       * @param {dom} presence
       * @private
       */
      onPresence: function(presence) {
         /*
          * <presence xmlns='jabber:client' type='unavailable' from='' to=''/>
          * 
          * <presence xmlns='jabber:client' from='' to=''> <priority>5</priority>
          * <c xmlns='http://jabber.org/protocol/caps'
          * node='http://psi-im.org/caps' ver='caps-b75d8d2b25' ext='ca cs
          * ep-notify-2 html'/> </presence>
          * 
          * <presence xmlns='jabber:client' from='' to=''> <show>chat</show>
          * <status></status> <priority>5</priority> <c
          * xmlns='http://jabber.org/protocol/caps'
          * node='http://psi-im.org/caps' ver='caps-b75d8d2b25' ext='ca cs
          * ep-notify-2 html'/> </presence>
          */
         jsxc.debug('onPresence', presence);

         var ptype = $(presence).attr('type');
         var from = $(presence).attr('from');
         var jid = Strophe.getBareJidFromJid(from).toLowerCase();
         var r = Strophe.getResourceFromJid(from);
         var bid = jsxc.jidToBid(jid);
         var data = jsxc.storage.getUserItem('buddy', bid);
         var res = jsxc.storage.getUserItem('res', bid) || {};
         var status = null;
         var xVCard = $(presence).find('x[xmlns="vcard-temp:x:update"]');

         if (jid === Strophe.getBareJidFromJid(jsxc.storage.getItem("jid"))) {
            return true;
         }

         if (ptype === 'error') {
            jsxc.error('[XMPP] ' + $(presence).attr('code'));
            return true;
         }

         // incoming friendship request
         if (ptype === 'subscribe') {
            jsxc.storage.setUserItem('friendReq', {
               jid: jid,
               approve: -1
            });
            jsxc.notice.add('%%Friendship request%%', '%%from%% ' + jid, 'gui.showApproveDialog', [ jid ]);

            return true;
         } else if (ptype === 'unavailable' || ptype === 'unsubscribed') {
            status = jsxc.CONST.STATUS.indexOf('offline');
         } else {
            var show = $(presence).find('show').text();
            if (show === '') {
               status = jsxc.CONST.STATUS.indexOf('online');
            } else {
               status = jsxc.CONST.STATUS.indexOf(show);
            }
         }

         if (status === 0) {
            delete res[r];
         } else {
            res[r] = status;
         }

         var maxVal = [];
         var max = 0, prop = null;
         for (prop in res) {
            if (res.hasOwnProperty(prop)) {
               if (max <= res[prop]) {
                  if (max !== res[prop]) {
                     maxVal = [];
                     max = res[prop];
                  }
                  maxVal.push(prop);
               }
            }
         }

         if (data.status === 0 && max > 0) {
            // buddy has come online
            jsxc.notification.notify(data.name, jsxc.translate('%%has come online%%.'));
         }

         data.status = max;
         data.res = maxVal;
         data.jid = jid;

         // Looking for avatar
         if (xVCard.length > 0) {
            var photo = xVCard.find('photo');

            if (photo.length > 0 && photo.text() !== data.avatar) {
               jsxc.storage.removeUserItem('avatar', data.avatar);
               data.avatar = photo.text();
            }
         }

         // Reset jid
         if (jsxc.gui.window.get(bid).length > 0) {
            jsxc.gui.window.get(bid).data('jid', jid);
         }

         jsxc.storage.setUserItem('buddy', bid, data);
         jsxc.storage.setUserItem('res', bid, res);

         jsxc.debug('Presence (' + from + '): ' + status);

         jsxc.gui.update(bid);
         jsxc.gui.roster.reorder(bid);

         $(document).trigger('presence.jsxc', [ from, status, presence ]);

         // preserve handler
         return true;
      },

      /**
       * Triggered on incoming message stanzas
       * 
       * @param {dom} presence
       * @returns {Boolean}
       * @private
       */
      onMessage: function(stanza) {

         var forwarded = $(stanza).find('forwarded[xmlns="' + jsxc.CONST.NS.FORWARD + '"]');
         var message, carbon;

         if (forwarded.length > 0) {
            message = forwarded.find('> message');
            forwarded = true;
            carbon = $(stanza).find('> [xmlns="' + jsxc.CONST.NS.CARBONS + '"]');

            if (carbon.length === 0) {
               carbon = false;
            }

            jsxc.debug('Incoming forwarded message', message);
         } else {
            message = stanza;
            forwarded = false;
            carbon = false;

            jsxc.debug('Incoming message', message);
         }

         var body = $(message).find('body:first').text();

         if (!body || (body.match(/\?OTR/i) && forwarded)) {
            return true;
         }

         var type = $(message).attr('type');
         var from = $(message).attr('from');
         var mid = $(message).attr('id');
         var bid;

         var delay = $(message).find('delay[xmlns="urn:xmpp:delay"]');

         var stamp = (delay.length > 0) ? new Date(delay.attr('stamp')) : new Date();
         stamp = stamp.getTime();

         if (carbon) {
            var direction = (carbon.prop("tagName") === 'sent') ? 'out' : 'in';
            bid = jsxc.jidToBid((direction === 'out') ? $(message).attr('to') : from);

            jsxc.gui.window.postMessage(bid, direction, body, false, forwarded, stamp);

            return true;

         } else if (forwarded) {
            // Someone forwarded a message to us

            body = from + jsxc.translate(' %%to%% ') + $(stanza).attr('to') + '"' + body + '"';

            from = $(stanza).attr('from');
         }

         var jid = Strophe.getBareJidFromJid(from);
         bid = jsxc.jidToBid(jid);
         var data = jsxc.storage.getUserItem('buddy', bid);
         var request = $(message).find("request[xmlns='urn:xmpp:receipts']");

         if (data === null) {
            // jid not in roster

            var chat = jsxc.storage.getUserItem('chat', bid) || [];

            if (chat.length === 0) {
               jsxc.notice.add('%%Unknown sender%%', '%%You received a message from an unknown sender%% (' + bid + ').', 'gui.showUnknownSender', [ bid ]);
            }

            var msg = jsxc.removeHTML(body);
            msg = jsxc.escapeHTML(msg);

            jsxc.storage.saveMessage(bid, 'in', msg, false, forwarded, stamp);

            return true;
         }

         var win = jsxc.gui.window.init(bid);

         // If we now the full jid, we use it
         if (type === 'chat') {
            win.data('jid', from);
            jsxc.storage.updateUserItem('buddy', bid, {
               jid: from
            });
         }

         $(document).trigger('message.jsxc', [ from, body ]);

         // create related otr object
         if (jsxc.master && !jsxc.otr.objects[bid]) {
            jsxc.otr.create(bid);
         }

         if (!forwarded && mid !== null && request.length && data !== null && (data.sub === 'both' || data.sub === 'from') && type === 'chat') {
            // Send received according to XEP-0184
            jsxc.xmpp.conn.send($msg({
               to: from
            }).c('received', {
               xmlns: 'urn:xmpp:receipts',
               id: mid
            }));
         }

         if (jsxc.otr.objects.hasOwnProperty(bid)) {
            jsxc.otr.objects[bid].receiveMsg(body, {
               stamp: stamp,
               forwarded: forwarded
            });
         } else {
            jsxc.gui.window.postMessage(bid, 'in', body, false, forwarded, stamp);
         }

         // preserve handler
         return true;
      },

      /**
       * Triggerd if the rid changed
       * 
       * @param {event} ev
       * @param {obejct} data
       * @private
       */
      onRidChange: function(ev, data) {
         jsxc.storage.setItem('rid', data.rid);
      },

      /**
       * response to friendship request
       * 
       * @param {string} from jid from original friendship req
       * @param {boolean} approve
       */
      resFriendReq: function(from, approve) {
         if (jsxc.master) {
            jsxc.xmpp.conn.send($pres({
               to: from,
               type: (approve) ? 'subscribed' : 'unsubscribed'
            }));

            jsxc.storage.removeUserItem('friendReq');
            jsxc.gui.dialog.close();

         } else {
            jsxc.storage.updateUserItem('friendReq', 'approve', approve);
         }
      },

      /**
       * Add buddy to my friends
       * 
       * @param {string} username jid
       * @param {string} alias
       */
      addBuddy: function(username, alias) {
         var bid = jsxc.jidToBid(username);

         if (jsxc.master) {
            // add buddy to roster (trigger onRosterChanged)
            var iq = $iq({
               type: 'set'
            }).c('query', {
               xmlns: 'jabber:iq:roster'
            }).c('item', {
               jid: username,
               name: alias || ''
            });
            jsxc.xmpp.conn.sendIQ(iq);

            // send subscription request to buddy (trigger onRosterChanged)
            jsxc.xmpp.conn.send($pres({
               to: username,
               type: 'subscribe'
            }));

            jsxc.storage.removeUserItem('add_' + bid);
         } else {
            jsxc.storage.setUserItem('add_' + bid, {
               username: username,
               alias: alias || null
            });
         }
      },

      /**
       * Remove buddy from my friends
       * 
       * @param {type} jid
       */
      removeBuddy: function(jid) {
         var bid = jsxc.jidToBid(jid);

         // Shortcut to remove buddy from roster and cancle all subscriptions
         var iq = $iq({
            type: 'set'
         }).c('query', {
            xmlns: 'jabber:iq:roster'
         }).c('item', {
            jid: Strophe.getBareJidFromJid(jid),
            subscription: 'remove'
         });
         jsxc.xmpp.conn.sendIQ(iq);

         jsxc.gui.roster.purge(bid);
      },

      onReceived: function(message) {
         var from = $(message).attr('from');
         var jid = Strophe.getBareJidFromJid(from);
         var bid = jsxc.jidToBid(jid);
         var received = $(message).find("received[xmlns='urn:xmpp:receipts']");

         if (received.length) {
            var receivedId = received.attr('id').replace(/:/, '-');
            var chat = jsxc.storage.getUserItem('chat', bid);
            var i;

            for (i = chat.length - 1; i >= 0; i--) {
               if (chat[i].uid === receivedId) {
                  chat[i].received = true;

                  $('#' + receivedId).addClass('jsxc_received');

                  jsxc.storage.setUserItem('chat', bid, chat);
                  break;
               }
            }
         }

         return true;
      },

      /**
       * Public function to send message.
       * 
       * @memberOf jsxc.xmpp
       * @param bid css jid of user
       * @param msg message
       * @param uid unique id
       */
      sendMessage: function(bid, msg, uid) {
         if (jsxc.otr.objects.hasOwnProperty(bid)) {
            jsxc.otr.objects[bid].sendMsg(msg, uid);
         } else {
            jsxc.xmpp._sendMessage(jsxc.gui.window.get(bid).data('jid'), msg, uid);
         }
      },

      /**
       * Create message stanza and send it.
       * 
       * @memberOf jsxc.xmpp
       * @param jid Jabber id
       * @param msg Message
       * @param uid unique id
       * @private
       */
      _sendMessage: function(jid, msg, uid) {
         var data = jsxc.storage.getUserItem('buddy', jsxc.jidToBid(jid)) || {};
         var isBar = (Strophe.getBareJidFromJid(jid) === jid);
         var type = data.type || 'chat';

         var xmlMsg = $msg({
            to: jid,
            type: type,
            id: uid
         }).c('body').t(msg);

         if (jsxc.xmpp.carbons.enabled && msg.match(/^\?OTR/)) {
            xmlMsg.up().c("private", {
               xmlns: jsxc.CONST.NS.CARBONS
            });
         }

         if (type === 'chat' && (isBar || jsxc.xmpp.conn.caps.hasFeatureByJid(jid, Strophe.NS.RECEIPTS))) {
            // Add request according to XEP-0184
            xmlMsg.up().c('request', {
               xmlns: 'urn:xmpp:receipts'
            });
         }

         jsxc.xmpp.conn.send(xmlMsg);
      },

      /**
       * This function loads a vcard.
       * 
       * @memberOf jsxc.xmpp
       * @param bid
       * @param cb
       * @param error_cb
       */
      loadVcard: function(bid, cb, error_cb) {
         if (jsxc.master) {
            jsxc.xmpp.conn.vcard.get(cb, bid, error_cb);
         } else {
            jsxc.storage.setUserItem('vcard', bid, 'request:' + (new Date()).getTime());

            $(document).one('loaded.vcard.jsxc', function(ev, result) {
               if (result && result.state === 'success') {
                  cb($(result.data).get(0));
               } else {
                  error_cb();
               }
            });
         }
      },

      /**
       * Retrieves capabilities.
       * 
       * @memberOf jsxc.xmpp
       * @param jid
       * @returns List of known capabilities
       */
      getCapabilitiesByJid: function(jid) {
         if (jsxc.xmpp.conn) {
            return jsxc.xmpp.conn.caps.getCapabilitiesByJid(jid);
         }

         var jidVerIndex = JSON.parse(localStorage.getItem('strophe.caps._jidVerIndex')) || {};
         var knownCapabilities = JSON.parse(localStorage.getItem('strophe.caps._knownCapabilities')) || {};

         if (jidVerIndex[jid]) {
            return knownCapabilities[jidVerIndex[jid]];
         }

         return null;
      }
   };

   /**
    * Handle carbons (XEP-0280);
    * 
    * @namespace jsxc.xmpp.carbons
    */
   jsxc.xmpp.carbons = {
      enabled: false,

      /**
       * Enable carbons.
       * 
       * @memberOf jsxc.xmpp.carbons
       * @param cb callback
       */
      enable: function(cb) {
         var iq = $iq({
            type: 'set'
         }).c('enable', {
            xmlns: jsxc.CONST.NS.CARBONS
         });

         jsxc.xmpp.conn.sendIQ(iq, function() {
            jsxc.xmpp.carbons.enabled = true;

            jsxc.debug('Carbons enabled');

            if (cb) {
               cb.call(this);
            }
         }, function(stanza) {
            jsxc.warn('Could not enable carbons', stanza);
         });
      },

      /**
       * Disable carbons.
       * 
       * @memberOf jsxc.xmpp.carbons
       * @param cb callback
       */
      disable: function(cb) {
         var iq = $iq({
            type: 'set'
         }).c('disable', {
            xmlns: jsxc.CONST.NS.CARBONS
         });

         jsxc.xmpp.conn.sendIQ(iq, function() {
            jsxc.xmpp.carbons.enabled = false;

            jsxc.debug('Carbons disabled');

            if (cb) {
               cb.call(this);
            }
         }, function(stanza) {
            jsxc.warn('Could not disable carbons', stanza);
         });
      },

      /**
       * Enable/Disable carbons depending on options key.
       * 
       * @memberOf jsxc.xmpp.carbons
       * @param err error message
       */
      refresh: function(err) {
         if (err === false) {
            return;
         }

         if (jsxc.options.get('carbons').enable) {
            return jsxc.xmpp.carbons.enable();
         }

         return jsxc.xmpp.carbons.disable();
      }
   };
}(jQuery));
