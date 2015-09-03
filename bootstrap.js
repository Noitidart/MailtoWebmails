// Imports
const {classes: Cc, interfaces: Ci, manager: Cm, results: Cr, utils: Cu, Constructor: CC} = Components;
Cm.QueryInterface(Ci.nsIComponentRegistrar);
Cu.import('resource://gre/modules/devtools/Console.jsm');
const {TextDecoder, TextEncoder, OS} = Cu.import('resource://gre/modules/osfile.jsm', {});
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

// Globals
const core = {
	addon: {
		name: 'MailtoWebmails',
		id: 'MailtoWebmails@jetpack',
		path: {
			name: 'mailtowebmails',
			content: 'chrome://mailtowebmails/content/',
			images: 'chrome://mailtowebmails/content/resources/images/',
			locale: 'chrome://mailtowebmails/locale/',
			resources: 'chrome://mailtowebmails/content/resources/',
			scripts: 'chrome://mailtowebmails/content/resources/scripts/',
			styles: 'chrome://mailtowebmails/content/resources/styles/'
		},
		cache_key: Math.random() // set to version on release
	},
	os: {
		name: OS.Constants.Sys.Name.toLowerCase(),
		toolkit: Services.appinfo.widgetToolkit.toLowerCase(),
		xpcomabi: Services.appinfo.XPCOMABI
	},
	firefox: {
		pid: Services.appinfo.processID,
		version: Services.appinfo.version
	}
};

const JETPACK_DIR_BASENAME = 'jetpack';
const myPrefBranch = 'extensions.' + core.addon.id + '.';
const mailtoServicesObjEntryTemplate = {
	name: '',
	url_template: '',
	old_url_templates: [],
	description: '',
	icon_dataurl: '',
	color: '',
	group: 1,
	update_time: 0
};

// Lazy Imports
const myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'eps', function(){ return Cc['@mozilla.org/uriloader/external-protocol-service;1'].getService(Ci.nsIExternalProtocolService) });
XPCOMUtils.defineLazyGetter(myServices, 'hph', function () { return Cc['@mozilla.org/network/protocol;1?name=http'].getService(Ci.nsIHttpProtocolHandler); });
XPCOMUtils.defineLazyGetter(myServices, 'hs', function(){ return Cc['@mozilla.org/uriloader/handler-service;1'].getService(Ci.nsIHandlerService) });
XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'bootstrap.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });

function extendCore() {
	// adds some properties i use to core based on the current operating system, it needs a switch, thats why i couldnt put it into the core obj at top
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			core.os.version = parseFloat(Services.sysinfo.getProperty('version'));
			// http://en.wikipedia.org/wiki/List_of_Microsoft_Windows_versions
			if (core.os.version == 6.0) {
				core.os.version_name = 'vista';
			}
			if (core.os.version >= 6.1) {
				core.os.version_name = '7+';
			}
			if (core.os.version == 5.1 || core.os.version == 5.2) { // 5.2 is 64bit xp
				core.os.version_name = 'xp';
			}
			break;
			
		case 'darwin':
			var userAgent = myServices.hph.userAgent;
			//console.info('userAgent:', userAgent);
			var version_osx = userAgent.match(/Mac OS X 10\.([\d\.]+)/);
			//console.info('version_osx matched:', version_osx);
			
			if (!version_osx) {
				throw new Error('Could not identify Mac OS X version.');
			} else {
				var version_osx_str = version_osx[1];
				var ints_split = version_osx[1].split('.');
				if (ints_split.length == 1) {
					core.os.version = parseInt(ints_split[0]);
				} else if (ints_split.length >= 2) {
					core.os.version = ints_split[0] + '.' + ints_split[1];
					if (ints_split.length > 2) {
						core.os.version += ints_split.slice(2).join('');
					}
					core.os.version = parseFloat(core.os.version);
				}
				// this makes it so that 10.10.0 becomes 10.100
				// 10.10.1 => 10.101
				// so can compare numerically, as 10.100 is less then 10.101
				
				//core.os.version = 6.9; // note: debug: temporarily forcing mac to be 10.6 so we can test kqueue
			}
			break;
		default:
			// nothing special
	}
	
	console.log('done adding to core, it is now:', core);
}

// START - Addon Functionalities					
// start - about module
var aboutFactory_mailto;
function AboutMailto() {}
AboutMailto.prototype = Object.freeze({
	classDescription: 'NativeShot History Application',
	contractID: '@mozilla.org/network/protocol/about;1?what=mailto',
	classID: Components.ID('{6d3c9270-4612-11e5-b970-0800200c9a66}'),
	QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),

	getURIFlags: function(aURI) {
		return Ci.nsIAboutModule.ALLOW_SCRIPT | Ci.nsIAboutModule.URI_MUST_LOAD_IN_CHILD;
	},

	newChannel: function(aURI, aSecurity) {
		console.info('aURI:', aURI);
		var channel;
		if (aURI.path.toLowerCase().indexOf('?discover') > -1) {
			channel = Services.io.newChannel(core.addon.path.content + 'app_discover.xhtml', null, null);
		} else {
			channel = Services.io.newChannel(core.addon.path.content + 'app.xhtml', null, null);
		}
		channel.originalURI = aURI;
		return channel;
	}
});

function AboutFactory(component) {
	this.createInstance = function(outer, iid) {
		if (outer) {
			throw Cr.NS_ERROR_NO_AGGREGATION;
		}
		return new component();
	};
	this.register = function() {
		Cm.registerFactory(component.prototype.classID, component.prototype.classDescription, component.prototype.contractID, this);
	};
	this.unregister = function() {
		Cm.unregisterFactory(component.prototype.classID, this);
	}
	Object.freeze(this);
	this.register();
}
// end - about module
// END - Addon Functionalities

