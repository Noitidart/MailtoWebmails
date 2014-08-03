const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
const self = {
	id: 'mailtowebmails',
	suffix: '@jetpack',
	path: 'chrome://mailtowebmails/content/',
	aData: 0,
};

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/devtools/Console.jsm');

function startup(aData, aReason) {
	//self.aData = aData;
	console.log('aReason = ', aReason);
	console.log('aData = ', aData);
	if (aReason == ADDON_INSTALL) {
		var cWin = Services.wm.getMostRecentWindow('navigator:browser');
		if (cWin && cWin.gBrowser.tabContainer) {
			//cWin.BrowserOpenAddonsMgr('addons://detail/MailtoWebmails@jetpack/preferences');
			cWin.gBrowser.loadOneTab(self.path + 'options/skills.html', {inBackground:false});
		}
	}
	if (aReason == ADDON_UPGRADE || aReason == ADDON_DOWNGRADE) {
		var cWin = Services.wm.getMostRecentWindow('navigator:browser');
		if (cWin && cWin.gBrowser.tabContainer) {
			var res = Services.prompt.confirm(cWin, 'MailtoWebmails - Upgraded', 'MailtoWebmails was just upgraded. Would you like to open the preferences panel to see what new mailto handlers were added?');
			if (res) {
				//cWin.BrowserOpenAddonsMgr('addons://detail/MailtoWebmails@jetpack/preferences');
				cWin.gBrowser.loadOneTab(self.path + 'options/skills.html', {inBackground:false});
			}
		}
	}
}

function shutdown(aData, aReason) {
    if (aReason == APP_SHUTDOWN) return;
}

function install() {}

function uninstall() {}