

// Imports
const {classes: Cc, interfaces: Ci, manager: Cm, results: Cr, utils: Cu, Constructor: CC} = Components;
// Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import('resource://gre/modules/osfile.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

// Globals
var core = {
	addon: {
		id: 'MailtoWebmails@jetpack',
		path: {
			locale: 'chrome://mailtowebmails/locale/'
		},
		cache_key: 'v2.2' // set to version on release
	}
}

var myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'eps', function(){ return Cc['@mozilla.org/uriloader/external-protocol-service;1'].getService(Ci.nsIExternalProtocolService) });
XPCOMUtils.defineLazyGetter(myServices, 'hs', function(){ return Cc['@mozilla.org/uriloader/handler-service;1'].getService(Ci.nsIHandlerService) });
XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'app.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });

const defaultColor = '#7AA2FF';
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

const userBasedProps = {
	installed: 1,
	active: 1,
	updated: 1,
	new: 1
};
const myPrefBranch = 'extensions.' + core.addon.id + '.';
/*
var runit = 'asdfasdf';
while (runit != '') {
	runit = prompt('run what:', runit);
	try {
		eval(runit);
	} catch(ex) {

	}
}
*/
/*
var gCFMM = contentMMFromContentWindow_Method2(window);

gCFMM.sendAsyncMessage(core.addon.id, {aTopic:'clientRequest_adoptMeAndInit'});
*/

const JETPACK_DIR_BASENAME = 'jetpack';
const OSPath_installedServices = OS.Path.join(OS.Constants.Path.profileDir, JETPACK_DIR_BASENAME, core.addon.id, 'simple-storage', 'pop_or_stalled.json');
const OSPath_pendingSubmit = OS.Path.join(OS.Constants.Path.profileDir, JETPACK_DIR_BASENAME, core.addon.id, 'simple-storage', 'pendingSubmit.bool');

