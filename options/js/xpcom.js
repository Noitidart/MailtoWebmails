const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/FileUtils.jsm');
/* start - infoForWebmailHandlers.jsm */ 
var myServices = {};

XPCOMUtils.defineLazyGetter(myServices, 'eps', function(){ return Cc['@mozilla.org/uriloader/external-protocol-service;1'].getService(Ci.nsIExternalProtocolService) });
XPCOMUtils.defineLazyGetter(myServices, 'hs', function(){ return Cc['@mozilla.org/uriloader/handler-service;1'].getService(Ci.nsIHandlerService) });

const infoForWebmailHandlers = [
	{
		name: 'AIM Mail',
		uriTemplate: 'http://webmail.aol.com/Mail/ComposeMessage.aspx?to=%s', //chrome mailto ext uses: `http://mail.aol.com/33490-311/aim-6/en-us/mail/compose-message.aspx?to={to}&cc={cc}&bcc={bcc}&subject={subject}&body={body}`
		circleSelector: '.skills .css' //this is for me to target the proper row in the dom of the prefs frontend document.getElementById(circleId).parentNode.parentNode is the row element
	},
	{
		name: 'FastMail',
		uriTemplate: 'https://www.fastmail.com/action/compose/?mailto=%s',
		circleSelector: '.skills .fastmail'
	},
	{
		name: 'GMail',
		uriTemplate: 'https://mail.google.com/mail/?extsrc=mailto&url=%s', //chrome mailto ext uses: `https://mail.google.com/mail/?view=cm&tf=1&to={to}&cc={cc}&bcc={bcc}&su={subject}&body={body}`
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
		uriTemplate: 'https://mail.live.com/secure/start?action=compose&to=%s', //chrome mailto ext uses: `https://mail.live.com/default.aspx?rru=compose&to={to}&subject={subject}&body={body}&cc={cc}`
		circleSelector: '.skills .ps'
	},
	{
		name: 'QQMail',
		uriTemplate: 'http://www.mail.qq.com/cgi-bin/loginpage?delegate_url=%2Fcgi-bin%2Freadtemplate%3Ft%3Dcompose%26toemail%3D%s',
		circleSelector: '.skills .qq'
	},
	{
		name: 'Y! Mail',
		uriTemplate: 'https://compose.mail.yahoo.com/?To=%s', //chrome mailto ext uses: `http://compose.mail.yahoo.com/?To={to}&Cc={cc}&Bcc={bcc}&Subj={subject}&Body={body}`
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
const INSTALL_HANDLER = 0;
const UNINSTALL_HANDLER = 1;
const SET_HANDLER_ACTIVE = 2;
const SET_HANDLER_INACTIVE = 3;

var reInitTimeout;
var ds = null; //for aRDFObserver
/* start - aRDFObserver structure */
// is a nsIRDFObserver
var aRDFObserver = {
	onChange: function(aDataSource, aSource, aProperty, aOldTarget, aNewTarget) {
		if (aSource.ValueUTF8 == 'urn:scheme:handler:mailto') {
			console.log('mailto handler just changed');
			try {
				window.clearTimeout(reInitTimeout);
			} catch (ignore) {}
			reInitTimeout = window.setTimeout(function() {
				console.info('reiniting NOW');
				init();
			}, 500);
			//refresh my page
		}
	}
};
/* end - aRDFObserver structure */

function init() {
	//only on load should dontAddRdfObserver be !. so in all other times like "reiniting" must be true. as we dont want to add a 2nd+ rdf observer
	if (ds === null) {		
		var rdfs = Cc['@mozilla.org/rdf/rdf-service;1'].getService(Ci.nsIRDFService);
		var file = FileUtils.getFile('UMimTyp', []);
		var fileHandler = Services.io.getProtocolHandler('file').QueryInterface(Ci.nsIFileProtocolHandler);
		ds = rdfs.GetDataSourceBlocking(fileHandler.getURLSpecFromFile(file));
		ds.AddObserver(aRDFObserver);
	}
	var actToggles = document.querySelectorAll('a.act-toggle');
	Array.prototype.forEach.call(actToggles, function(actTog) {
		actTog.addEventListener('click', toggleToActive, false);
	});
	var stalls = document.querySelectorAll('a.stall-me');
	Array.prototype.forEach.call(stalls, function(stall) {
		stall.addEventListener('click', toggleStall, false);
	});
	
	//start - determine active handler
	var handlerInfo = myServices.eps.getProtocolHandlerInfo('mailto');
	console.log('hanlderInfo', handlerInfo);

	//end - determine active handler
	
	//start - find installed handlers
	var uriTemplates_of_installedHandlers = [];
	var handlers = handlerInfo.possibleApplicationHandlers.enumerate();
	while (handlers.hasMoreElements()) {
		var handler = handlers.getNext().QueryInterface(Ci.nsIWebHandlerApp);
		uriTemplates_of_installedHandlers.push(handler.uriTemplate);
	}
	console.info('uriTemplates_of_installedHandlers', uriTemplates_of_installedHandlers);
	//end - find installed handlers

	/*
	//can do this way but im merging into the `mark installed handlers as installed....` block
	//start - determine if there is a preferred web app handler
	//note: handlerInfo.preferredAction can be stale. if handlerInfo.alwaysAskBeforeHandling is set to true, than the prerredAction can be internally or whatev its not true it will always ask
	if (handlerInfo.preferredAction == Ci.nsIHandlerInfo.useHelperApp) { //Ci.nsIHandlerInfo has keys: alwaysAsk:1, handleInternally:3, saveToDisk:0, useHelperApp:2, useSystemDefault:4
		//it i shandled internally so it probably is a web app
		if (handlerInfo.preferredApplicationHandler.uriTemplate) { //if app handler is set to local app handler that is default, than preferredApplicationHandler is left at what it was before. can identify if preferredApplicationHandler is stale by testing if `handlerInfo.alwaysAskBeforeHandling == true` OR `handlerInfo.preferredAction != Ci.Ci.nsIHandlerInfo.handleInternally`
			var preferredHandlerUriTemplate = handlerInfo.preferredApplicationHandler.uriTemplate;
		}
	} else {
		//its not handled interntally and for a web app to be a handler for it IT HAS to be set to Ci.nsIHandlerInfo.handleInternally
	}
	//end - determine if there is a preferred web app handler
	*/
	//start - mark installed handlers as installed in dom AND the active handler as active in dom
	//now that i watch 3rd party, i have to also now mark uninstalled handlers and inactive handlers as such
	for (var i=0; i<infoForWebmailHandlers.length; i++) {
		var info = infoForWebmailHandlers[i];
		var thisRow = document.querySelector(info.circleSelector).parentNode.parentNode;
		var span5 = thisRow.querySelector('.span5');
		var thisTog = thisRow.querySelector('a.act-toggle');
		if (uriTemplates_of_installedHandlers.indexOf(info.uriTemplate) > -1) {
			//yes its installed
			console.log('is installed info: ', info);
			span5.classList.add('stalled');
			/*
			if (handlerInfo.preferredApplicationHandler.uriTemplate == info.uriTemplate) {
				var thisTog = thisRow.querySelector('a.act-toggle');
				thisTog.classList.add('active-me');
			}
			// cant do this way because if it used to be a web app handler (like y mail) and then they changed it to always ask (or a local app handler), the preferredApplicationHandler is left as it what it was last time. so it will be y mail even though it is at always ask (or local app handler)
			*/
			if (!handlerInfo.alwaysAskBeforeHandling && handlerInfo.preferredAction == Ci.nsIHandlerInfo.useHelperApp && handlerInfo.preferredApplicationHandler instanceof Ci.nsIWebHandlerApp && handlerInfo.preferredApplicationHandler.uriTemplate == info.uriTemplate) { //checking instanceof to make sure its not null or something with no uriTemplate
				thisTog.classList.add('active-me');
			} else {
				thisTog.classList.remove('active-me');
			}
		} else {
			span5.classList.remove('stalled');
			thisTog.classList.remove('active-me');
		}
	}
	//end - mark installed handlers as installed in dom
}

function toggleStall(e) {
	//check if active then make it inactive if unisntalled
	
	var thisStall = e.target;
	if (thisStall.nodeName == 'I') {
		thisStall = thisStall.parentNode;
	}
	
	var thisToggle = thisStall.parentNode.querySelector('a.act-toggle');
	
	var thisRow = thisToggle.parentNode.parentNode.parentNode;
	var thisCircle = thisRow.querySelector('.span3 div');
	var circleClass = thisCircle.getAttribute('class');
	
	if (thisToggle.classList.contains('active-me')) {
		//Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'MailtoWebmails - Exception', 'Cannot uninstall this handler because it is currently set as the active mailto handler');
		var res = Services.prompt.confirm(Services.wm.getMostRecentWindow('navigator:browser'), 'MailtoWebmails - Enable "Always Ask"', 'This handler is currently set as the "Active" handler. If you uninstall this handler it will be made "Inactive" and will enable the "Always Ask" setting. Which means on all future clicks on "mailto:" links, Firefox will ask you which of the installed handlers you want to open the link with.');
		if (res) {
			if (circleAct(circleClass, UNINSTALL_HANDLER)) {
				thisToggle.classList.remove('active-me');
				thisStall.parentNode.classList.toggle('stalled');
				return true;
			} else {
				Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'MailtoWebmails - Error', 'Action failed, something went wrong, try looking in browser console');
				return false;
			}
		} else {
			return false;
		}
	}
	
	if (thisStall.parentNode.classList.contains('stalled')) {
		//uninstall
		var doact = UNINSTALL_HANDLER;
	} else {
		//install
		var doact = INSTALL_HANDLER;
	}
	
	if (circleAct(circleClass, doact)) {
		thisStall.parentNode.classList.toggle('stalled');
		return true;
	} else {
		Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'MailtoWebmails - Error', 'Action failed, something went wrong, try looking in browser console');
		return false;
	}
}

