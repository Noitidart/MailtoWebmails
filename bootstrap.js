// Imports
const {classes: Cc, interfaces: Ci, manager: Cm, results: Cr, utils: Cu, Constructor: CC} = Components;
Cm.QueryInterface(Ci.nsIComponentRegistrar);
Cu.import('resource://gre/modules/devtools/Console.jsm');
Cu.import('resource://gre/modules/osfile.jsm');
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
		return Ci.nsIAboutModule.ALLOW_SCRIPT;
	},

	newChannel: function(aURI) {
		let channel = Services.io.newChannel(core.addon.path.content + 'app.xhtml', null, null);
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
		fsComServer.fsUrl = fsComServer.devuserSpecifiedFsUrl + '?' + Math.random(); /* Randomize URI to work around bug 1051238 - otherwise it will be a cached version*/
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
/*end - framescriptlistener*/
function install() {}
function uninstall() {}

function startup(aData, aReason) {
	// core.addon.aData = aData;
	extendCore();
	
	//framescriptlistener more
	//fsComServer.register(core.addon.path.scripts + '_framescript-warn-on-submit.js');
	//end framescriptlistener more
	
	aboutFactory_mailto = new AboutFactory(AboutMailto);
}

function shutdown(aData, aReason) {
	if (aReason == APP_SHUTDOWN) { return }

	//framescriptlistener more
	fsComServer.unregister();
	//end framescriptlistener more
	
	// an issue with this unload is that framescripts are left over, i want to destory them eventually
	aboutFactory_mailto.unregister();
}

// start - common helper functions
// end - common helper functions