var	ANG_APP = angular.module('mailtowebmails', [])
	.config(['$sceDelegateProvider', function($sceDelegateProvider) {
		$sceDelegateProvider.resourceUrlWhitelist(['self', 'chrome://mailtowebmails/**/*.htm']);
	}])
	.directive('row', [function() {
		return {
			restrict: 'E',
			templateUrl: 'chrome://mailtowebmails/content/resources/directives/row.htm'
		};
	}])
	.controller('BodyController', ['$scope', '$sce', function($scope, $sce) {
		
		var MODULE = this;
		
		MODULE.mailto_services = [];
		MODULE.mailto_services_updated_details = {};
		MODULE.editing_handler_id = null; // id is uriTemplate/url_handler
		// MODULE.attn_msg = $sce.trustAsHtml(myServices.sb.GetStringFromName('attn_checking-updates'));
		
		MODULE.toggle_active = function(aServiceEntry) {
			if (!aServiceEntry.active) {
				for (var i=0; i<MODULE.mailto_services.length; i++) {
					MODULE.mailto_services[i].active = false;
				}
				aServiceEntry.active = true;
				
				// find this handler and set it as active
				var handlerInfoXPCOM = myServices.eps.getProtocolHandlerInfo('mailto');
				var handlers = handlerInfoXPCOM.possibleApplicationHandlers.enumerate();
				while (handlers.hasMoreElements()) {
					var handler = handlers.getNext().QueryInterface(Ci.nsIWebHandlerApp);
					if (handler.uriTemplate == aServiceEntry.url_template) {
						// found it
						handlerInfoXPCOM.preferredAction = Ci.nsIHandlerInfo.useHelperApp; //Ci.nsIHandlerInfo has keys: alwaysAsk:1, handleInternally:3, saveToDisk:0, useHelperApp:2, useSystemDefault:4
						handlerInfoXPCOM.preferredApplicationHandler = handler;
						handlerInfoXPCOM.alwaysAskBeforeHandling = false;
						break;
					}
				}
				// :todo: troubleshoot, if not found
			} else {
				aServiceEntry.active = false;
				
				// implement to firefox, to ask on next click, as this one was active
				// ensure that this handler was active
				var handlerInfoXPCOM = myServices.eps.getProtocolHandlerInfo('mailto');

				if (handlerInfoXPCOM.preferredApplicationHandler) {
					try {
						handlerInfoXPCOM.preferredApplicationHandler.QueryInterface(Ci.nsIWebHandlerApp); // so it gets the uriTemplate property
					} catch (ignore) {}
				}


				if (handlerInfoXPCOM.preferredAction == Ci.nsIHandlerInfo.useHelperApp && handlerInfoXPCOM.preferredApplicationHandler && handlerInfoXPCOM.preferredApplicationHandler.uriTemplate && handlerInfoXPCOM.preferredApplicationHandler.uriTemplate == aServiceEntry.url_template) {
					// yes it was active, lets unset it
					handlerInfoXPCOM.alwaysAskBeforeHandling = true;
					handlerInfoXPCOM.preferredAction = Ci.nsIHandlerInfo.alwaysAsk; //this doesnt really do anything but its just nice to be not stale. it doesnt do anything because firefox checks handlerInfo.alwaysAskBeforeHandling to decide if it should ask. so me doing this is just formality to be looking nice
					handlerInfoXPCOM.preferredApplicationHandler = null;
				} // :todo: troubleshoot, if it wasnt active maybe
			}
			myServices.hs.store(handlerInfoXPCOM);
		};

		MODULE.toggle_install = function(aServiceEntry) {
			// on uninstall, if it is discovered/custom/social/presonal
			aServiceEntry.installed = !aServiceEntry.installed;
			if (!aServiceEntry.installed) {
				aServiceEntry.active = false;
			}
			
			// implement update to firefox
			var handlerInfoXPCOM = myServices.eps.getProtocolHandlerInfo('mailto');
			if (aServiceEntry.installed) {
				var handler = Cc["@mozilla.org/uriloader/web-handler-app;1"].createInstance(Ci.nsIWebHandlerApp);
				handler.name = aServiceEntry.name;
				handler.uriTemplate = aServiceEntry.url_template;
				handlerInfoXPCOM.possibleApplicationHandlers.appendElement(handler, false);
			} else {
				
				var preferredHandlerIsWebApp;
				if (handlerInfoXPCOM.preferredApplicationHandler) {
					try {
						handlerInfoXPCOM.preferredApplicationHandler.QueryInterface(Ci.nsIWebHandlerApp); // so it gets the uriTemplate property
						preferredHandlerIsWebApp = true;
					} catch (ex) {
						preferredHandlerIsWebApp = false;
					}
				}
				
				var nHandlers = handlerInfoXPCOM.possibleApplicationHandlers.length;
				for (var i=0; i<nHandlers; i++) {
					var handlerQI = handlerInfoXPCOM.possibleApplicationHandlers.queryElementAt(i, Ci.nsIWebHandlerApp);
					// cant remove if its the curently preferred, so check that, and if it is, then unsert it as preferred
					if (handlerInfoXPCOM.preferredAction == Ci.nsIHandlerInfo.useHelperApp && handlerInfoXPCOM.preferredApplicationHandler && handlerInfoXPCOM.preferredApplicationHandler.uriTemplate && handlerInfoXPCOM.preferredApplicationHandler.uriTemplate == aServiceEntry.url_template) {
						//it looks like the preferredAction was to use this helper app, so now that its no longer there we will have to ask what the user wants to do next time the uesrs clicks a mailto: link
						handlerInfoXPCOM.alwaysAskBeforeHandling = true;
						handlerInfoXPCOM.preferredAction = Ci.nsIHandlerInfo.alwaysAsk; //this doesnt really do anything but its just nice to be not stale. it doesnt do anything because firefox checks handlerInfo.alwaysAskBeforeHandling to decide if it should ask. so me doing this is just formality to be looking nice
						handlerInfoXPCOM.preferredApplicationHandler = null;
					}
					if (handlerQI.uriTemplate == aServiceEntry.url_template) {
						handlerInfoXPCOM.possibleApplicationHandlers.removeElementAt(i);
						break;
					}
				}
			}
			
			if (aServiceEntry.group != 0) {
				writeCleanedObjToDisk(); // because if its a discovered one, then i want to remove from file on uninstall, and add to file on install
			}
			
			myServices.hs.store(handlerInfoXPCOM);
		};
		
		MODULE.edit = function(aServiceEntry) {
			MODULE.editing_handler_id = aServiceEntry.url_template;
			
			MODULE.form_name = aServiceEntry.name;
			MODULE.form_url_template = aServiceEntry.url_template;
			MODULE.form_description = aServiceEntry.description;
			MODULE.form_img = aServiceEntry.icon_dataurl;
			MODULE.form_color = aServiceEntry.color ? aServiceEntry.color : defaultColor;
			document.getElementById('pcolor').value = aServiceEntry.color ? aServiceEntry.color : defaultColor;
			
			window.location.hash = '#add_service';
		};
		
		MODULE.form_color = defaultColor;
		document.getElementById('pcolor').value = defaultColor;
		
		MODULE.add = function() {
			try {
				Services.io.newURI(MODULE.form_url_template, null, null);
			} catch (ex) {
				alert(myServices.sb.GetStringFromName('url_template-bad-uri'));
				return;
			}
			
			if (MODULE.form_url_template.indexOf('%s') == -1) {
				alert(myServices.sb.GetStringFromName('url_template-no-wildcard'));
				return;
			}
			
			if (!MODULE.form_name || MODULE.form_name.length == 0) {
				alert(myServices.sb.GetStringFromName('url_template-no-name'));
				return;
			}
			
			
			if (MODULE.editing_handler_id) {
				// user wants edit
				// alert('user wants edit');
				
				var foundServiceEntry = false;
				for (var i=0; i<MODULE.mailto_services.length; i++) {
					if (MODULE.mailto_services[i].url_template == MODULE.editing_handler_id) {
						foundServiceEntry = true;
						break;
					}
				}
				if (!foundServiceEntry) {
					alert('error occured: could not find service entry for this service you are editing, this is bad, developer made an error, this should never happen');
					throw new Error('error occured: could not find service entry for this service you are editing, this is bad, developer made an error, this should never happen');
				}
				
				// make sure not a duplicate of what is currently installed and popular
				for (var j=0; j<MODULE.mailto_services.length; j++) {
					if (MODULE.mailto_services[j].url_template == MODULE.editing_handler_id) {
						continue;
					}
					if (MODULE.mailto_services[j].url_template == MODULE.form_url_template) {
						alert(myServices.sb.GetStringFromName('duplicate_url'));
						return;
					}
				}
				
				var ifInstalled_url_template = MODULE.mailto_services[i].url_template;
				var uriTemplateUpdated = false;
				var nameUpdated = false;
				if (MODULE.mailto_services[i].url_template != MODULE.form_url_template) {
					uriTemplateUpdated = true;
					if (!('submit' in MODULE.mailto_services[i])) {
						// as if submit == 1, then we just want to update the url_template
						// if submit == 2, then it was last edited, so that hasnt reached server yet, so just update the url_template
						MODULE.mailto_services[i].old_url_templates.push(MODULE.mailto_services[i].url_template);
					}
				}
				
				if (MODULE.mailto_services[i].name != MODULE.form_name) {
					nameUpdated = true;
				}
				
				MODULE.mailto_services[i].url_template = MODULE.form_url_template;
				MODULE.mailto_services[i].color = MODULE.form_color;
				MODULE.mailto_services[i].icon_dataurl = MODULE.form_img;
				MODULE.mailto_services[i].name = MODULE.form_name;
				MODULE.mailto_services[i].description = MODULE.form_description;
				if ('submit' in MODULE.mailto_services[i] && MODULE.mailto_services[i].submit == 1) {
					// do nothing as its an add, but hasnt been added to server yet
				} else {
					MODULE.mailto_services[i].submit = 2; // 1 for add, 2 for edit
				}
				MODULE.mailto_services[i].update_time++;
				
				MODULE.editing_handler_id = null;
				
				writeCleanedObjToDisk();
				markPendingServerSubmit();
				
				// do work on firefox backend if name or url_template was updated
				if (uriTemplateUpdated || nameUpdated) {
					
					// start - block link68358151
					var handlerInfoXPCOM = myServices.eps.getProtocolHandlerInfo('mailto');
					
					// see if its installed
					var isInstalled = false;
					var isIntalledAtIndex = null;
					var isActive = false;
					var nHandlers = handlerInfoXPCOM.possibleApplicationHandlers.length;
					for (var j=0; j<nHandlers; j++) {
						var handlerQI = handlerInfoXPCOM.possibleApplicationHandlers.queryElementAt(j, Ci.nsIWebHandlerApp);
						if (handlerQI.uriTemplate == ifInstalled_url_template) {
							isInstalled = true;
							isIntalledAtIndex = j;

							
							// check if it is active

							if (handlerInfoXPCOM.preferredApplicationHandler) {
								try {
									handlerInfoXPCOM.preferredApplicationHandler.QueryInterface(Ci.nsIWebHandlerApp); // so it gets the uriTemplate property
								} catch (ignore) {}
							}
							if (handlerInfoXPCOM.preferredAction == Ci.nsIHandlerInfo.useHelperApp && handlerInfoXPCOM.preferredApplicationHandler && handlerInfoXPCOM.preferredApplicationHandler.uriTemplate && handlerInfoXPCOM.preferredApplicationHandler.uriTemplate == ifInstalled_url_template) {

								isActive = true;
								// yes it was active, lets unset it
								handlerInfoXPCOM.alwaysAskBeforeHandling = true;
								handlerInfoXPCOM.preferredAction = Ci.nsIHandlerInfo.alwaysAsk; //this doesnt really do anything but its just nice to be not stale. it doesnt do anything because firefox checks handlerInfo.alwaysAskBeforeHandling to decide if it should ask. so me doing this is just formality to be looking nice
								handlerInfoXPCOM.preferredApplicationHandler = null;
							}

							if (isInstalled) { // we are in the same for block so obviously its installed
								// uninstall it

								handlerInfoXPCOM.possibleApplicationHandlers.removeElementAt(isIntalledAtIndex);
								

								myServices.hs.store(handlerInfoXPCOM);
								
								// install it back

								var handler = Cc["@mozilla.org/uriloader/web-handler-app;1"].createInstance(Ci.nsIWebHandlerApp);
								handler.name = MODULE.mailto_services[i].name;
								handler.uriTemplate = MODULE.mailto_services[i].url_template;
								handlerInfoXPCOM.possibleApplicationHandlers.appendElement(handler, false);
								
								if (isActive) {
									// set it back to active

									handlerInfoXPCOM.preferredAction = Ci.nsIHandlerInfo.useHelperApp; //Ci.nsIHandlerInfo has keys: alwaysAsk:1, handleInternally:3, saveToDisk:0, useHelperApp:2, useSystemDefault:4
									handlerInfoXPCOM.preferredApplicationHandler = handler;
									handlerInfoXPCOM.alwaysAskBeforeHandling = false;
								}
								

								myServices.hs.store(handlerInfoXPCOM);
							}
							
							break;
						}
					}
					
					if (!isInstalled) {

					}
					// end - block link68358151
				}

				
			} else {
				// user wants add
				
				// make sure not a duplicate of what is currently installed and popular
				for (var i=0; i<MODULE.mailto_services.length; i++) {
					if (MODULE.mailto_services[i].url_template == MODULE.form_url_template) {
						alert(myServices.sb.GetStringFromName('duplicate_url'));
						return;
					}
				}
				
				var handlerInfoXPCOM = myServices.eps.getProtocolHandlerInfo('mailto');
				var handler = Cc["@mozilla.org/uriloader/web-handler-app;1"].createInstance(Ci.nsIWebHandlerApp);
				handler.name = MODULE.form_name;
				handler.uriTemplate = MODULE.form_url_template;
				handlerInfoXPCOM.possibleApplicationHandlers.appendElement(handler, false);
				
				var pushObj = JSON.parse(JSON.stringify(mailtoServicesObjEntryTemplate));
				pushObj.name = MODULE.form_name;
				pushObj.url_template = MODULE.form_url_template;
				pushObj.description = MODULE.form_description;
				pushObj.color = MODULE.form_color;
				pushObj.icon_dataurl = MODULE.form_img;
				pushObj.group = 1;
				pushObj.installed = true;
				pushObj.update_time = 1; // as im alreayd marking it submit, i dont want it to think update_time==0 so its server unknown
				pushObj.submit = 1; // 1 for add, 2 for edit
				MODULE.mailto_services.push(pushObj);
				
				writeCleanedObjToDisk();
				markPendingServerSubmit();
				
				myServices.hs.store(handlerInfoXPCOM);
			}			
			
			MODULE.form_name = null;
			MODULE.form_url_template = null;
			MODULE.form_description = null;
			MODULE.form_img = null;
			MODULE.form_color = defaultColor;
			document.getElementById('pcolor').value = defaultColor;
		};
		
		MODULE.clear_form = function(aEvent) {
			if (aEvent.keyCode == 27) {

				//alert('clearing form');
				// user hit escape key
				if (MODULE.editing_handler_id) {
					// cancel edit
					// alert('cancelling edit');
					MODULE.editing_handler_id = null;
				} else if (MODULE.form_name || MODULE.form_url_template || MODULE.form_description || MODULE.form_img || MODULE.form_color != defaultColor) {
					// clear form
					// alert('clearing form');
					MODULE.form_name = '';
					MODULE.form_url_template = '';
					MODULE.form_description = '';
					MODULE.form_img = '';
					MODULE.form_color = defaultColor;
					document.getElementById('pcolor').value = defaultColor;
				}
			}
		};
		
		MODULE.choose_img = function() {
			var fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
			fp.init(Services.wm.getMostRecentWindow(null), myServices.sb.GetStringFromName('pick_img'), Ci.nsIFilePicker.modeOpen);
			fp.appendFilters(Ci.nsIFilePicker.filterImages);
			
			var rv = fp.show();
			if (rv == Ci.nsIFilePicker.returnOK) {

				// MODULE.form_img = Services.io.newFileURI(fp.file).spec;
				
				var img = new Image();
				img.onload = function() {
					var scaleFactor = 1;
					if (img.width > 80 || img.height > 80) {
						scaleFactor = Math.min(80 / img.width, 80 / img.height);
						alert(myServices.sb.formatStringFromName('img_bad-dimensions', [img.width, img.height, Math.floor(img.width * scaleFactor), Math.floor(img.height * scaleFactor)], 4));
					}
					var can = document.createElement('canvas');
					can.width = Math.floor(img.width * scaleFactor);
					can.height = Math.floor(img.height * scaleFactor);
					var ctx = can.getContext('2d');
					ctx.drawImage(img, 0, 0, can.width, can.height);
					MODULE.form_img = can.toDataURL('image/png', '');
					gAngScope.$digest();
				};
				img.src = Services.io.newFileURI(fp.file).spec;
			}// else { // cancelled	}
		};
	}]);
