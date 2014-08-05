const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
const self = {
	id: 'mailtowebmails',
	suffix: '@jetpack',
	path: 'chrome://mailtowebmails/content/',
	aData: 0
};

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/devtools/Console.jsm');
Cu.import(self.path + 'modules/infoForWebmailHandlers.jsm');

//start pref stuff
//needs ES5, i dont know what min browser version of FF starts support for ES5
/**
 * if want to change value of preference dont do prefs.holdTime.value = blah, instead must do `prefs.holdTime.setval(500)`
 * because this will then properly set the pref on the branch then it will do the onChange properly with oldVal being correct
 * NOTE: this fucntion prefSetval is not to be used directly, its only here as a contructor
 */
PrefListener.prototype.prefSetval = function(pref_name, branch_name) {
	return function(updateTo) {
		console.log('in prefSetval');
		var that = this.watchBranches[branch_name].prefNames;
		if ('json' in that) {
			//updateTo must be an object
			if (Object.prototype.toString.call(updateTo) != '[object Object]') {
				console.warn('EXCEPTION: prefs[pref_name] is json but updateTo supplied is not an object');
				return;
			}
			
			var stringify = JSON.stringify(updateTo); //uneval(updateTo);
			if (that.type != Ci.nsIPrefBranch.PREF_STRING) {
				throw new Exception('json is set for pref_name of ' + pref_name + ' but did not set proper type'); //just an exception though as i know to use setCharPref
			}
			this.watchBranches[branch_name]._branchLive['setCharPref'](pref_name, stringify);
			//prefs[pref_name].value = {};
			//for (var p in updateTo) {
			//	prefs[pref_name].value[p] = updateTo[p];
			//}
		} else {
			//prefs[pref_name].value = updateTo;
			this.watchBranches[branch_name]._branchLive['set' + typeStr_from_typeLong(that.type) + 'Pref'](pref_name, updateTo);
		}
	};
}
function typeStr_from_typeLong(typeLong) {
	switch (typeLong) {
		case Ci.nsIPrefBranch.PREF_STRING:
			return 'Char';
		case Ci.nsIPrefBranch.PREF_INT:
			return 'Int';
		case Ci.nsIPrefBranch.PREF_BOOL:
			return 'Bool';
		default:
			throw new Error('unrecognized pref.type');
	}
}
///pref listener generic stuff NO NEED TO EDIT
/**
 * @constructor
 *
 * @param {string} branch_name
 * @param {Function} callback must have the following arguments:
 *   branch, pref_leaf_name
 */
 //note: a weakness with this api i made for prefs, is that, if upgrading/downgrading and in installing rev a pref is no longer in use, the old pref will stay in the about:config system. prefs are only deleted when addon is uninstalled note: as of 080314 though i think i have a solution for this, watch the info/warn dump and if it holds true than edit it in
 //note: good thing about this overhaul of the pref skeleton is that i can have this skeleton pasted in, and if no prefs being watched it doesnt do anything funky
function PrefListener() {
	//is an array
  // Keeping a reference to the observed preference branch or it will get garbage collected.
	Object.keys(this.watchBranches).forEach(function(branch_name) {
		this.watchBranches[branch_name]._branchLive = Services.prefs.getBranch(branch_name);
		this.watchBranches[branch_name]._branchDefault = Services.prefs.getDefaultBranch(branch_name);
		//this.watchBranches[branch_name]._branchLive.QueryInterface(Ci.nsIPrefBranch2); //do not need this anymore as i dont support FF3.x
	});
}