/*start - framescriptlistener*/
/*
const fsComServer = {
	aArrClientIds: [], // holds ids of registered clients
	fsUrl: '', //string of the randomized fsUrl
	id: Math.random(), // server id
	serverListenerInited: false,
	registered: false,
	unregistering: false,
	register: function(aFsUrl) {
		// currently set up to take only one framescript url
		if (fsComServer.registered) {
			console.warn('already registered, returning');
			return;
		}
		if (aFsUrl) {
			// devuser passed
			fsComServer.devuserSpecifiedFsUrl = aFsUrl;
		} // else { // programttic call from serverRequest_toUpdatedServer_unregisterCompleted //}
		
		//core.fsServer = {id:fsComServer.id};
		if (!fsComServer.serverListenerInited) {
			fsComServer.serverListenerInited = true;
			Services.mm.addMessageListener(core.addon.id, fsComServer.clientMessageListener);
			console.error('OK REGISTERED MM CML');
		}
		try {
			var isUnregistering = Services.prefs.getBoolPref('fsCom.unregistering.' + core.addon.id);
			if (isUnregistering) {
				console.error('fsServer id of ', fsComServer.id, 'has started up but putting register to pending as it sees another with same addon id is unregestering');
				return;  // else wait for old server to emit unregistering complete
			} // else it should never get here as when my fsComServer is done unregistering it deletes the pref
		} catch(ex) {
			console.log('fsCom.unregistering pref does not exist for this addon id so that means there was nothing in unregistration process so continue to register');
		}
		
		fsComServer.registered = true;
		fsComServer.fsUrl = fsComServer.devuserSpecifiedFsUrl + '?' + core.addon.cache_key;
		Services.mm.loadFrameScript(fsComServer.fsUrl, true);
	},
	unregister: function() {
		if (!fsComServer.registered) {
			Services.mm.removeMessageListener(core.addon.id, fsComServer.clientMessageListener);
		} else {
			fsComServer.unregistering = true;
			Services.prefs.setBoolPref('fsCom.unregistering.' + core.addon.id, true);
			Services.mm.removeDelayedFrameScript(fsComServer.fsUrl);
			Services.mm.broadcastAsyncMessage(core.addon.id, {aTopic:'serverRequest_clientShutdown', serverId:fsComServer.id});
		}
		// fsComServer.registered = false; //  no need for this really
	},
	clientShutdown: function(aClientId) {
		// run every time a client is uninited, it checks if all fsComServer.aArrClientIds have been uninited
		fsComServer.aArrClientIds.splice(fsComServer.aArrClientIds.indexOf(aClientId), 1);
		if (fsComServer.aArrClientIds.length == 0) {
			console.error('OK YAY ALL CLIENTS HAVE BEEN UNINITALIZED');
			Services.prefs.clearUserPref('fsCom.unregistering.' + core.addon.id, false);
			Services.mm.removeMessageListener(core.addon.id, fsComServer.clientMessageListener);
			Services.cpmm.sendAsyncMessage(core.addon.id, {aTopic:'serverRequest_toUpdatedServer_unregisterCompleted'});
		} else {
			console.warn('some more aArrClientIds are left for unregistration:', fsComServer.aArrClientIds);
		}
	},
	clientBorn: function(aClientId) {
		fsComServer.aArrClientIds.push(aClientId);
		Services.mm.broadcastAsyncMessage(core.addon.id, {aTopic:'serverRequest_clientInit', clientId:aClientId, core:core});
	},
	clientMessageListener: {
		// listens to messages sent from clients (child framescripts) to me/server
		// also from old server, to listen when to trigger updated register
		receiveMessage: function(aMsg) {
			console.error('SERVER recieving msg:', aMsg);
			if (!('serverId' in aMsg.json) || aMsg.json.serverId == fsComServer.id) {
				switch (aMsg.json.aTopic) {
					case 'clientRequest_clientBorn':
							
							fsComServer.clientBorn(aMsg.json.clientId);
							
						break;
					case 'clientRequest_clientShutdownComplete':
							
							fsComServer.clientShutdown(aMsg.json.clientId);
							
						break;
					case 'serverRequest_toUpdatedServer_unregisterCompleted':
							
							// register this newly upgraded one
							fsComServer.register();
							
						break;
					// start - devuser edit - add your personal message topics to listen to from clients
						
					// end - devuser edit - add your personal message topics to listen to from clients
					default:
						console.error('SERVER unrecognized aTopic:', aMsg.json.aTopic, aMsg, 'server id:', fsComServer.id);
				}
			} else {
				console.warn('incoming message to server but it has an id and it is not of this so ignore it', 'this server id:', fsComServer.id, 'msg target server is:', aMsg.json.serverId, 'aMsg:', aMsg);
			}
		}
	}
}
*/
/*end - framescriptlistener*/
const OSPath_installedServices = OS.Path.join(OS.Constants.Path.profileDir, JETPACK_DIR_BASENAME, core.addon.id, 'simple-storage', 'pop_or_stalled.json');
const mailto_services_default = [ // installed and active are really unknown at this point
	/*
	{
		name:
		url_template:
		old_url_templates:
		description:
		icon_dataurl:
		color:
		group: 0 for popular, 1, for personal/discovered/custom/social, 2 for native like outlook
		update_time:
		installed: bool // user based field all others are from server
		active: bool // user based field all others are from server
	}
	*/
	{
		name: 'AIM Mail',
		url_template: 'http://webmail.aol.com/Mail/ComposeMessage.aspx?to=%s',
		old_url_templates: [],
		description: 'This handles both AOL Mail and AIM Mail',
		icon_dataurl: 'chrome://mailtowebmails/content/resources/images/logo-aolmail.png',
		color: 'rgb(255, 204, 0)',
		group: 0,
		update_time: 1
	},
	/*
	{
		name: 'FastMail',
		url_template: 'https://www.fastmail.com/action/compose/?mailto=%s',
		old_url_templates: [],
		description: 'Handles the light weight FM service',
		icon_dataurl: 'chrome://mailtowebmails/content/resources/images/logo-fastmail.png',
		color: 'rgb(68, 86, 127)',
		group: 1,
		update_time: 1
	},
	*/
	{
		name: 'Gmail',
		url_template: 'https://mail.google.com/mail/?extsrc=mailto&url=%s',
		old_url_templates: [],
		description: 'The Gmail handler comes installed by default with Firefox',
		icon_dataurl: 'chrome://mailtowebmails/content/resources/images/logo-gmail2.png',
		color: 'rgb(235, 42, 46)',
		group: 0,
		update_time: 1
	},
	/*
	{
		name: 'Lycos Mail',
		url_template: '????????????',
		description: 'Handles the popular Lycos webmail client',
		icon_dataurl: 'chrome://mailtowebmails/content/resources/images/logo-lycos.png',
		color: 'rgb(68, 86, 127)',
		group: 1,
		update_time: 1
	},
	*/
	{
		name: 'Outlook Live',
		url_template: 'https://mail.live.com/secure/start?action=compose&to=%s', //chrome mailto ext uses: `https://mail.live.com/default.aspx?rru=compose&to={to}&subject={subject}&body={body}&cc={cc}`
		old_url_templates: [],
		description: 'Service also for Hotmail and Live Mail',
		icon_dataurl: 'chrome://mailtowebmails/content/resources/images/logo-outlook.png',
		color: 'rgb(0, 115, 198)',
		group: 0,
		update_time: 1
	},
	{
		name: 'QQ\u90ae\u7bb1 (QQMail)',
		url_template: 'http://www.mail.qq.com/cgi-bin/loginpage?delegate_url=%2Fcgi-bin%2Freadtemplate%3Ft%3Dcompose%26toemail%3D%s',
		old_url_templates: [],
		description: '\u5e38\u8054\u7cfb!',
		icon_dataurl: 'chrome://mailtowebmails/content/resources/images/logo-qq.png',
		color: 'rgb(255, 102, 0)',
		group: 0,
		update_time: 1
	},
	{
		name: 'Yahoo! Mail',
		url_template: 'https://compose.mail.yahoo.com/?To=%s',
		old_url_templates: [],
		description: 'The Yahoo Mail handler comes installed by default with Firefox',
		icon_dataurl: 'chrome://mailtowebmails/content/resources/images/logo-y!mail3.png',
		color: 'rgb(65, 2, 143)',
		group: 0,
		update_time: 1
	},
	{
		name: 'Yandex.Mail',
		url_template: 'https://mail.yandex.com/compose?mailto=%s',
		old_url_templates: [],
		description: 'The largest search engine in Russia. \u041f\u043e\u0438\u0441\u043a \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u0438 \u0432 \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442\u0435 \u0441 \u0443\u0447\u0435\u0442\u043e\u043c \u0440\u0443\u0441\u0441\u043a\u043e\u0439 \u043c\u043e\u0440\u0444\u043e\u043b\u043e\u0433\u0438\u0438!',
		icon_dataurl: 'chrome://mailtowebmails/content/resources/images/logo-yandex.png',
		color: 'rgb(223, 78, 44)',
		group: 0,
		update_time: 1
	},
	/*
	{
		name: 'ZOHO Mail',
		url_template: 'https://zmail.zoho.com/mail/compose.do?extsrc=mailto&mode=compose&tp=zb&ct=%s',
		old_url_templates: [],
		description: 'Email designed with business users in mind',
		icon_dataurl: 'chrome://mailtowebmails/content/resources/images/logo-zoho.png',
		icon_imugr_url: null,
		color: 'rgb(36, 160, 68)',
		group: 1,
		update_time: 1
	}
	*/
];