var gAngScope
var gAngInjector;

var serverMessageListener = {
	// listens to messages sent from clients (child framescripts) to me/server
	receiveMessage: function(aMsg) {
		switch (aMsg.json.aTopic) {
			case 'serverCommand_removeSubmitFlag':
					
					for (var i=0; i<gAngScope.BC.mailto_services.length; i++) {
						if (areUrlTemplatesOfSame(gAngScope.BC.mailto_services[i].url_template, gAngScope.BC.mailto_services[i].old_url_templates, aMsg.json.submittedUrlTemplate, aMsg.json.submittedOldUrlTemplates)) {
							delete gAngScope.BC.mailto_services[i].submit;

							break;
						}
					};
					
				break;
			default:

		}
	}
};

function doOnBeforeUnload() {

	contentMMFromContentWindow_Method2(window).removeMessageListener(core.addon.id, serverMessageListener);

}

function doOnLoad() {
	var gAngBody = angular.element(document.body);
	gAngScope = gAngBody.scope();
	gAngInjector = gAngBody.injector();
	
	var promise_readInstalledServices = read_encoded(OSPath_installedServices, {encoding:'utf-16'});
	// :todo: while its reading we kick off getting the currently installed mailto handlers link9784703
	
	// check and get whats currently installed/active
	var handlerInfoXPCOM = myServices.eps.getProtocolHandlerInfo('mailto');

	if (handlerInfoXPCOM.preferredApplicationHandler) {
		try {
			handlerInfoXPCOM.preferredApplicationHandler.QueryInterface(Ci.nsIWebHandlerApp); // so it gets the uriTemplate property for link68403540621
		} catch (ignore) {}
	}
	
    //start - find installed handlers
    var handlersXPCOM = handlerInfoXPCOM.possibleApplicationHandlers.enumerate();
	var handlers = [];
    while (handlersXPCOM.hasMoreElements()) {
        var handler = handlersXPCOM.getNext().QueryInterface(Ci.nsIWebHandlerApp);
		handlers.push(handler);

    }
	
	promise_readInstalledServices.then(
		function(aVal) {

			// start - do stuff here - promise_readInstalledServices

			gAngScope.BC.mailto_services = JSON.parse(aVal);
			
			// :todo: add into mailto_services what i obtained from link9784703, this is to figure out what is installed and active/inactive
			var shouldSaveHandlersInfo = false;
			var activeFoundAndSet = false;
			// var handlerInfoXPCOM = myServices.eps.getProtocolHandlerInfo('mailto');
			for (var i=0; i<handlers.length; i++) {

				var installed_url_template_found = false; // if after loop its found, then this is newly inserted
				var installed_url_template = handlers[i].uriTemplate;
				var installed_name = handlers[i].name;
				// find this handler in mailto_services obj
				for (var j=0; j<gAngScope.BC.mailto_services.length; j++) {
					var user_url_template = gAngScope.BC.mailto_services[j].url_template;
					if (user_url_template == installed_url_template || gAngScope.BC.mailto_services[j].old_url_templates.indexOf(installed_url_template) > -1) {

						installed_url_template_found = true;
						
						gAngScope.BC.mailto_services[j].installed = true;

						if (gAngScope.BC.mailto_services[j].old_url_templates.indexOf(installed_url_template) > -1) {

							handlers[i].uriTemplate = gAngScope.BC.mailto_services[j].url_template; // :assuming: mailtowebmails is right, and the one installed is wrong // link98031409847
							shouldSaveHandlersInfo = true;
						}
						/*
						if (gAngScope.BC.mailto_services[j].name != installed_name) {

							handlers[i].name = gAngScope.BC.mailto_services[j].name; // :todo: this is not consistent, so will not do, i have to figure out how to do this. the only way that works right now is to remove it, then add it back
							shouldSaveHandlersInfo = true;
						}
						*/

						if (!activeFoundAndSet && handlerInfoXPCOM.preferredAction == Ci.nsIHandlerInfo.useHelperApp && handlerInfoXPCOM.preferredApplicationHandler/* instanceof Ci.nsIWebHandlerApp --no need as i qi'ed it above*/ && handlerInfoXPCOM.preferredApplicationHandler.uriTemplate && handlerInfoXPCOM.preferredApplicationHandler.uriTemplate == gAngScope.BC.mailto_services[j].url_template) { // i use `gAngScope.BC.mailto_services[j].url_template` instead of installed_url_template because in case it was updated on link98031409847 and shouldSaveHandlersInfo has not been called yet // link68403540621
							gAngScope.BC.mailto_services[j].active = true;
						}
						
						break;
					}
				}

				if (!installed_url_template_found) {

					var pushObj = JSON.parse(JSON.stringify(mailtoServicesObjEntryTemplate));
					pushObj.name = installed_name;
					pushObj.url_template = installed_url_template;
					pushObj.group = 1;
					
					pushObj.installed = true;
					if (!activeFoundAndSet && handlerInfoXPCOM.preferredApplicationHandler && handlerInfoXPCOM.preferredApplicationHandler.uriTemplate == installed_url_template) {
						pushObj.active = true;
					}
					
					gAngScope.BC.mailto_services.push(pushObj);


					
					// :todo: write a function that goes through the mailto_services and submits to server stuff to share
				}

			}
			

			if (shouldSaveHandlersInfo) {

				myServices.hs.store(handlerInfoXPCOM);

			}
			

			gAngScope.$digest();
			contentMMFromContentWindow_Method2(window).addMessageListener(core.addon.id, serverMessageListener);

			tryUpdate();
			// end - do stuff here - promise_readInstalledServices
		},
		function(aReason) {
			var rejObj = {name:'promise_readInstalledServices', aReason:aReason};

			// deferred_createProfile.reject(rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_readInstalledServices', aCaught:aCaught};

			// deferred_createProfile.reject(rejObj);
		}
	);
}

