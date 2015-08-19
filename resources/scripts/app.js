var mailto_services = [
	/*
	{
		handler_id:
		name:
		url_template:
		description:
		icon_dataurl:
		icon_imugr_url:
		color:
		group: 0 for popular, 1, for personal/discovered/custom/social, 2 for native like outlook
		update_time:
		installed: bool // user based field all others are from server
		active: bool // user based field all others are from server
	}
	*/
	{
		handler_id: 1,
		name: 'gmail',
		url_template: 'http://www.google.com/%s',
		description: 'googles',
		icon_dataurl: '65412',
		icon_imugr_url: null,
		color: 'red',
		group: 0,
		update_time: 0,
		installed: true,
		active: true
	},
	{
		handler_id: 2,
		name: 'hotmail',
		url_template: 'http://www.hotmail.com/%s',
		description: 'microsofts',
		icon_dataurl: '65412',
		icon_imugr_url: null,
		color: 'red',
		group: 1,
		update_time: 0,
		installed: true,
		active: false
	},
];

var ANG_APP = angular.module('mailtowebmails', [])
	.directive('row', [function() {
		return {
			restrict: 'E',
			templateUrl: 'chrome://mailtowebmails/content/resources/directives/row.htm'
		};
	}])
    .controller('BodyController', ['$scope', '$sce', function($scope, $sce) {

		$scope.trustSrc = function(src) {
			return $sce.trustAsResourceUrl(src);
		};
		
        var MODULE = this;
		
        MODULE.mailto_services = mailto_services;
		
		MODULE.toggle_active = function(aServiceId) {
			
		};

		MODULE.toggle_install = function(aServiceId) {
			// on uninstall, if it is discovered/custom/social/presonal
		};
		
		MODULE.edit = function(aServiceId) {
			
		};
		
		MODULE.add = function() {
			
		};

        MODULE.info = function() {
            console.info(MODULE.mailto_services);
        };

		MODULE.info();
    }]);