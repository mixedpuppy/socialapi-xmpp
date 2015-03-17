$(function() {
   var settings = {
      xmpp: {
         url: location.protocol + "//" + location.hostname + ":5280/http-bind/",
         domain: 'jabber.hot-chilli.net',
         resource: 'socialapi-xmpp',
         overwrite: true,
         onlogin: true
      }
   };
   jsxc.init({
      loginForm: {
         form: '#form',
         jid: '#username',
         pass: '#password'
      },
      logoutElement: $('#logout'),
      checkFlash: false,
      root: '/',
      turnCredentialsPath: 'ajax/getturncredentials.json',
      displayRosterMinimized: function() {
         return true;
      },
      otr: {
         debug: true,
         SEND_WHITESPACE_TAG: true,
         WHITESPACE_START_AKE: true
      },
      loadSettings: function(username, password) {
         return settings;
      },
      xmpp: {
         url: settings.xmpp.url
      }
   });
   var bid = location.hash.substr(1);
//alert(bid);
   jsxc.gui.window.init(bid);
   //
   //$('#form2').submit(function(ev) {
   //   ev.preventDefault();
   //
   //   $(document).on('connectionReady.jsxc', function() {
   //      $('#form2 input').prop('disabled', true);
   //      
   //      $('#logout2').show().click(jsxc.xmpp.logout);
   //   });
   //
   //   jsxc.xmpp.login($('#username2').val() + '@' + settings.xmpp.domain, $('#password2').val());
   //});
});