function retryUpdate() {
	gAngScope.BC.attn_msg = gAngInjector.get('$sce').trustAsHtml(myServices.sb.GetStringFromName('attn_checking-updates'));
	gAngScope.$digest();
	setTimeout(tryUpdate, 200);
}

function tryUpdate() {
	var postJson = {
		latestPopUpdateTime: 0,
		discoveredServices: {}
	};
	for (var i=0; i<gAngScope.BC.mailto_services.length; i++) {
		if (gAngScope.BC.mailto_services[i].group == 0 && gAngScope.BC.mailto_services[i].update_time > postJson.latestPopUpdateTime) {
			postJson.latestPopUpdateTime = gAngScope.BC.mailto_services[i].update_time;
		}
		if (gAngScope.BC.mailto_services[i].group == 1) {
			postJson.discoveredServices[gAngScope.BC.mailto_services[i].url_template] = {
				last_update_time: gAngScope.BC.mailto_services[i].update_time, // :todo: keep checking, what if updte_time is undefined? ensure it goes through as 0, right now i think it will always defalut to 0 so thats why i dont do a tertiary here
				old_url_templates: gAngScope.BC.mailto_services[i].old_url_templates
			};
		}
	}

	var promise_fetchUpdates = xhr('http://mailtowebmails.site40.net/ajax/fetch_updates.php', {
		aResponseType: 'json',
		aPostData: {
			json: JSON.stringify(postJson)
		},
		Headers: {
			'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
		},
		aTimeout: 3000
	});
	promise_fetchUpdates.then(
		function(aVal) {

			// start - do stuff here - promise_fetchUpdates
			if (aVal.response === null) {
				// for 000webhost we get status 200 and responseURL of "http://error404.000webhost.com/?" when page doesnt exist
				gAngScope.BC.attn_msg = gAngInjector.get('$sce').trustAsHtml(myServices.sb.GetStringFromName('attn_server-down'));
			} else {
				gAngScope.BC.attn_msg = null;
				
				var responseJson = aVal.response;

				if (aVal.response.status != 'ok') {
					gAngScope.BC.attn_msg = gAngInjector.get('$sce').trustAsHtml(aVal.response.reason);
				} else {
					if (aVal.response.num_handlers_updated > 0) {
						// :todo: update mailto_services, if find any that are alreayd installed were updated, then update it. (:todo: consider if any installed were deleted then move it to social maybe)
						for (var updated_url_template in responseJson.social_handlers) {
							var updated_url_template_found = false; // if after loop its found, then this is newly inserted
							var updated_old_url_templates = responseJson.social_handlers[updated_url_template].old_url_templates;

							for (var i=0; i<gAngScope.BC.mailto_services.length; i++) {
								var user_url_template = gAngScope.BC.mailto_services[i].url_template;
								var user_old_url_templates = gAngScope.BC.mailto_services[i].old_url_templates;

								
								if (areUrlTemplatesOfSame(user_url_template, user_old_url_templates, updated_url_template, updated_old_url_templates)) {
									updated_url_template_found = true;
									// update user properties, and record what was updated so i can show in gui
									gAngScope.BC.mailto_services[i].updated = {};
									for (var possibly_updated_p in responseJson.social_handlers[updated_url_template]) {
										var possibly_updated_val = responseJson.social_handlers[updated_url_template][possibly_updated_p];
										var user_val = gAngScope.BC.mailto_services[i][possibly_updated_p];
										if (possibly_updated_val != user_val) {
											if (possibly_updated_p != 'old_url_templates') {
												gAngScope.BC.mailto_services[i].updated[possibly_updated_p] = {
													updated_val: possibly_updated_val,
													old_val: user_val
												};
												if (gAngScope.BC.mailto_services[i].installed && (possibly_updated_p == 'name' || possibly_updated_p == 'url_template')) {
													// need to update handler IF installed

												}
											}
											gAngScope.BC.mailto_services[i][possibly_updated_p] = possibly_updated_val;
										}
									}
									
									break;
								}
							}

							if (!updated_url_template_found) {

								responseJson.social_handlers[updated_url_template].new = true;
								gAngScope.BC.mailto_services.push(responseJson.social_handlers[updated_url_template]);

							}
						}
						
						// go through all the handlers, if there is updated obj on it which is on name or url_template, then uninstall and reinstall its protocol
							// also if there exists a social handler that has no info on server, mark it for submit and end of loop kick of a submit to server signal
						var handlerInfoXPCOM;
						var signalForSubmission = false;
						for (var i=0; i<gAngScope.BC.mailto_services.length; i++) {
							if (gAngScope.BC.mailto_services[i].installed && gAngScope.BC.mailto_services[i].updated && (gAngScope.BC.mailto_services[i].updated.name || gAngScope.BC.mailto_services[i].updated.url_template)) {
								// uninstall then reinstall it
								
								var ifInstalled_url_template;
								if (gAngScope.BC.mailto_services[i].updated.url_template) {
									ifInstalled_url_template = gAngScope.BC.mailto_services[i].updated.url_template.old_val;
								} else {
									ifInstalled_url_template = gAngScope.BC.mailto_services[i].url_template;
								}
								// start - SIMILAR to block link68358151
								if (!handlerInfoXPCOM) {
									handlerInfoXPCOM = myServices.eps.getProtocolHandlerInfo('mailto');
								}
								
								// see if its installed
								// var isInstalled = false;
								var isIntalledAtIndex = null;
								var isActive = false;
								var nHandlers = handlerInfoXPCOM.possibleApplicationHandlers.length;
								for (var j=0; j<nHandlers; j++) {
									var handlerQI = handlerInfoXPCOM.possibleApplicationHandlers.queryElementAt(j, Ci.nsIWebHandlerApp);
									if (handlerQI.uriTemplate == ifInstalled_url_template) {
										// isInstalled = true;
										isIntalledAtIndex = j;

										
										// check if it is active

										if (handlerInfoXPCOM.preferredApplicationHandler) {
											try {
												handlerInfoXPCOM.preferredApplicationHandler.QueryInterface(Ci.nsIWebHandlerApp); // so it gets the uriTemplate property
											} catch (ignore) {}
										}
										if (handlerInfoXPCOM.preferredAction == Ci.nsIHandlerInfo.useHelperApp && handlerInfoXPCOM.preferredApplicationHandler && handlerInfoXPCOM.preferredApplicationHandler.uriTemplate && handlerInfoXPCOM.preferredApplicationHandler.uriTemplate == ifInstalled_url_template) {

											isActive = true;
											// yes it was active, lets unset it
											handlerInfoXPCOM.alwaysAskBeforeHandling = true;
											handlerInfoXPCOM.preferredAction = Ci.nsIHandlerInfo.alwaysAsk; //this doesnt really do anything but its just nice to be not stale. it doesnt do anything because firefox checks handlerInfo.alwaysAskBeforeHandling to decide if it should ask. so me doing this is just formality to be looking nice
											handlerInfoXPCOM.preferredApplicationHandler = null;
										}

										// we are definitely installed
										// if (isInstalled) { // we are in the same for block so obviously its installed
											// uninstall it

											handlerInfoXPCOM.possibleApplicationHandlers.removeElementAt(isIntalledAtIndex);
											

											myServices.hs.store(handlerInfoXPCOM);
											
											// install it back

											var handler = Cc["@mozilla.org/uriloader/web-handler-app;1"].createInstance(Ci.nsIWebHandlerApp);
											handler.name = gAngScope.BC.mailto_services[i].name;
											handler.uriTemplate = gAngScope.BC.mailto_services[i].url_template;
											handlerInfoXPCOM.possibleApplicationHandlers.appendElement(handler, false);
											
											if (isActive) {
												// set it back to active

												handlerInfoXPCOM.preferredAction = Ci.nsIHandlerInfo.useHelperApp; //Ci.nsIHandlerInfo has keys: alwaysAsk:1, handleInternally:3, saveToDisk:0, useHelperApp:2, useSystemDefault:4
												handlerInfoXPCOM.preferredApplicationHandler = handler;
												handlerInfoXPCOM.alwaysAskBeforeHandling = false;
											}
											

											myServices.hs.store(handlerInfoXPCOM);
										// }
										
										break;
									}
								}
								// end - SIMILAR to block link68358151
							// start - copy block link980650
							} else if (gAngScope.BC.mailto_services[i].update_time == 0) { // i thought this through i think, im pretty :note: thats why i should never have any update_time as 0, as default is 0, meaning server doesnt know about it
								// its a custom handler that the server does not know about, mark it for submission

								gAngScope.BC.mailto_services[i].submit = 1;
								gAngScope.BC.mailto_services[i].update_time = 9; // so it doesnt keep resubmitting it on future page loads //note: 9 is special number, its to tell me that it was a "server unknown" and i already submited it to server
								signalForSubmission = true;
							}
							// end - copy block link980650
						}
						
						var callbackPostWrite;
						if (signalForSubmission) {

							callbackPostWrite = markPendingServerSubmit;
						}
					
						// any changes in finding and applying updates from server are written here
						// any changes in the going through marking for submission are written here
						writeCleanedObjToDisk(callbackPostWrite);
					} else {
						// go through to check if any handlers are installed, that server does not know about
						var signalForSubmission = false;
						for (var i=0; i<gAngScope.BC.mailto_services.length; i++) {
							// start - copy block link980650
							if (gAngScope.BC.mailto_services[i].update_time == 0) { // i thought this through i think, im pretty :note: thats why i should never have any update_time as 0, as default is 0, meaning server doesnt know about it
								// its a custom handler that the server does not know about, mark it for submission

								gAngScope.BC.mailto_services[i].submit = 1;
								gAngScope.BC.mailto_services[i].update_time = 9; // so it doesnt keep resubmitting it on future page loads //note: 9 is special number, its to tell me that it was a "server unknown" and i already submited it to server
								signalForSubmission = true;
							}
							// end - copy block link980650
						}
						
						var callbackPostWrite;
						if (signalForSubmission) {

							callbackPostWrite = markPendingServerSubmit;
						
							// any changes in the going through marking for submission are written here
							writeCleanedObjToDisk(callbackPostWrite);
						}
					}
				}			
				
			}
			gAngScope.$digest();
			// end - do stuff here - promise_fetchUpdates
		},
		function(aReason) {
			var rejObj = {name:'promise_fetchUpdates', aReason:aReason};

			gAngScope.BC.attn_msg = gAngInjector.get('$sce').trustAsHtml(myServices.sb.GetStringFromName('attn_server-down'));
			gAngScope.$digest();
			// deferred_createProfile.reject(rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_fetchUpdates', aCaught:aCaught};

			// deferred_createProfile.reject(rejObj);
		}
	);
}