PrefListener.prototype.watchBranches = {
	/*
	// start - demo
	'branch.name': { //for own branch set this key to `'extensions.' + self.id + '.'` for others branch like set to `'gecko.handlerService.schemes.mailto'`
		prefNames: { //this is an object of the prefs that i add into this branch, meaning i set the defaults on them. my prefs meaning that they belong to this addon and should be removed when this addon is uninstalled
			//each key here must match the exact name the pref is saved in the about:config database (without the prefix)
			//note: if i include a default key on the pref then it is a pref that i make on this branch
			someNameOfPref: { //this pref gets created if not found in this branch in about:config, a defaultBranch value is set for it too, this pref is also deleted on uninstall of the addon. createdPrefs are denoted by supplying a `default` and `type` key
				default: 300,
				value: null,
				type: Ci.nsIPrefBranch.PREF_STRING, //should call thi skey typeLong but whatever //Ci.nsIPrefBranch.PREF_BOOL or Ci.nsIPrefBranch.PREF_STRING or Ci.nsIPrefBranch.PREF_INT
				//json: null, //if want to use json type must be string
				//onChange: function(oldVal, newVal, refObj) { } //on change means on change of the object prefs.blah.value within. NOT on change of the pref in about:config. likewise onPreChange means before chanigng the perfs.blah.value, this is because if users changes pref from about:config, newVal is always obtained by doing a getIntVal etc //refObj holds
			},
			someOtherNameOfPref: { //this object for this key of notMyCreatedPref does not have a 'default' key or 'type' key so it will not be deleted on uninstall of this addon. also it will get populated by prefListener register funciton
				//on register, this pref_name will get marked with key of `NotOwned:true` indicating that it was not a "created pref by this addon" so meaning not owned by this addon
				value: null
				onChange: function(oldVal, newVal, refObj) {} //this onChange function gets executed when `notMyCreatedPref` changes
			}
		},
		unknownNameOnChange: function(oldVal, newVal, refObj) {
			//this onChange function is called for prefs not found in the the prefNames object. if the pref_name change exists in the prefNames object and it doesnt have an onChange, then no onChange is called for that. So again this unknownNameOnChange is only called for if pref_name does not exist in prefNames obj
		}
	},
	'gecko.handlerService.schemes.mailto': {
		
	}
	// end - demo 
	*/
	
	/* start - edit in here */
	
	/* end - edit in here */
}

PrefListener.prototype.observe = function(subject, topic, data) {
	console.log('incomcing PrefListener observe', 'topic=', topic, 'data=', data, 'subject=', subject);
	if (topic == 'nsPref:changed')
		this._callback(this._branch, data);
};

/**
 * @param {boolean=} trigger if true triggers the registered function
 *   on registration, that is, when this method is called.
 */