function toggleToActive(e) {
	var thisToggle = e.target;
	if (thisToggle.nodeName == 'I') {
		thisToggle = thisToggle.parentNode;
	}
	var thisRow = thisToggle.parentNode.parentNode.parentNode;
	var thisCircle = thisRow.querySelector('.span3 div');
	var circleClass = thisCircle.getAttribute('class');
	
	if (thisToggle.classList.contains('active-me')) {
		//this toggler clicked is active so forget it, exit
		//setting it to inactive. user wants it to always ask
		var res = Services.prompt.confirm(Services.wm.getMostRecentWindow('navigator:browser'), 'MailtoWebmails - Enable "Always Ask"', 'Are you sure want to set the only "Active" handler to "Inactive"? This will enable the "Always Ask" setting. Which means on all future clicks on "mailto:" links, Firefox will ask you which of the installed handlers you want to open the link with.');
		if (res) {					
			if (circleAct(circleClass, SET_HANDLER_INACTIVE)) {
				thisToggle.classList.remove('active-me');
				return true;
			} else {
				Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'MailtoWebmails - Error', 'Action failed, something went wrong, try looking in browser console');
				return false;
			}
		} else {
			return false;
		}
	}
	
	var thisStallParent = thisToggle.parentNode.parentNode;
	if (!thisStallParent.classList.contains('stalled')) {
		Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'MailtoWebmails - Exception', 'Cannot set this handler to active as it is not installed');
		//nevermind comment to right, because sometimes these inactive buttons are clickable, they are expecting it to do something, so do notify them that it cannot set to active as its not installed //not prompting anymore because i made the css so on hover its not a click pointer so its not "clickable" so it should do nothing. so in other words: if the button is not pointer on hover, then on click user should not expect something.
		return false;
	}
	
	if (circleAct(circleClass, SET_HANDLER_ACTIVE)) {
		var curActive = document.querySelector('a.active-me');
		if (curActive) {
			curActive.classList.remove('active-me');
		}
		thisToggle.classList.add('active-me');
		return true;
	} else {
		Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'MailtoWebmails - Error', 'Action failed, something went wrong, try looking in browser console');
		return false;
	}
}