function areUrlTemplatesOfSame(aUrlTemplate_1, aOldUrlTemplates_1, aUrlTemplate_2, aOldUrlTemplates_2) {
	// tests if handler 1 is same as handler 2 by checking url_template and old_url_templates
	
	// test if aUrlTemplate_1 is the same as aUrlTemplate_2
	if (aUrlTemplate_1 == aUrlTemplate_2) {
		return true;
	}
	
	// test if aUrlTemplate_1 is in aOldUrlTemplates_2
	if (aOldUrlTemplates_2.indexOf(aUrlTemplate_1) > -1) {
		return true;
	}
	
	// test if aUrlTemplate_2 is in aOldUrlTemplates_1
	if (aOldUrlTemplates_1.indexOf(aUrlTemplate_2) > -1) {
		return true;
	}
	
	// test if any of aOldUrlTemplates_1 are in aOldUrlTemplates_2 (this is same as doing reverse test of if any aOldUrlTemplates_2 are in aOldUrlTemplates_1)
	for (var l=0; l<aOldUrlTemplates_1.length; l++) {
		for (var m=0; m<aOldUrlTemplates_2.length; m++) {
			if (aOldUrlTemplates_1[l] == aOldUrlTemplates_2[m]) {
				return true;
			}
		}
	}
	
	return false;
}