PrefListener.prototype.register = function(setDefaults, trigger, aReasonStartup) {
	//aReasonStartup was introduced as a debug param. i already only to setDefaults to true when install,up, down but i want for debug. i can know if the startup reason for the addon was install, upgrade, or downgrade, useful for setDefaults
	//i cant think of a situation when i should call register with trigger as false. trigger is responsible for updating value in object to value of pref in about:config
	//adds the observer to all prefs and gives it the seval function
	
	Object.keys(this.watchBranches).forEach(function(branch_name) {
		//start - download prefs to this.watchBranches[branch_name].prefNames that are on this branch but not in this.watchBranches[branch_name].prefNames
		//this loop goes through ONLY the pref_name_on_branch which is the preferences on the branch BEFORE i created my owned prefs. however if this is not install, then owned prefs will also be found on the pref_name_on_branch
		this.watchBranches[branch_name]._branchLive.getChildList('', {}).forEach(function(pref_name_on_branch) { //pref_name_on_branch is the name found on the branch in about:config (NOT the pref_name found in the prefNames object in the PrefListener.watchBranches object here
			if (pref_name_on_branch in this.watchBranches[branch_name].prefNames) {
				//pref_name_on_branch already exists in prefNames object
				this.watchBranches[branch_name].prefNames[pref_name].setval = new this.prefSetval(pref_name, branch_name); //added setval to all pref_name's
				if ('default' in this.watchBranches[branch_name].prefNames[pref_name_on_branch]) {
					this.watchBranches[branch_name].prefNames[pref_name_on_branch].MayNotNeedToSetDefaultEvenIfSetDefaultsIsTrue = true;
					//actually if just startup, and not install startup, it can get here
					console.warn('this MUST not be startup aReason == install', 'code should ONLY get here on a startup that is not install, because the whole point here is to download the the prefs that exist on this branch but are not in the this.watchBranches[branch_name] object AND if i had set `default` key on it than it indicates that this addon owns it');
					//default exists in the prefNames[pref_name] object so it means its a created key (its a pref_name owned by this addon)
				} else {
					//start - block "A" copy
					this.watchBranches[branch_name].prefNames[pref_name_on_branch].NotOwned = true;
					var typeLong = this.watchBranches[branch_name]._branchLive.getPrefType(pref_name_on_branch);
					this.watchBranches[branch_name].prefNames[pref_name_on_branch].type = typeLong;
					this.watchBranches[branch_name].prefNames[pref_name_on_branch].default = this.watchBranches[branch_name]._branchDefault['get' + typeStrtypeStr_from_typeLong(typeLong) + 'Pref'](pref_name_on_branch); //note: im thinking it may be null if it has no default value, i need to test this out (note as of 080214 1025p)
					//end - block "A" copy
				}
			} else {
				//not in the prefNames object
				this.watchBranches[branch_name].prefNames[pref_name_on_branch] = {};
				this.watchBranches[branch_name].prefNames[pref_name].setval = new this.prefSetval(pref_name, branch_name); //added setval to all pref_name's
				//start - block "A" copy
				this.watchBranches[branch_name].prefNames[pref_name_on_branch].NotOwned = true;
				var typeLong = this.watchBranches[branch_name]._branchLive.getPrefType(pref_name_on_branch);
				this.watchBranches[branch_name].prefNames[pref_name_on_branch].type = typeLong;
				this.watchBranches[branch_name].prefNames[pref_name_on_branch].default = this.watchBranches[branch_name]._branchDefault['get' + typeStrtypeStr_from_typeLong(typeLong) + 'Pref'](pref_name_on_branch); //note: im thinking it may be null if it has no default value, i need to test this out (note as of 080214 1025p)
				//end - block "A" copy
			}
		});
		//end - download prefs that are on this branch but not in this.watchBranches[branch_name].prefNames
		
		
		//start - go through all Owned prefNames on this branch, do what u need to do with them
		Object.keys(this.watchBranches[branch_name].prefNames).forEach(function(pref_name) { //note: so everywhere i use, pref_name is from the prefNames obj and pref_name_on_branch is from the childList of a branch
			if (!this.watchBranches[branch_name].prefNames[pref_name].NotOwned) {
				//its Owned
				if (setDefaults) {
					if (this.watchBranches[branch_name].prefNames[pref_name].MayNotNeedToSetDefaultEvenIfSetDefaultsIsTrue) {
						console.warn('aReasonStartup:', aReasonStartup, 'code can get here, you are probably running setDefauls at true when startup is not install, upgrade, or downgrade');
						//no longer skipping if MayNotNeedToSetDefaultEvenIfSetDefaultsIsTrue is set/true, as i found that in the startup proc i only do setDefaults if aReason is install,upgrade, or downgrade, but his was the message here and i modded the if else here: console.info('setDefaults is true HOWEVER, this pref was already found on the childList of the branch, so that obviously means the initial creation was done, and its owned by my addon so meaning it HAD HAD HAD to be created by my addon, and on install of my addon i do the set default SO NOT SETTING DEFAULT ON pref_name:', pref_name, 'branch_name:', branch_name);
					}
					console.info('setDefaults is true so will now set default on pref_name:', pref_name, 'in branch:', branch_name);
					this.watchBranches[branch_name]._defaultBranch['set' + typeStr_from_typeLong(this.watchBranches[branch_name].prefNames[pref_name].type) + 'Pref'](pref_name, this.watchBranches[branch_name].prefNames[pref_name].default);
					console.log('finished setting default on pref_name:', pref_name, 'on branch:', branch_name);
				}
				if (trigger) {
					console.log('trigger callback for pref_name:', pref_name, 'on branch_name:', branch_name);
					this._callback(branch_name, pref_name)
					console.log('DONE triggering callback for pref_name:', pref_name, 'on branch_name:', branch_name);
				}
			} else {
				//its NotOwned so do nothing
				//actually lets test if trigger is true and if it is than trigger it
				if (trigger) {
					console.log('trigger callback for pref_name:', pref_name, 'on branch_name:', branch_name);
					this._callback(branch_name, pref_name)
					console.log('DONE triggering callback for pref_name:', pref_name, 'on branch_name:', branch_name);
				}
			}
		});		
		//end - go through all Owned prefNames on this branch, do what u need to do with them
		
		//should add observer after setting defaults otherwise it triggers the callbacks. this comment is old and i have not verified this as of 080314 1236a
		this.watchBranches[branch_name]._branchLive.addObserver('', this, false);
		console.log('added observer to branch_name', branch_name);
		
	});
};

/*
PrefListener.prototype.forceCallbacks = function() {
	//this forces callback on all prefs in all branches in this.watchBranches
	//this is needed so it can download all prefs on branches and it can set the .value in the object here to be the value of the pref in about:config
	//can tell in onChange function if it was a forced callback by checking of oldValue === null
	console.log('forcing pref callbacks');
    let that = this;
    this._branch.getChildList('', {}).
      forEach(function (pref_leaf_name)
        { that._callback(that._branch, pref_leaf_name); });
};

PrefListener.prototype.setDefaults = function() {
	//sets defaults on the prefs in prefs obj
	console.log('doing setDefaults');
	for (var p in prefs) {
		if ('defualt' in prefs[p]) {
			console.log('will now set default on ', p);
			this._defaultBranch['set' + prefs[p].type + 'Pref'](p, prefs[p].default);
			console.log('fined setting default on ', p);
		} else {
			console.log('this one does not have a default value so dont set a default. me as the addon dev is probably using this just as a hook to monitor changes, so probably monitorning default prefs');
		}
	}
	console.log('set defaults done');
};
*/

PrefListener.prototype.unregister = function() {
  if (this._branch)
    this._branch.removeObserver('', this);
};