const serverSubmitInterval = 5; // in minutes
const serverSubmitIntervalMS = serverSubmitInterval * 60 * 1000;
var gServerSubmitTimer = {
	instance: null,
	running: false,
	callback: {
		notify: function() {
			console.log('triggered notif callback');
			gServerSubmitTimer.running = false;
			checkIfShouldSubmit();
		}
	}
}

function checkIfShouldSubmit() {
	// called by messagemanager from about:mailto informing bootstrap there is a possible edit/add to submit to server
	// this function checks if it has already checked in last X min, if it hasnt then it will check the pref, then see if it hasnt submit in the last X min, it will then try to submit, if it fails it will set up a timer to try again in X min, if it succeeds it will delete the pref
	var cPrefVal;
	try {
		cPrefVal = parseInt(Services.prefs.getCharPref(myPrefBranch + 'pending_submit'));
	} catch(ex) {
		// pref probably doesnt exist
		cPrefVal = undefined;
	}
	if (cPrefVal === undefined) {
		// no need, so if timer was running dont renew it
		if (gServerSubmitTimer.instance) { // equivalent of testing gServerSubmitTimer.running
			gServerSubmitTimer.instance.cancel();
			gServerSubmitTimer.instance = null;
		}
		gServerSubmitTimer.running = false;
	} else {
		// need to maybe submit, or need to just wait as timer is running
		var nowTime = new Date().getTime();
		if (nowTime - cPrefVal >= serverSubmitIntervalMS) {
			if (gServerSubmitTimer.running) {
				gServerSubmitTimer.instance.cancel();
				gServerSubmitTimer.running = false;
			}
			// attempt submit
			Services.prefs.setCharPref(myPrefBranch + 'pending_submit', new Date().getTime()); // set it now, in case someone else sends a message to do server update, but the server upate process is already in process
			readFile_ifNeedSubmit_doSubmit_onFail_startTimer();
		} else {
			console.info('its been since last server submit:', (nowTime - cPrefVal), 'which is not >= serverSubmitInterval:', serverSubmitIntervalMS);
			// start timer if it wasnt running
			if (!gServerSubmitTimer.running) { // equivalent of testing gServerSubmitTimer.running
				reKickOffServerSubmitTimer();
			} // else assume its already running
		}
	}
}

