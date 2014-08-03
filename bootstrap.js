const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
const self = {
	id: 'mailtowebmails',
	suffix: '@jetpack',
	path: 'chrome://mailtowebmails/content/',
	aData: 0,
};

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/devtools/Console.jsm');

//start pref stuff
//needs ES5, i dont know what min browser version of FF starts support for ES5
/**
 * if want to change value of preference dont do prefs.holdTime.value = blah, instead must do `prefs.holdTime.setval(500)`
 * because this will then properly set the pref on the branch then it will do the onChange properly with oldVal being correct
 * NOTE: this fucntion prefSetval is not to be used directly, its only here as a contructor
 */
function prefSetval(pref_name, branch_name) {
	return function(updateTo) {
		console.log('in prefSetval');
		console.info('this = ', this);
		if ('json' in this) {
			//updateTo must be an object
			if (Object.prototype.toString.call(updateTo) != '[object Object]') {
				console.warn('EXCEPTION: prefs[pref_name] is json but updateTo supplied is not an object');
				return;
			}
			
			var stringify = JSON.stringify(updateTo); //uneval(updateTo);
			if (this.type != Ci.nsIPrefBranch.PREF_STRING) {
				throw new Exception('json is set for pref_name of ' + prefName + ' but did not set proper type'); //just an exception though as i know to use setCharPref
			}
			myPrefListener.watchBranches[branch_name]._branchLive['setCharPref'](pref_name, stringify);
			//prefs[pref_name].value = {};
			//for (var p in updateTo) {
			//	prefs[pref_name].value[p] = updateTo[p];
			//}
		} else {
			//prefs[pref_name].value = updateTo;
			switch (this.type) {
				case Ci.nsIPrefBranch.PREF_STRING:
					var typeStr = 'Char'; break;
				case Ci.nsIPrefBranch.PREF_INT:
					var typeStr = 'Int'; break;
				case Ci.nsIPrefBranch.PREF_BOOL:
					var typeStr = 'Bool'; break;
				default:
					throw new Error('unrecognized pref.type');
			}
			myPrefListener.watchBranches[branch_name]._branchLive['set' + typeStr + 'Pref'](pref_name, updateTo);
		}
	};
}
///pref listener generic stuff NO NEED TO EDIT
/**
 * @constructor
 *
 * @param {string} branch_name
 * @param {Function} callback must have the following arguments:
 *   branch, pref_leaf_name
 */
function PrefListener() {
	//is an array
  // Keeping a reference to the observed preference branch or it will get garbage collected.
	Object.keys(this.watchBranches).forEach(function(branch_name) {
		this.watchBranches[branch_name]._branchLive = Services.prefs.getBranch(branch_name);
		this.watchBranches[branch_name]._branchDefault = Services.prefs.getDefaultBranch(branch_name);
		//this.watchBranches[branch_name]._branchLive.QueryInterface(Ci.nsIPrefBranch2); //do not need this anymore as i dont support FF3.x
	});
	this._callback = callback;
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
			//this onChange function is called for prefs not found in the the prefNames object. if the pref_name change exists in the prefNames object and it doesnt have an onChange, then no onChange is called for that. So again this unknownOnChange is only called for if pref_name does not exist in prefNames obj
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
PrefListener.prototype.register = function(setDefaults, trigger) {
	//adds the observer to all prefs and gives it the seval function
	
	Object.keys(this.watchBranches).forEach(function(branch_name) {
		//start - download prefs to this.watchBranches[branch_name].prefNames that are on this branch but not in this.watchBranches[branch_name].prefNames
		this.watchBranches[branch_name]._branchLive.getChildList('', {}).forEach(function(pref_name_on_branch) { //pref_name_on_branch is the name found on the branch in about:config (NOT the pref_name found in the prefNames object in the PrefListener.watchBranches object here
			//end - add setval to all pref_name's
			if (pref_name_on_branch in this.watchBranches[branch_name].prefNames) {
				//already in the prefNames object
				if ('default' in this.watchBranches[branch_name].prefNames[pref_name_on_branch]) {
					//default exists in the prefNames[prefname} object so it means its a created key
						console.log('will now set default on prefName:', pref_name_on_branch, 'in branch:', branch_name);
						this._defaultBranch['set' + prefs[p].type + 'Pref'](p, prefs[p].default);
						console.log('fined setting default on ', p);
					} else {
						console.log('this one does not have a default value so dont set a default. me as the addon dev is probably using this just as a hook to monitor changes, so probably monitorning default prefs');
					}
					this.watchBranches[branch_name][pref_name].setval = new prefSetval(pref_name); //added setval to all pref_name's
					//console.log('added setval');
					
					//if setDefaults == true then set its default
					
				} else {
					//start - block "A" copy
					this.watchBranches[branch_name].prefNames[pref_name_on_branch].NotOwned = true;
					this.watchBranches[branch_name].prefNames[pref_name_on_branch].type = this.watchBranches[branch_name]._branchLive.getPrefType(pref_name_on_branch);
					switch (this.watchBranches[branch_name].prefNames[pref_name_on_branch].type) {
						case Ci.nsIPrefBranch.PREF_STRING:
							var typeStr = 'Char'; break;
						case Ci.nsIPrefBranch.PREF_INT:
							var typeStr = 'Int'; break;
						case Ci.nsIPrefBranch.PREF_BOOL:
							var typeStr = 'Bool'; break;
						default:
							throw new Error('unrecognized pref.type');
					}
					this.watchBranches[branch_name].prefNames[pref_name_on_branch].default = this.watchBranches[branch_name]._branchDefault['get' + typeStr + 'Pref'](pref_name_on_branch); //note: im thinking it may be null if it has no default value, i need to test this out (note as of 080214 1025p)
					//end - block "A" copy
				}
			} else {
				//not in the prefNames object
				this.watchBranches[branch_name].prefNames[pref_name_on_branch] = {};
				//start - block "A" copy
				this.watchBranches[branch_name].prefNames[pref_name_on_branch].NotOwned = true;
				this.watchBranches[branch_name].prefNames[pref_name_on_branch].default = this.watchBranches[branch_name]._branchDefault.getPrefType(pref_name_on_branch); //note: im thinking it may be null if it has no default value, i need to test this out (note as of 080214 1025p)
				this.watchBranches[branch_name].prefNames[pref_name_on_branch].type = this.watchBranches[branch_name]._branchLive.getPrefType(pref_name_on_branch);
				//end - block "A" copy
			}
		});
		//end - download prefs that are on this branch but not in this.watchBranches[branch_name].prefNames
		
		/*
		Object.keys(this.watchBranches[branch_name].prefNames).forEach(function(pref_name) {
			
		});
		*/
	});
	
	for (var p in prefs) {
		prefs[p].setval = new prefSetval(p);
	}
	
	if (setDefaults) {
		this.setDefaults();
		console.log('finished set defaults');
	}
	
	//should add observer after setting defaults otherwise it triggers the callbacks
	this._branch.addObserver('', this, false);
	console.log('added observer');
	
	if (trigger) {
		console.log('trigger callbacks');
		this.forceCallbacks();
		console.log('finished all callbacks');
	}
};

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