function writeCleanedObjToDisk(aCallbackOnSuccess) {
	// goes through ANG_APP.mailto_services and removes keys that are not needed for the file
	// but before cleaning out these keys, it will first only take what is popular or installed for writing
	
	var arrOfPopOrInstalled = [];
	for (var i=0; i<gAngScope.BC.mailto_services.length; i++) {
		if (gAngScope.BC.mailto_services[i].group == 0 || gAngScope.BC.mailto_services[i].installed) {
			var pushObj = {};
			for (var p in mailtoServicesObjEntryTemplate) {
				pushObj[p] = gAngScope.BC.mailto_services[i][p];
			}
			if ('submit' in gAngScope.BC.mailto_services[i]) {
				pushObj.submit = gAngScope.BC.mailto_services[i].submit; // because submit is not a required key it is not in the mailtoServicesObjEntryTemplate so i check and add it in
			}
			arrOfPopOrInstalled.push(pushObj);
		}
	}

	var stringified = JSON.stringify(arrOfPopOrInstalled);
	
	var promise_overwrite = tryOsFile_ifDirsNoExistMakeThenRetry('writeAtomic', [OSPath_installedServices, String.fromCharCode(0xfeff) + stringified, {
		tmpPath: OSPath_installedServices + '.tmp',
		encoding: 'utf-16',
		noOverwrite: false
	}], OS.Constants.Path.profileDir);
	promise_overwrite.then(
		function(aVal) {

			// start - do stuff here - promise_overwrite
			if (aCallbackOnSuccess) {
				aCallbackOnSuccess();
			}
			// end - do stuff here - promise_overwrite
		},
		function(aReason) {
			var rejObj = {name:'promise_overwrite', aReason:aReason};

			// deferred_createProfile.reject(rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_overwrite', aCaught:aCaught};

			// deferred_createProfile.reject(rejObj);
		}
	);
}