function reKickOffServerSubmitTimer() {
	// start timer, if it was already running, it restarts it for another serverSubmitIntervalMS
	console.error('restarting timer');
	if (!gServerSubmitTimer.instance) { // equivalent of testing gServerSubmitTimer.running
		gServerSubmitTimer.instance = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer);
	}
	if (gServerSubmitTimer.running) {
		gServerSubmitTimer.instance.cancel();
		gServerSubmitTimer.running = false;
	}
	gServerSubmitTimer.running = true;
	gServerSubmitTimer.instance.initWithCallback(gServerSubmitTimer.callback, serverSubmitIntervalMS, Ci.nsITimer.TYPE_ONE_SHOT);
}

function aCBTemplateForRemSubFlag(submittedUrlTemplate, submittedOldUrlTemplates) {
	// console.warn('submittedUrlTemplate:', submittedUrlTemplate, 'submittedOldUrlTemplates:', submittedOldUrlTemplates);
	Services.mm.broadcastAsyncMessage(core.addon.id, {aTopic:'serverCommand_removeSubmitFlag', submittedUrlTemplate:submittedUrlTemplate, submittedOldUrlTemplates:submittedOldUrlTemplates});
}

function readFile_ifNeedSubmit_doSubmit_onFail_startTimer() {

	var fileJson = [];
	var submitJson = [];
	var removeSubmittedFlag_CBArr = [];
	
	var step1 = function() {
		// read file
		var promise_readInstalledServices = read_encoded(OSPath_installedServices, {encoding:'utf-16'});
		promise_readInstalledServices.then(
			function(aVal) {
				console.log('Fullfilled - promise_readInstalledServices - ', aVal);
				// start - do stuff here - promise_readInstalledServices
				fileJson = JSON.parse(aVal);
				step2();
				// end - do stuff here - promise_readInstalledServices
			},
			function(aReason) {
				var rejObj = {name:'promise_readInstalledServices', aReason:aReason};
				console.warn('Rejected - promise_readInstalledServices - ', rejObj);
				// deferred_createProfile.reject(rejObj);
				console.warn('re kicking off timer');
				reKickOffServerSubmitTimer();
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_readInstalledServices', aCaught:aCaught};
				console.error('Caught - promise_readInstalledServices - ', rejObj);
				// deferred_createProfile.reject(rejObj);
			}
		);
	};
	
	var step2 = function() {
		// check if file holds anything needing submit
			// .submit == 1 == add
			// .submit == 2 == edit
		submitJson = []; // time is determined on server side
		for (var i=0; i<fileJson.length; i++) {
			if ('submit' in fileJson[i]) {
				var pushObj = {};
				for (var p in mailtoServicesObjEntryTemplate) {
					pushObj[p] = fileJson[i][p];
				}
				delete fileJson[i].submit;
				submitJson.push(pushObj);
				removeSubmittedFlag_CBArr.push(aCBTemplateForRemSubFlag.bind(null, fileJson[i].url_template, fileJson[i].old_url_templates));
			}
		}
		
		if (submitJson.length > 0) {
			step3()
		} else {
			// if nothing, then clear the pref, destroy the timer
			console.warn('nothing in submitJson, destory timer nad clear pref');
			Services.prefs.clearUserPref(myPrefBranch + 'pending_submit');
			gServerSubmitTimer.instance = null;
		}
	};
	
	var step3 = function() {
		// if step2 decides server submit is needed, then this does the xhr
			// and on fail it will resetup timer
			// or on success it will delete timer AND clear pref AND update fileJson AND write it to disk
		console.info('submitting json:', submitJson);
		var promise_submitToServer = xhr('http://mailtowebmails.site40.net/ajax/submit_edit_or_new.php', {
			aResponseType: 'json',
			aPostData: {
				json: encodeURIComponent(JSON.stringify(submitJson))
			},
			Headers: {
				'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
			},
			aTimeout: 30000 // 30s
		});
		promise_submitToServer.then(
			function(aVal) {
				console.log('Fullfilled - promise_submitToServer - ', aVal);
				// start - do stuff here - promise_submitToServer
				if (aVal && aVal.response && aVal.response.status && aVal.response.status == 'ok') {
					step4();
				} else {
					console.error('submission failed, re-kick');
					reKickOffServerSubmitTimer();
				}
				// end - do stuff here - promise_submitToServer
			},
			function(aReason) {
				var rejObj = {name:'promise_submitToServer', aReason:aReason};
				console.warn('Rejected - promise_submitToServer - ', rejObj);
				// deferred_createProfile.reject(rejObj);
				reKickOffServerSubmitTimer();
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_submitToServer', aCaught:aCaught};
				console.error('Caught - promise_submitToServer - ', rejObj);
				// deferred_createProfile.reject(rejObj);
			}
		);
	};
	
	var step4 = function() {
		// wrap up on success
		// clear the pref, destroy the timer, and update to file that no more submits pending
		Services.prefs.clearUserPref(myPrefBranch + 'pending_submit');
		gServerSubmitTimer.instance = null;
		
		var promise_updateFile = tryOsFile_ifDirsNoExistMakeThenRetry('writeAtomic', [OSPath_installedServices, String.fromCharCode(0xfeff) + JSON.stringify(fileJson), {
			tmpPath: OSPath_installedServices + '.tmp',
			encoding: 'utf-16',
			noOverwrite: false
		}], OS.Constants.Path.profileDir);
		promise_updateFile.then(
			function(aVal) {
				console.log('Fullfilled - promise_updateFile - ', aVal);
				// start - do stuff here - promise_updateFile
				for (var i=0; i<removeSubmittedFlag_CBArr.length; i++) {
					removeSubmittedFlag_CBArr[i]();
				}
				// end - do stuff here - promise_updateFile
			},
			function(aReason) {
				var rejObj = {name:'promise_updateFile', aReason:aReason};
				console.error('Rejected - promise_updateFile - ', rejObj);
				// deferred_createProfile.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_updateFile', aCaught:aCaught};
				console.error('Caught - promise_updateFile - ', rejObj);
				// deferred_createProfile.reject(rejObj);
			}
		);
	};
	
	step1();
}