function circleAct(circleClass, act) {
	//selector should be text to select the circle
	//act: 0-install, 1-uninstall, 2-active, 3-inactive
	
	
	
	for (var i=0; i<infoForWebmailHandlers.length; i++) {
		var info = infoForWebmailHandlers[i];
		if (info.circleSelector == '.skills .' + circleClass) {
			break;
		}
		if (i == infoForWebmailHandlers.length) {
			throw new Error('could not find circleClass in infoForWebmailHandlers, circleClass = "' + circleClass + '"'); //this is dev error so throw rather than prompt
			return false; //wont get here as throw just quits all but just formality
		}
	}
	
	if (act != INSTALL_HANDLER) {
		var handlerInfo = myServices.eps.getProtocolHandlerInfo('mailto');
		var handlers = handlerInfo.possibleApplicationHandlers;
	}
	console.info('removed aRDFObserver so can do circleAct without observer thinking its 3rd party');
	ds.RemoveObserver(aRDFObserver);
	try {
		switch (act) {
			case INSTALL_HANDLER:
				var protocol = 'mailto';
				var name = info.name;
				var myURISpec = info.uriTemplate;

				var handler = Cc['@mozilla.org/uriloader/web-handler-app;1'	].createInstance(Ci.nsIWebHandlerApp);
				handler.name = info.name;
				handler.uriTemplate = info.uriTemplate;

				var handlerInfo = myServices.eps.getProtocolHandlerInfo('mailto');
				handlerInfo.possibleApplicationHandlers.appendElement(handler, false);

				myServices.hs.store(handlerInfo);
				break;
				
			case UNINSTALL_HANDLER:
				for (var i = 0; i < handlers.length; i++) {
					var handler = handlers.queryElementAt(i, Ci.nsIWebHandlerApp);

					if (handler.uriTemplate == info.uriTemplate) {
						if (handlerInfo.preferredApplicationHandler instanceof Ci.nsIWebHandlerApp && handler.equals(handlerInfo.preferredApplicationHandler)) { //have to check instnaceof because it may be that preferredApplicationHandler is `null`, must do this because if its `null` then `handler.equals(handlerInfo.preferredApplicationHandler)` throws `NS_ERROR_ILLEGAL_VALUE: Illegal value'Illegal value' when calling method: [nsIWebHandlerApp::equals]`

							//if the last preferredApplicationHandler was this then nullify it, just me trying to keep things not stale
							handlerInfo.preferredApplicationHandler = null;
							if (handlerInfo.preferredAction == Ci.nsIHandlerInfo.useHelperApp) {
								//it looks like the preferredAction was to use this helper app, so now that its no longer there we will have to ask what the user wants to do next time the uesrs clicks a mailto: link
								handlerInfo.alwaysAskBeforeHandling = true;
								handlerInfo.preferredAction = Ci.nsIHandlerInfo.alwaysAsk; //this doesnt really do anything but its just nice to be not stale. it doesnt do anything because firefox checks handlerInfo.alwaysAskBeforeHandling to decide if it should ask. so me doing this is just formality to be looking nice
							}
						}
						handlers.removeElementAt(i);
						i--;
					}
					myServices.hs.store(handlerInfo);
				}
				break;
				
			case SET_HANDLER_ACTIVE:
				var foundHandler = false;
				handlers = handlers.enumerate();
				while (handlers.hasMoreElements()) {
					var handler = handlers.getNext();
					if (handler.QueryInterface(Ci.nsIWebHandlerApp).uriTemplate == info.uriTemplate) { //this is how i decided to indentify if the handler, by uriTemplate
						foundHandler = true;
						break;
					}
				}

				if (foundHandler) {
					//it was found. and in the while loop when i found it, i "break"ed out of the loop which left handlerInfo set at the yahoo mail handler
					//set this to the prefered handler as this handler is the y! mail handler
					handlerInfo.preferredAction = Ci.nsIHandlerInfo.useHelperApp; //Ci.nsIHandlerInfo has keys: alwaysAsk:1, handleInternally:3, saveToDisk:0, useHelperApp:2, useSystemDefault:4
					handlerInfo.preferredApplicationHandler = handler;
					handlerInfo.alwaysAskBeforeHandling = false;
					myServices.hs.store(handlerInfo);
				} else {
					throw new Error('could not find yahoo mail handler. meaning i couldnt find a handler with uriTemplate of ...compose.mail.yahoo.... info = ' + uneval(info));
				}
				break;
				
			case SET_HANDLER_INACTIVE:
				handlerInfo.preferredAction = Ci.nsIHandlerInfo.alwaysAsk; //Ci.nsIHandlerInfo has keys: alwaysAsk:1, handleInternally:3, saveToDisk:0, useHelperApp:2, useSystemDefault:4
				handlerInfo.preferredApplicationHandler = null;
				handlerInfo.alwaysAskBeforeHandling = true;
				myServices.hs.store(handlerInfo);
				break;
				
			default:
				throw new Error('invalid act supplied, making this error rather than prompt because this is a dev error');
		}
	} catch(ex) {
		throw(ex);
	} finally {
		//this finally block will run even though we throw in the catch block. see: https://gist.github.com/Noitidart/abeb5dc331dc322372e8
		console.info('added aRDFObserver back');
		ds.AddObserver(aRDFObserver);
	}
	return true; //will not return true even though the finally block runs if an error is thrown in catch
}