PrefListener.prototype.unregister = function() {
  if (this._branch)
    this._branch.removeObserver('', this);
};

PrefListener.prototype._callback = function (branch, name) {
	//extensions.myextension[name] was changed
	console.log('pref_name:', name, 'changed in branch:', branch);
	console.log('callback start for pref: ', name);
	if (!(name in prefs)) {
		console.warn('name is not in prefs so return name = ', name);
		//added this because apparently some pref named prefPreix + '.sdk.console.logLevel' gets created when testing with builder
		//ALSO gets here if say upgraded, and in this version this pref is not used (same with downgraded)
		return;
	}

	var refObj = {name: name}; //passed to onPreChange and onChange
	var oldVal = 'json' in prefs[name] ? prefs[name].json : prefs[name].value;
	try {
		var newVal = myPrefListener._branch['get' + prefs[name].type + 'Pref'](name);
	} catch (ex) {
		console.warn('exception when getting newVal (likely the pref was removed): ' + ex);
		var newVal = null; //note: if ex thrown then pref was removed (likely probably)
	}
	console.log('oldVal == ', oldVal);
	console.log('newVal == ', newVal);
	if ('default' in prefs[name]) {
		prefs[name].value = newVal === null ? prefs[name].default : newVal; //when im setting up to be able to use this also for monitoring ff prefs (non my addon prefs) i wondered when can newVal == null? hm hm 8/2/14 825p
	} else {
		prefs[name].value = null;
	}

	if ('json' in prefs[name]) {
		refObj.oldValStr = oldVal;
		oldVal = JSON.parse(oldVal); //function(){ return eval('(' + oldVal + ')') }();

		refObj.newValStr = prefs[name].value;
		prefs[name].json = prefs[name].value;
		prefs[name].value =  JSON.parse(prefs[name].value); //function(){ return eval('(' + prefs[name].value + ')') }();
	}

	if (prefs[name].onChange) {
		prefs[name].onChange(oldVal, prefs[name].value, refObj);
	}
	console.log('myPrefCallback done');
};

var myPrefListener = new PrefListener();
////end pref listener stuff
//end pref stuff

function startup(aData, aReason) {
	self.aData = aData; //must go first, because functions in loadIntoWindow use self.aData

	console.log('myPrefListener=', myPrefListener);
	
	//start pref stuff more
	console.log('aReason=', aReason);
	//must forceCallbacks on startup, as the callbacks will read the inital prefs
	if ([ADDON_INSTALL,ADDON_UPGRADE,ADDON_DOWNGRADE].indexOf(aReason) > -1) {
		console.log('setting defaults logical if');
		myPrefListener.register(true, true); //true so it triggers the callback on registration, which sets value to current value //myPrefListener.setDefaults(); //in jetpack they get initialized somehow on install so no need for this	//on startup prefs must be initialized first thing, otherwise there is a chance that an added event listener gets called before settings are initalized
		//setDefaults safe to run after install too though because it wont change the current pref value if it is changed from the default.
		//good idea to always call setDefaults before register, especially if true for tirgger as if the prefs are not there the value in we are forcing it to use default value which is fine, but you know what i mean its not how i designed it, use of default is a backup plan for when something happens (like maybe pref removed)
	} else {
		myPrefListener.register(false, true); //true so it triggers the callback on registration, which sets value to current value
	}
	//end pref stuff more
	
	
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