var gClientMessageListener = {
	receiveMessage: function(aMsg) {
		console.error('SERVER recieving msg:', aMsg);
		switch (aMsg.json.aTopic) {
			case core.addon.id + '::' + 'notifyBootstrapThereIsPossibleServerSubmitPending':
					
					checkIfShouldSubmit();
					
				break;
			default:
				console.error('SERVER unrecognized aTopic:', aMsg.json.aTopic, aMsg);
		}
	}
}

function install() {}
function uninstall(aData, aReason) {
	if (aReason == ADDON_UNINSTALL) {
		
		// delete simple storage
		OS.File.removeDir(OS.Path.join(OS.Constants.Path.profileDir, JETPACK_DIR_BASENAME, core.addon.id));
		
		// delete pref if it was there
		Services.prefs.clearUserPref(myPrefBranch + 'pending_submit');
	}
}

function writeDefaultsFile(aNoOverwrite, aCBSuccess) {
	var promise_writeDefault = tryOsFile_ifDirsNoExistMakeThenRetry('writeAtomic', [OSPath_installedServices, String.fromCharCode(0xfeff) + JSON.stringify(mailto_services_default), {
		tmpPath: OSPath_installedServices + '.tmp',
		encoding: 'utf-16',
		noOverwrite: aNoOverwrite
	}], OS.Constants.Path.profileDir);
	promise_writeDefault.then(
		function(aVal) {
			console.log('Fullfilled - promise_writeDefault - ', aVal);
			// start - do stuff here - promise_writeDefault
			if (aCBSuccess) {
				aCBSuccess();
			}
			// end - do stuff here - promise_writeDefault
		},
		function(aReason) {
			var rejObj = {name:'promise_writeDefault', aReason:aReason};
			console.error('Rejected - promise_writeDefault - ', rejObj);
			// deferred_createProfile.reject(rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_writeDefault', aCaught:aCaught};
			console.error('Caught - promise_writeDefault - ', rejObj);
			// deferred_createProfile.reject(rejObj);
		}
	);
}

function startup(aData, aReason) {
	// core.addon.aData = aData;
	extendCore();
	
	//framescriptlistener more
	//fsComServer.register(core.addon.path.scripts + '_framescript-warn-on-submit.js');
	//end framescriptlistener more
	
	if (aReason == ADDON_INSTALL) {
		// overwrite, then open tab
		writeDefaultsFile(false, function() {
			var cWin = Services.wm.getMostRecentWindow('navigator:browser');
			if (cWin) {
				cWin.gBrowser.loadOneTab('about:mailto', {inBackground:false});
			}
		});
	} else if ([ADDON_DOWNGRADE, ADDON_UPGRADE, APP_STARTUP, ADDON_ENABLE].indexOf(aReason) > -1) {
		// dont overwrite
		// then do check
		
		writeDefaultsFile(true, checkIfShouldSubmit);
	} else {
		// just do check
		checkIfShouldSubmit();
	}
	
	aboutFactory_mailto = new AboutFactory(AboutMailto);
	
	Services.mm.addMessageListener(core.addon.id, gClientMessageListener);
	
}

function shutdown(aData, aReason) {
	if (aReason == APP_SHUTDOWN) { return }

	//framescriptlistener more
	// fsComServer.unregister();
	//end framescriptlistener more

	Services.mm.removeMessageListener(core.addon.id, gClientMessageListener);
	
	// an issue with this unload is that framescripts are left over, i want to destory them eventually
	aboutFactory_mailto.unregister();
	
	if (gServerSubmitTimer.instance) { // equivalent of testing gServerSubmitTimer.running
		gServerSubmitTimer.instance.cancel();
		gServerSubmitTimer.instance = null;
		gServerSubmitTimer.running = false;
	}
}