PrefListener.prototype._callback = function (branch_name, pref_name) {
	//extensions.myextension[name] was changed
	console.log('pref_name:', pref_name, 'changed in branch:', branch_name);
	console.log('callback start for pref: ', pref_name);
	
	if (!(branch_name in this.watchBranches)) {
		console.warn('branch_name is not in this.watchBranches. branch_name:', branch_name);
	}
	if (!(pref_name in this.watchBranches[branch_name].prefNames)) {
		console.warn('branch_name is not in this.watchBranches. branch_name:', branch_name);
		//added this because apparently some pref named prefPreix + '.sdk.console.logLevel' gets created when testing with builder
		//ALSO gets here if say upgraded, and in this version this pref is not used (same with downgraded)
		console.warn('exiting/return_false callback. is it safe to delete here? observer this warning and update this api to delete this here because it gets here if say upgraded, and in this version this pref is not used (same with downgraded)');
		return false;
	}
	
	var thatBranch = this.watchBranches[branch_name];  //just short cuts so i dont have to type this crap out everytime
	var thatPref = this.watchBranches[branch_name].prefNames[pref_name]; //just short cuts so i dont have to type this crap out everytime
	
	var refObj = {pref_name: pref_name, branch_name: branch_name}; //passed to onPreChange and onChange
	var oldVal = 'json' in thatPref ? thatPref.json : thatPref.value; //note: so if json than i access it like prefName.blah.value[JSON KEY HERE]
	try {
		var newVal = thatBranch._branchLive['get' + typeStr_from_typeLong(thatPref.type) + 'Pref'](pref_name);
	} catch (ex) {
		console.warn('exception when getting newVal (maybe (untested so unknown so i say maybe) the pref was removed): ' + ex);
		var newVal = null; //note: if ex thrown then pref was removed (likely probably maybe)
	}
	console.log('oldVal == ', oldVal);
	console.log('newVal == ', newVal);
	if (!('default' in thatPref)) {
		throw new Error('in callback for pref_name of ' + pref_name + ' on branch of brnach_name ' + branch_name + ' but there is no key of `default`');
	}
	thatPref.value = newVal === null ? thatPref.default : newVal; //when im setting up to be able to use this also for monitoring ff prefs (non my addon prefs) i wondered when can newVal == null? hm hm 8/2/14 825p

	if ('json' in thatPref) {
		refObj.oldValStr = oldVal;
		oldVal = JSON.parse(oldVal); //function(){ return eval('(' + oldVal + ')') }();

		refObj.newValStr = thatPref.value;
		thatPref.json = thatPref.value;
		thatPref.value =  JSON.parse(thatPref.value); //function(){ return eval('(' + prefs[name].value + ')') }();
	}

	if (thatPref.onChange) {
		thatPref.onChange(oldVal, thatPref.value, refObj);
	} else if (thatPref.NotOwned && thatBranch.unknownNameOnChange) {
		thatBranch.unknownNameOnChange(oldVal, thatPref.value, refObj);
	}
	console.log('myPrefCallback done');
	//note: i remember why i got rid of onPreChange. because in onChange it happend that i needed the old value a lot of the times for comparison. so then i started passing the oldValue to onChange. So now I can do whatever i need to do in onChange by using oldValue
};
////end pref listener stuff
//end pref stuff

function startup(aData, aReason) {
	self.aData = aData; //must go first, because functions in loadIntoWindow use self.aData

	console.log('aReason=', aReason);
	
	//start pref stuff more
	var myPrefListener = new PrefListener();
	console.log('myPrefListener=', myPrefListener);
	//must forceCallbacks on startup, as the callbacks will read the inital prefs
	if ([ADDON_INSTALL, ADDON_UPGRADE, ADDON_DOWNGRADE].indexOf(aReason) > -1) {
		console.log('setting defaults logical if');
		myPrefListener.register(true, true, aReason); //true so it triggers the callback on registration, which sets value to current value //myPrefListener.setDefaults(); //in jetpack they get initialized somehow on install so no need for this	//on startup prefs must be initialized first thing, otherwise there is a chance that an added event listener gets called before settings are initalized
		//setDefaults safe to run after install too though because it wont change the current pref value if it is changed from the default.
		//good idea to always call setDefaults before register, especially if true for tirgger as if the prefs are not there the value in we are forcing it to use default value which is fine, but you know what i mean its not how i designed it, use of default is a backup plan for when something happens (like maybe pref removed)
	} else {
		myPrefListener.register(false, true, aReason); //true so it triggers the callback on registration, which sets value to current value
	}
	//end pref stuff more
	
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
	
	//start pref stuff more
	myPrefListener.unregister();
	//end pref stuff more
}

function install() {}

function uninstall() {}