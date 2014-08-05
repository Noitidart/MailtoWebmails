var EXPORTED_SYMBOLS = ['infoForWebmailHandlers', 'myServices'];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
var myServices = {};

XPCOMUtils.defineLazyGetter(myServices, 'eps', function(){ return Cc['@mozilla.org/uriloader/external-protocol-service;1'].getService(Ci.nsIExternalProtocolService) });
XPCOMUtils.defineLazyGetter(myServices, 'hs', function(){ return Cc['@mozilla.org/uriloader/handler-service;1'].getService(Ci.nsIHandlerService) });

const infoForWebmailHandlers = [
	{
		name: 'AIM Mail',
		uriTemplate: 'http://webmail.aol.com/Mail/ComposeMessage.aspx?to=%s',
		circleSelector: '.skills .css' //this is for me to target the proper row in the dom of the prefs frontend document.getElementById(circleId).parentNode.parentNode is the row element
	},
	{
		name: 'GMail',
		uriTemplate: 'https://mail.google.com/mail/?extsrc=mailto&url=%s',
		circleSelector: '.skills .ai'
	},
	{
		name: 'Outlook Live',
		uriTemplate: 'https://mail.live.com/secure/start?action=compose&to=%s',
		circleSelector: '.skills .ps'
	},
	{
		name: 'Y! Mail',
		uriTemplate: 'https://compose.mail.yahoo.com/?To=%s',
		circleSelector: '.skills .html'
	}
];