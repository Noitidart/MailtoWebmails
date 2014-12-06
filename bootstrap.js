const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
const self = {
	id: 'mailtowebmails',
	suffix: '@jetpack',
	path: 'chrome://mailtowebmails/content/',
	aData: 0
};

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/devtools/Console.jsm');
/* start - infoForWebmailHandlers.jsm */ 
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
		name: 'FastMail',
		uriTemplate: 'https://www.fastmail.com/action/compose/?mailto=%s',
		circleSelector: '.skills .fastmail'
	},
	{
		name: 'GMail',
		uriTemplate: 'https://mail.google.com/mail/?extsrc=mailto&url=%s',
		circleSelector: '.skills .ai'
	},/*
	{
		name: 'GMX',
		uriTemplate: 'https://mail.google.com/mail/?extsrc=mailto&url=%s',
		circleSelector: '.skills .gmx'
	},*/
	{
		name: 'Lycos Mail',
		uriTemplate: 'https://zmail.zoho.com/mail/compose.do?extsrc=mailto&mode=compose&tp=zb&ct={to}',
		circleSelector: '.skills .lycos'
	},
	{
		name: 'Outlook Live',
		uriTemplate: 'https://mail.live.com/secure/start?action=compose&to=%s',
		circleSelector: '.skills .ps'
	},
	{
		name: 'QQMail',
		uriTemplate: 'http://www.mail.qq.com/cgi-bin/loginpage?delegate_url=%2Fcgi-bin%2Freadtemplate%3Ft%3Dcompose%26toemail%3D%s',
		circleSelector: '.skills .qq'
	},
	{
		name: 'Y! Mail',
		uriTemplate: 'https://compose.mail.yahoo.com/?To=%s',
		circleSelector: '.skills .html'
	},
	{
		name: 'Yandex.Mail',
		uriTemplate: 'https://mail.yandex.com/compose?mailto=%s',
		circleSelector: '.skills .yandex'
	},
	{
		name: 'ZOHO Mail',
		uriTemplate: 'https://zmail.zoho.com/mail/compose.do?extsrc=mailto&mode=compose&tp=zb&ct=%s',
		circleSelector: '.skills .zoho'
	}
];
/* end - infoForWebmailHandlers.jsm */ 

function startup(aData, aReason) {
	self.aData = aData; //must go first, because functions in loadIntoWindow use self.aData

	console.log('aReason=', aReason);
	
	if ([ADDON_INSTALL, ADDON_UPGRADE, ADDON_DOWNGRADE].indexOf(aReason) > -1) { //have to do install too because i dont uninstall the handlres on uninstall of add-on
		//go through installed handlers. make sure the installed handler's uriTemplate matches that of what is in infoForWebmailHandlers, if it doesnt, then update the installed handlers uriTemplate

		var handlerInfo = myServices.eps.getProtocolHandlerInfo('mailto');
		
		var shouldCallStore = false;
		//start - find installed handlers
		var handlers = handlerInfo.possibleApplicationHandlers.enumerate();
		while (handlers.hasMoreElements()) {
			var handler = handlers.getNext().QueryInterface(Ci.nsIWebHandlerApp);
			for (var i=0; i<infoForWebmailHandlers.length; i++) {
				var info = infoForWebmailHandlers[i];
				if (info.name == handler.name && info.uriTemplate != handler.uriTemplate) {
					console.warn('installed and info name match BUT uriTemplate mismatch SO set installed uriTemplate to info uriTemplate');
					handler.uriTemplate = info.uriTemplate;
					shouldCallStore = true;
				}
				if (info.name != handler.name && info.uriTemplate == handler.uriTemplate) {
					console.warn('installed and info uriTemplate match BUT name mismatch SO set installed name to info name');
					handler.name = info.name;
					shouldCallStore = true;
				}
			}
		}
		
		if (shouldCallStore) {
			myServices.hs.store(handlerInfo);
		}
		//end - find installed handlers
	}
	
	if (aReason == ADDON_INSTALL) {
		var cWin = Services.wm.getMostRecentWindow('navigator:browser');
		if (cWin && cWin.gBrowser.tabContainer) {
			//cWin.BrowserOpenAddonsMgr('addons://detail/MailtoWebmails@jetpack/preferences');
			cWin.gBrowser.loadOneTab(self.path + 'options/prefs.html', {inBackground:false});
		}
	}
	if (aReason == ADDON_UPGRADE || aReason == ADDON_DOWNGRADE) {
		var cWin = Services.wm.getMostRecentWindow('navigator:browser');
		if (cWin && cWin.gBrowser.tabContainer) {
			var res = Services.prompt.confirm(cWin, 'MailtoWebmails - Upgraded', 'MailtoWebmails was just upgraded. Would you like to open the preferences panel to see what new mailto handlers were added?');
			if (res) {
				//cWin.BrowserOpenAddonsMgr('addons://detail/MailtoWebmails@jetpack/preferences');
				cWin.gBrowser.loadOneTab(self.path + 'options/prefs.html', {inBackground:false});
			}
		}
	}
}

function shutdown(aData, aReason) {
    if (aReason == APP_SHUTDOWN) return;
	
	//close all tools frontends if they're open
	var DOMWindows = Services.wm.getEnumerator(null);
	while (DOMWindows.hasMoreElements()) {
		var aDOMWindow = DOMWindows.getNext();
		if (aDOMWindow.gBrowser && aDOMWindow.gBrowser.tabContainer) {
			for (var i = 0; i < aDOMWindow.gBrowser.tabContainer.childNodes.length; i++) {
				if (aDOMWindow.gBrowser.tabContainer.childNodes[i].linkedBrowser.contentWindow.location.href == 'chrome://mailtowebmails/content/options/prefs.html') {
					//aDOMWindow.gBrowser.removeTab(aDOMWindow.gBrowser.tabContainer.childNodes[i]);
					//i--;
					aDOMWindow.gBrowser.tabContainer.childNodes[i].linkedBrowser.contentWindow.location = 'data:text/html,MailtoWebmails tools/prefs page is no longer available. The add-on was disabled/uninstalled by user.';
				}
			}
		} else if (aDOMWindow.gBrowser) {
			if (aDOMWindow.gBrowser.contentWindow.location.href == 'chrome://mailtowebmails/content/options/prefs.html') {
				//aDOMWindow.close();
				aDOMWindow.gBrowser.contentWindow.location = 'data:text/html,MailtoWebmails tools/prefs page is no longer available. The add-on was disabled/uninstalled by user.';
			}
		} else if (aDOMWindow) {
			if (aDOMWindow.location.href == 'chrome://mailtowebmails/content/options/prefs.html') {
				//aDOMWindow.close();
				aDOMWindow.location = 'data:text/html,MailtoWebmails tools/prefs page is no longer available. The add-on was disabled/uninstalled by user.';
			}
		}
	}
}

function install() {}

function uninstall() {}