// start - common helper functions
function makeDir_Bug934283(path, options) {
	// pre FF31, using the `from` option would not work, so this fixes that so users on FF 29 and 30 can still use my addon
	// the `from` option should be a string of a folder that you know exists for sure. then the dirs after that, in path will be created
	// for example: path should be: `OS.Path.join('C:', 'thisDirExistsForSure', 'may exist', 'may exist2')`, and `from` should be `OS.Path.join('C:', 'thisDirExistsForSure')`
	// options of like ignoreExisting is exercised on final dir
	
	if (!options || !('from' in options)) {
		console.error('you have no need to use this, as this is meant to allow creation from a folder that you know for sure exists, you must provide options arg and the from key');
		throw new Error('you have no need to use this, as this is meant to allow creation from a folder that you know for sure exists, you must provide options arg and the from key');
	}

	if (path.toLowerCase().indexOf(options.from.toLowerCase()) == -1) {
		console.error('The `from` string was not found in `path` string');
		throw new Error('The `from` string was not found in `path` string');
	}

	var options_from = options.from;
	delete options.from;

	var dirsToMake = OS.Path.split(path).components.slice(OS.Path.split(options_from).components.length);
	console.log('dirsToMake:', dirsToMake);

	var deferred_makeDir_Bug934283 = new Deferred();
	var promise_makeDir_Bug934283 = deferred_makeDir_Bug934283.promise;

	var pathExistsForCertain = options_from;
	var makeDirRecurse = function() {
		pathExistsForCertain = OS.Path.join(pathExistsForCertain, dirsToMake[0]);
		dirsToMake.splice(0, 1);
		var promise_makeDir = OS.File.makeDir(pathExistsForCertain, options);
		promise_makeDir.then(
			function(aVal) {
				console.log('Fullfilled - promise_makeDir - ', 'ensured/just made:', pathExistsForCertain, aVal);
				if (dirsToMake.length > 0) {
					makeDirRecurse();
				} else {
					deferred_makeDir_Bug934283.resolve('this path now exists for sure: "' + pathExistsForCertain + '"');
				}
			},
			function(aReason) {
				var rejObj = {
					promiseName: 'promise_makeDir',
					aReason: aReason,
					curPath: pathExistsForCertain
				};
				console.error('Rejected - ' + rejObj.promiseName + ' - ', rejObj);
				deferred_makeDir_Bug934283.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_makeDir', aCaught:aCaught};
				console.error('Caught - promise_makeDir - ', rejObj);
				deferred_makeDir_Bug934283.reject(rejObj); // throw aCaught;
			}
		);
	};
	makeDirRecurse();

	return promise_makeDir_Bug934283;
}
function tryOsFile_ifDirsNoExistMakeThenRetry(nameOfOsFileFunc, argsOfOsFileFunc, fromDir, aOptions={}) {
	//last update: 061215 0303p - verified worker version didnt have the fix i needed to land here ALSO FIXED so it handles neutering of Fx37 for writeAtomic and I HAD TO implement this fix to worker version, fix was to introduce aOptions.causesNeutering
	// aOptions:
		// causesNeutering - default is false, if you use writeAtomic or another function and use an ArrayBuffer then set this to true, it will ensure directory exists first before trying. if it tries then fails the ArrayBuffer gets neutered and the retry will fail with "invalid arguments"
		
	// i use this with writeAtomic, copy, i havent tested with other things
	// argsOfOsFileFunc is array of args
	// will execute nameOfOsFileFunc with argsOfOsFileFunc, if rejected and reason is directories dont exist, then dirs are made then rexecute the nameOfOsFileFunc
	// i added makeDir as i may want to create a dir with ignoreExisting on final dir as was the case in pickerIconset()
	// returns promise
	
	var deferred_tryOsFile_ifDirsNoExistMakeThenRetry = new Deferred();
	
	if (['writeAtomic', 'copy', 'makeDir'].indexOf(nameOfOsFileFunc) == -1) {
		deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject('nameOfOsFileFunc of "' + nameOfOsFileFunc + '" is not supported');
		// not supported because i need to know the source path so i can get the toDir for makeDir on it
		return deferred_tryOsFile_ifDirsNoExistMakeThenRetry.promise; //just to exit further execution
	}
	
	// setup retry
	var retryIt = function() {
		console.info('tryosFile_ retryIt', 'nameOfOsFileFunc:', nameOfOsFileFunc, 'argsOfOsFileFunc:', argsOfOsFileFunc);
		var promise_retryAttempt = OS.File[nameOfOsFileFunc].apply(OS.File, argsOfOsFileFunc);
		promise_retryAttempt.then(
			function(aVal) {
				console.log('Fullfilled - promise_retryAttempt - ', aVal);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.resolve('retryAttempt succeeded');
			},
			function(aReason) {
				var rejObj = {name:'promise_retryAttempt', aReason:aReason};
				console.error('Rejected - promise_retryAttempt - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); //throw rejObj;
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_retryAttempt', aCaught:aCaught};
				console.error('Caught - promise_retryAttempt - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); // throw aCaught;
			}
		);
	};
	
	// popToDir
	var toDir;
	var popToDir = function() {
		switch (nameOfOsFileFunc) {
			case 'writeAtomic':
				toDir = OS.Path.dirname(argsOfOsFileFunc[0]);
				break;
				
			case 'copy':
				toDir = OS.Path.dirname(argsOfOsFileFunc[1]);
				break;

			case 'makeDir':
				toDir = OS.Path.dirname(argsOfOsFileFunc[0]);
				break;
				
			default:
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject('nameOfOsFileFunc of "' + nameOfOsFileFunc + '" is not supported');
				return; // to prevent futher execution
		}
	};
	
	// setup recurse make dirs
	var makeDirs = function() {
		if (!toDir) {
			popToDir();
		}
		var promise_makeDirsRecurse = makeDir_Bug934283(toDir, {from: fromDir});
		promise_makeDirsRecurse.then(
			function(aVal) {
				console.log('Fullfilled - promise_makeDirsRecurse - ', aVal);
				retryIt();
			},
			function(aReason) {
				var rejObj = {name:'promise_makeDirsRecurse', aReason:aReason};
				console.error('Rejected - promise_makeDirsRecurse - ', rejObj);
				/*
				if (aReason.becauseNoSuchFile) {
					console.log('make dirs then do retryAttempt');
					makeDirs();
				} else {
					// did not get becauseNoSuchFile, which means the dirs exist (from my testing), so reject with this error
				*/
					deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); //throw rejObj;
				/*
				}
				*/
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_makeDirsRecurse', aCaught:aCaught};
				console.error('Caught - promise_makeDirsRecurse - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); // throw aCaught;
			}
		);
	};

	var doInitialAttempt = function() {
		var promise_initialAttempt = OS.File[nameOfOsFileFunc].apply(OS.File, argsOfOsFileFunc);
		console.info('tryosFile_ initial', 'nameOfOsFileFunc:', nameOfOsFileFunc, 'argsOfOsFileFunc:', argsOfOsFileFunc);
		promise_initialAttempt.then(
			function(aVal) {
				console.log('Fullfilled - promise_initialAttempt - ', aVal);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.resolve('initialAttempt succeeded');
			},
			function(aReason) {
				var rejObj = {name:'promise_initialAttempt', aReason:aReason};
				console.error('Rejected - promise_initialAttempt - ', rejObj);
				if (aReason.becauseNoSuchFile) { // this is the flag that gets set to true if parent dir(s) dont exist, i saw this from experience
					console.log('make dirs then do secondAttempt');
					makeDirs();
				} else {
					deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); //throw rejObj;
				}
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_initialAttempt', aCaught:aCaught};
				console.error('Caught - promise_initialAttempt - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); // throw aCaught;
			}
		);
	};
	
	if (!aOptions.causesNeutering) {
		doInitialAttempt();
	} else {
		// ensure dir exists, if it doesnt then go to makeDirs
		popToDir();
		var promise_checkDirExistsFirstAsCausesNeutering = OS.File.exists(toDir);
		promise_checkDirExistsFirstAsCausesNeutering.then(
			function(aVal) {
				console.log('Fullfilled - promise_checkDirExistsFirstAsCausesNeutering - ', aVal);
				// start - do stuff here - promise_checkDirExistsFirstAsCausesNeutering
				if (!aVal) {
					makeDirs();
				} else {
					doInitialAttempt(); // this will never fail as we verified this folder exists
				}
				// end - do stuff here - promise_checkDirExistsFirstAsCausesNeutering
			},
			function(aReason) {
				var rejObj = {name:'promise_checkDirExistsFirstAsCausesNeutering', aReason:aReason};
				console.warn('Rejected - promise_checkDirExistsFirstAsCausesNeutering - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_checkDirExistsFirstAsCausesNeutering', aCaught:aCaught};
				console.error('Caught - promise_checkDirExistsFirstAsCausesNeutering - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj);
			}
		);
	}
	
	
	return deferred_tryOsFile_ifDirsNoExistMakeThenRetry.promise;
}
function aReasonMax(aReason) {
	var deepestReason = aReason;
	while (deepestReason.hasOwnProperty('aReason') || deepestReason.hasOwnProperty()) {
		if (deepestReason.hasOwnProperty('aReason')) {
			deepestReason = deepestReason.aReason;
		} else if (deepestReason.hasOwnProperty('aCaught')) {
			deepestReason = deepestReason.aCaught;
		}
	}
	return deepestReason;
}

var txtDecodr; // holds TextDecoder if created
function getTxtDecodr() {
	if (!txtDecodr) {
		txtDecodr = new TextDecoder();
	}
	return txtDecodr;
}
var txtEncodr; // holds TextDecoder if created
function getTxtEncodr() {
	if (!txtEncodr) {
		txtEncodr = new TextEncoder();
	}
	return txtEncodr;
}
function read_encoded(path, options) {
	// because the options.encoding was introduced only in Fx30, this function enables previous Fx to use it
	// must pass encoding to options object, same syntax as OS.File.read >= Fx30
	// TextDecoder must have been imported with Cu.importGlobalProperties(['TextDecoder']);
	
	var deferred_read_encoded = new Deferred();
	
	if (options && !('encoding' in options)) {
		deferred_read_encoded.reject('Must pass encoding in options object, otherwise just use OS.File.read');
		return deferred_read_encoded.promise;
	}
	
	if (options && Services.vc.compare(Services.appinfo.version, 30) < 0) { // tests if version is less then 30
		//var encoding = options.encoding; // looks like i dont need to pass encoding to TextDecoder, not sure though for non-utf-8 though
		delete options.encoding;
	}
	var promise_readIt = OS.File.read(path, options);
	
	promise_readIt.then(
		function(aVal) {
			console.log('Fullfilled - promise_readIt - ', {a:{a:aVal}});
			// start - do stuff here - promise_readIt
			var readStr;
			if (Services.vc.compare(Services.appinfo.version, 30) < 0) { // tests if version is less then 30
				readStr = getTxtDecodr().decode(aVal); // Convert this array to a text
			} else {
				readStr = aVal;
			}
			deferred_read_encoded.resolve(readStr);
			// end - do stuff here - promise_readIt
		},
		function(aReason) {
			var rejObj = {name:'promise_readIt', aReason:aReason};
			console.error('Rejected - promise_readIt - ', rejObj);
			deferred_read_encoded.reject(rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_readIt', aCaught:aCaught};
			console.error('Caught - promise_readIt - ', rejObj);
			deferred_read_encoded.reject(rejObj);
		}
	);
	
	return deferred_read_encoded.promise;
}
function Deferred() {
	// update 062115 for typeof
	if (typeof(Promise) != 'undefined' && Promise.defer) {
		//need import of Promise.jsm for example: Cu.import('resource:/gree/modules/Promise.jsm');
		return Promise.defer();
	} else if (typeof(PromiseUtils) != 'undefined'  && PromiseUtils.defer) {
		//need import of PromiseUtils.jsm for example: Cu.import('resource:/gree/modules/PromiseUtils.jsm');
		return PromiseUtils.defer();
	} else {
		/* A method to resolve the associated Promise with the value passed.
		 * If the promise is already settled it does nothing.
		 *
		 * @param {anything} value : This value is used to resolve the promise
		 * If the value is a Promise then the associated promise assumes the state
		 * of Promise passed as value.
		 */
		this.resolve = null;

		/* A method to reject the assocaited Promise with the value passed.
		 * If the promise is already settled it does nothing.
		 *
		 * @param {anything} reason: The reason for the rejection of the Promise.
		 * Generally its an Error object. If however a Promise is passed, then the Promise
		 * itself will be the reason for rejection no matter the state of the Promise.
		 */
		this.reject = null;

		/* A newly created Pomise object.
		 * Initially in pending state.
		 */
		this.promise = new Promise(function(resolve, reject) {
			this.resolve = resolve;
			this.reject = reject;
		}.bind(this));
		Object.freeze(this);
	}
}
function xhr(aStr, aOptions={}) {
	// update 082115 - was not listening to timeout event, added that in
	// update on 082015 - fixed that aTimeout was not setting right
	// update 072615 - added support for aOptions.aMethod
	// currently only setup to support GET and POST
	// does an async request
	// aStr is either a string of a FileURI such as `OS.Path.toFileURI(OS.Path.join(OS.Constants.Path.desktopDir, 'test.png'));` or a URL such as `http://github.com/wet-boew/wet-boew/archive/master.zip`
	// Returns a promise
		// resolves with xhr object
		// rejects with object holding property "xhr" which holds the xhr object
	
	/*** aOptions
	{
		aLoadFlags: flags, // https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/NsIRequest#Constants
		aTiemout: integer (ms)
		isBackgroundReq: boolean, // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#Non-standard_properties
		aResponseType: string, // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#Browser_Compatibility
		aPostData: string
	}
	*/
	
	var aOptions_DEFAULT = {
		aLoadFlags: Ci.nsIRequest.LOAD_ANONYMOUS | Ci.nsIRequest.LOAD_BYPASS_CACHE | Ci.nsIRequest.INHIBIT_PERSISTENT_CACHING,
		aPostData: null,
		aResponseType: 'text',
		isBackgroundReq: true, // If true, no load group is associated with the request, and security dialogs are prevented from being shown to the user
		aTimeout: 0, // 0 means never timeout, value is in milliseconds
		Headers: null
	}
	
	for (var opt in aOptions_DEFAULT) {
		if (!(opt in aOptions)) {
			aOptions[opt] = aOptions_DEFAULT[opt];
		}
	}
	
	// Note: When using XMLHttpRequest to access a file:// URL the request.status is not properly set to 200 to indicate success. In such cases, request.readyState == 4, request.status == 0 and request.response will evaluate to true.
	
	var deferredMain_xhr = new Deferred();
	console.log('here222');
	var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

	var handler = ev => {
		evf(m => xhr.removeEventListener(m, handler, !1));

		switch (ev.type) {
			case 'load':
			
					if (xhr.readyState == 4) {
						if (xhr.status == 200) {
							deferredMain_xhr.resolve(xhr);
						} else {
							var rejObj = {
								name: 'deferredMain_xhr.promise',
								aReason: 'Load Not Success', // loaded but status is not success status
								xhr: xhr,
								message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
							};
							deferredMain_xhr.reject(rejObj);
						}
					} else if (xhr.readyState == 0) {
						var uritest = Services.io.newURI(aStr, null, null);
						if (uritest.schemeIs('file')) {
							deferredMain_xhr.resolve(xhr);
						} else {
							var rejObj = {
								name: 'deferredMain_xhr.promise',
								aReason: 'Load Failed', // didnt even load
								xhr: xhr,
								message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
							};
							deferredMain_xhr.reject(rejObj);
						}
					}
					
				break;
			case 'abort':
			case 'error':
			case 'timeout':
				
					var rejObj = {
						name: 'deferredMain_xhr.promise',
						aReason: ev.type[0].toUpperCase() + ev.type.substr(1),
						xhr: xhr,
						message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
					};
					deferredMain_xhr.reject(rejObj);
				
				break;
			default:
				var rejObj = {
					name: 'deferredMain_xhr.promise',
					aReason: 'Unknown',
					xhr: xhr,
					message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
				};
				deferredMain_xhr.reject(rejObj);
		}
	};

	var evf = f => ['load', 'error', 'abort', 'timeout'].forEach(f);
	evf(m => xhr.addEventListener(m, handler, false));

	if (aOptions.isBackgroundReq) {
		xhr.mozBackgroundRequest = true;
	}
	
	if (aOptions.aTimeout) {
		console.error('setting timeout to:', aOptions.aTimeout)
		xhr.timeout = aOptions.aTimeout;
	}
	
	var do_setHeaders = function() {
		if (aOptions.Headers) {
			for (var h in aOptions.Headers) {
				xhr.setRequestHeader(h, aOptions.Headers[h]);
			}
		}
	};
	
	if (aOptions.aPostData) {
		xhr.open('POST', aStr, true);
		do_setHeaders();
		xhr.channel.loadFlags |= aOptions.aLoadFlags;
		xhr.responseType = aOptions.aResponseType;
		
		/*
		var aFormData = Cc['@mozilla.org/files/formdata;1'].createInstance(Ci.nsIDOMFormData);
		for (var pd in aOptions.aPostData) {
			aFormData.append(pd, aOptions.aPostData[pd]);
		}
		xhr.send(aFormData);
		*/
		var aPostStr = [];
		for (var pd in aOptions.aPostData) {
			aPostStr.push(pd + '=' + encodeURIComponent(aOptions.aPostData[pd])); // :todo: figure out if should encodeURIComponent `pd` also figure out if encodeURIComponent is the right way to do this
			console.info(aPostStr[aPostStr.length-1]);
		}
		aPostStr = aPostStr.join('&');
		console.info('aPostStr:', aPostStr);
		xhr.send(aPostStr);
	} else {
		xhr.open(aOptions.aMethod ? aOptions.aMethod : 'GET', aStr, true);
		do_setHeaders();
		xhr.channel.loadFlags |= aOptions.aLoadFlags;
		xhr.responseType = aOptions.aResponseType;
		xhr.send(null);
	}
	
	return deferredMain_xhr.promise;
}
// end - common helper functions