const serverSubmitInterval = 5; // in minutes
const serverSubmitIntervalMS = serverSubmitInterval * 60 * 1000;
function markPendingServerSubmit() {
	/*
	tryOsFile_ifDirsNoExistMakeThenRetry('writeAtomic', [OSPath_pendingSubmit, new Uint8Array(), {
		noOverwrite: true
	}], OS.Constants.Path.profileDir);
	*/
	var cPrefVal;
	try {
		cPrefVal = Services.prefs.getCharPref(myPrefBranch + 'pending_submit');
	} catch(ex) {
		// pref probably doesnt exist
		cPrefVal = undefined;
	}
	if (cPrefVal === undefined) {

		Services.prefs.setCharPref(myPrefBranch + 'pending_submit', (new Date().getTime() - serverSubmitIntervalMS)); // note: this pref holds last time (in ms) tried, it will try every 5 minutes till submits
		// :todo: notify bootstrap checkIfShouldSubmit()
		contentMMFromContentWindow_Method2(window).sendAsyncMessage(core.addon.id, {aTopic:core.addon.id + '::' + 'notifyBootstrapThereIsPossibleServerSubmitPending'});
	} else {
		// else assume that its already running

	}
}

document.addEventListener('DOMContentLoaded', doOnLoad, false);
window.addEventListener('beforeunload', doOnBeforeUnload, false);