function personal_img(target) {
	var fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
	fp.init(Services.wm.getMostRecentWindow(null), 'Image Selection', Ci.nsIFilePicker.modeOpen);
	fp.appendFilters(Ci.nsIFilePicker.filterImages);

	var rv = fp.show();
	if (rv == Ci.nsIFilePicker.returnOK) {
		//console.log('fp.file:', fp.file);
		target.style.backgroundImage = 'url(' + Services.io.newFileURI(fp.file).spec + ')';
		target.classList.remove('no-custom-bg');
	}// else { // cancelled	}
}

function toggleTip(trueForForceShow_falseForForceHide) {
	var tip = document.getElementById('tip');
	if (trueForForceShow_falseForForceHide === true) {
		tip.style.opacity = 1;
		tip.style.marginLeft = '-25px';
	} else if (trueForForceShow_falseForForceHide === false) {
		tip.style.opacity = 0;
		tip.style.marginLeft = '-75px';
	} else {
		// toggle
		if (tip.style.opacity == 1) {
			tip.style.opacity = 0;
			tip.style.marginLeft = '-75px';
		} else {
			tip.style.opacity = 1;
			tip.style.marginLeft = '-25px';
		}
	}
}

document.addEventListener('DOMContentLoaded', init, false);

window.addEventListener('unload', function() {
	ds.RemoveObserver(aRDFObserver);
	console.log('unloaded pref page so observer removed');
}, false);