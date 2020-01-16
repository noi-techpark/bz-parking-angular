var parking= angular.module('parking', ['leaflet-directive','angular-chartist']);
var endpoint = 'https://mobility.api.opendatahub.bz.it/v2/api/flat/ParkingStation/';
var geoserver_parking = 'https://ipchannels.integreen-life.bz.it/geoserver/edi/ows';
parking.config(function ($sceDelegateProvider,) {
	$sceDelegateProvider.resourceUrlWhitelist([
		'self',                    // trust all resources from the same origin
		'*://mobility.api.opendatahub.bz.it/**',
        '*://ipchannels.integreen-life.bz.it/**',
	]);
});
parking.run(function($rootScope){
	var lang = navigator.language || navigator.userLanguage;
	$rootScope.lang = lang.split('-')[0];
	$rootScope.i18n = i18n;
	moment.locale($rootScope.lang);
	$rootScope.moment=moment;
	if (!$rootScope.i18n[$rootScope.lang])
	lang = 'en';
	$rootScope.$watch('lang',function(newLocale){
		if (newLocale)
		moment.locale(newLocale);
	});

});
parking.controller('parking',function($scope,$http,$interval,$window,leafletData,$filter,$q){
	var self = $scope;
	function startApp(position){
		self.currentPosition = position;
		self.getData(self.getAllPredictions);
	};
	function startAppWithoutLocation(){
		self.getData(self.getAllPredictions);
	}
	self.conditionalSorting = function(obj){
		if (self.currentPosition && obj.scoordinate.y && obj.scoordinate.x){
			var distance = geolib.getDistance(
				{longitude:self.currentPosition.coords.longitude,latitude:self.currentPosition.coords.latitude},
				{longitude:obj.scoordinate.x,latitude:obj.scoordinate.y});
				return distance;
			} else {
				if (obj.current)
				return obj.current.timestamp *-1;
				else return 0;
			}
		}
		self.getAllPredictions = function(){
			if (self.data && self.data.length>0){
                var datamap = {};
			    var now = new Date().getTime();
                var later = now+60*1000*60*4;
                $http.get(endpoint + "parking-forecast-30,parking-forecast-60,parking-forecast-120,parking-forecast-240/"+moment(now).format("YYYY-MM-DDTHH:mm:ss")+"/"+moment(later).format("YYYY-MM-DDTHH:mm:ss")+"?limit=200&offset=0&shownull=false&distinct=false&select=scode,mvalue,mperiod,mvalidtime").then(function(response){
                        let data = response.data.data;
                        self.predictions = data.reduce((map,item) => (map[item.scode] ? map[item.scode].push(item):map[item.scode]=[item] , map),{});
                        
                        drawCharts();
					});
			    function drawCharts(){
    				for (stationId in self.predictions){
				        var data = [];
                        for (i in self.predictions[stationId]){
	    				    var point = {x:new Date(self.predictions[stationId][i].mvalidtime),y:self.predictions[stationId][i].mvalue};
		    			    data.push(point);
                        }
				        data.sort((a,b)=> (a.x.getTime()-b.x.getTime()));
       				    var series = [{name:'station'+stationId, data:data}];
	    			    if ( !self.chartData)
		    			    self.chartData={};
			    	    self.chartData[stationId]={series:series};
    			    	self.options={
	    	    			axisX: {
		        				type: Chartist.FixedScaleAxis,
	    		    			divisor: 5,
    				    		labelInterpolationFnc: function(value) {
					    		    return moment(value).format('HH:mm');
						        }
					        }
				        }
			    	}
			    }
			}
		}
		self.filterByCity = function(station){
			if (station.smetadata.municipality in self.mMap)
			return self.mMap[station.smetadata.municipality].active;
			return false;
		}
		self.init = function(){
			var geoLocation = navigator.geolocation.getCurrentPosition(startApp,startAppWithoutLocation); //first parameter success callback, second fail callback
			angular.extend(self, {
				southTyrol: {
					lat: 46.629849,
					lng: 11.3711693 ,
					zoom: 11
				},
				geojson:{
				},
				layers:{
					baselayers: {
						osm: {
							name: 'OpenStreetMap',
							type: 'xyz',
							url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
							layerOptions: {
								subdomains: ['a', 'b', 'c'],
								attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
								continuousWorld: true
							}
						},
					}
				}
			});
			$interval(self.getData,1000*5*60);
			$interval(self.getAllPredictions,1000*60);
		}
		self.getData = function(callback){
			$http.get(endpoint+'occupied?limit=200&offset=0&shownull=false&distinct=true').then(function(response){
				if (response.status==200){
                    let data = response.data.data;
					self.data = data;
                    if (self.mMap){
                        let distinctMunicipalities = [...new Set(data.map(item => item.smetadata.municipality))].sort();
                        self.mMap = distinctMunicipalities.reduce((map,item) => (map[item] ={active:item.indexOf('Bozen')!=-1,value:item},map),{});
                    }
				    if (callback && (typeof callback == "function")) callback();
				}
			});
		}
		self.getLocation = function() {
			leafletData.getMap('map').then(function(map) {
				map.locate({setView: true, maxZoom: 15, watch: false, enableHighAccuracy: true});
			});
		}
		self.getWFSLayer = function(){
			self.updateAllPopUps = function(stations,feature,layer){
				if (stations ){
					stations.forEach(function(station,index){
						if (station.scode == feature.properties.stationcode && station.mvalue){
							var free_places = station.smetadata.capacity - station.mvalue
							var html =
							'<div class="carpark">' +
							'<div class="carpark-aux">' +
							'<h2>'+station.sname+'</h2>' +
							'<ul>' +
							'<li class="address"><a target="_blank" href="https://maps.google.com?saddr=Current+Location&mode=driving&daddr=' + station.scoordinate.y+','+station.scoordinate.x + '">'+ (station.smetadata.mainaddress?station.smetadata.mainaddress:self.i18n[self.lang].not_available) +'</a></li>' +
							'<li class="phone"><span>'+ (station.smetadata.phonenumber?station.smetadata.phonenumber:self.i18n[self.lang].not_available) + '</span></li>' +
							'</ul>' +
							'<div class="slots">' +
							'<strong class="available-slots '+ (free_places>10?'available ':''+free_places<=15&&free_places>0?'almost-full ':''+
							free_places == 0 ? 'full':'') +'">'+
							'<span class="number">'+ free_places +  '</span>' +
							'<span class="value_type">'+self.i18n[self.lang].free_slots+'</span><span class="value_time"></span>' +
							'</strong>'+ self.i18n[self.lang].out_of + ' <strong>' + station.smetadata.capacity + ' ' + self.i18n[self.lang].available_slots + '</strong><br/>' +
							'updated <span>' + moment(station.mvalidtime).fromNow() + '</span>' +
							'</div>'+
							'</div>' +
							'</div>'
							layer.bindPopup(html);
							return;
						}
					});
				}
			}
			var defaultParameters = {
				service: 'WFS',
				version: '1.1.0',
				request: 'GetFeature',
				typeName: 'edi:parking',
				maxFeatures: 200,
				outputFormat: 'text/javascript',
				srsName:'EPSG:4326',
				format_options:'callback:angular.callbacks._' + $window.angular.callbacks.$$counter, //workaround for strange geoserver requestparams
			};
			$http.jsonp(geoserver_parking,{params : defaultParameters}).then(function(response){
                console.log(response);
				if (response.status==200){
					angular.extend(self.geojson, {
						parking :{
							data: response.data,
							pointToLayer: function(feature, latlng) {
								var image =  'marker-icon-grey.png';
								var current = feature.properties.occupacypercentage;
								if (current <90)
								image = 'marker-icon-green.png';
								else if (current>=90 && current<100) {
									image = 'marker-icon-yellow.png';
								}else if (current == 100)
								image = 'marker-icon-red.png'
								return new L.Marker(latlng, {
									icon:L.icon({
										iconUrl: 'images/'+image,
										// iconSize: [38, 95],
										iconAnchor: [25, 41],
										popupAnchor: [-18,  -50]
									})
								});
							},
							onEachFeature: function(feature,layer){
								if (feature.properties && feature.properties.stationcode){
									self.$watch('stations',function(stations){
										self.updateAllPopUps(stations,feature,layer);
									},true);
									self.$watch('lang',function(lang){
										self.updateAllPopUps(self.stations,feature,layer);
									});
								}
							}
						}
					});
				}
			});
		}
	});