// start - common helper functions
var gCFMM;
function contentMMFromContentWindow_Method2(aContentWindow) {
	if (!gCFMM) {
		gCFMM = aContentWindow.QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIDocShell)
							  .QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIContentFrameMessageManager);
	}
	return gCFMM;

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

			deferred_read_encoded.reject(rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_readIt', aCaught:aCaught};

			deferred_read_encoded.reject(rejObj);
		}
	);
	
	return deferred_read_encoded.promise;
}
function makeDir_Bug934283(path, options) {
	// pre FF31, using the `from` option would not work, so this fixes that so users on FF 29 and 30 can still use my addon
	// the `from` option should be a string of a folder that you know exists for sure. then the dirs after that, in path will be created
	// for example: path should be: `OS.Path.join('C:', 'thisDirExistsForSure', 'may exist', 'may exist2')`, and `from` should be `OS.Path.join('C:', 'thisDirExistsForSure')`
	// options of like ignoreExisting is exercised on final dir
	
	if (!options || !('from' in options)) {

		throw new Error('you have no need to use this, as this is meant to allow creation from a folder that you know for sure exists, you must provide options arg and the from key');
	}

	if (path.toLowerCase().indexOf(options.from.toLowerCase()) == -1) {

		throw new Error('The `from` string was not found in `path` string');
	}

	var options_from = options.from;
	delete options.from;

	var dirsToMake = OS.Path.split(path).components.slice(OS.Path.split(options_from).components.length);


	var deferred_makeDir_Bug934283 = new Deferred();
	var promise_makeDir_Bug934283 = deferred_makeDir_Bug934283.promise;

	var pathExistsForCertain = options_from;
	var makeDirRecurse = function() {
		pathExistsForCertain = OS.Path.join(pathExistsForCertain, dirsToMake[0]);
		dirsToMake.splice(0, 1);
		var promise_makeDir = OS.File.makeDir(pathExistsForCertain, options);
		promise_makeDir.then(
			function(aVal) {

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

				deferred_makeDir_Bug934283.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_makeDir', aCaught:aCaught};

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

		var promise_retryAttempt = OS.File[nameOfOsFileFunc].apply(OS.File, argsOfOsFileFunc);
		promise_retryAttempt.then(
			function(aVal) {

				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.resolve('retryAttempt succeeded');
			},
			function(aReason) {
				var rejObj = {name:'promise_retryAttempt', aReason:aReason};

				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); //throw rejObj;
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_retryAttempt', aCaught:aCaught};

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

				retryIt();
			},
			function(aReason) {
				var rejObj = {name:'promise_makeDirsRecurse', aReason:aReason};

				/*
				if (aReason.becauseNoSuchFile) {

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

				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); // throw aCaught;
			}
		);
	};

	var doInitialAttempt = function() {
		var promise_initialAttempt = OS.File[nameOfOsFileFunc].apply(OS.File, argsOfOsFileFunc);

		promise_initialAttempt.then(
			function(aVal) {

				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.resolve('initialAttempt succeeded');
			},
			function(aReason) {
				var rejObj = {name:'promise_initialAttempt', aReason:aReason};

				if (aReason.becauseNoSuchFile) { // this is the flag that gets set to true if parent dir(s) dont exist, i saw this from experience

					makeDirs();
				} else {
					deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); //throw rejObj;
				}
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_initialAttempt', aCaught:aCaught};

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

				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_checkDirExistsFirstAsCausesNeutering', aCaught:aCaught};

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
		}

		xhr.send(aPostStr.join('&'));
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