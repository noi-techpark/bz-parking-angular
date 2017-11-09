var parking= angular.module('parking', ['angularMoment','leaflet-directive','angular-chartist']);
var endpoint = 'http://ipchannels.integreen-life.bz.it/parkingFrontEnd/rest/';
var geoserver_parking = 'http://geodata.integreen-life.bz.it/geoserver/edi/ows';
parking.config(function ($sceDelegateProvider,) {
  $sceDelegateProvider.resourceUrlWhitelist([
    'self',                    // trust all resources from the same origin
    '*://geodata.integreen-life.bz.it/**'
  ]);
});
parking.run(function($rootScope){
  var lang = navigator.language || navigator.userLanguage;
  $rootScope.lang = lang.split('-')[0];
  $rootScope.i18n = i18n;
});
parking.controller('parking',function($scope,$http,$interval,leafletData){
  var self = $scope;
  self.getAllPredictions = function(){
    if (self.stations && self.stations.length>0){
      self.stations.forEach(function(value,index){
        self.getPrediction(value.id);
      });
    }
  }
  self.initIntervalls = function(){
    angular.extend(self, {
      southTyrol: {
        lat: 46.629849,
        lng: 11.3711693 ,
        zoom: 11
      },
      geojson:{
      }
    });
    $interval(self.getCurrentData,1000*60);
    $interval(self.getStations,1000*60*60);
    $interval(self.getAllPredictions,1000*60*30);
  }
  self.getStations = function(){
    $http.get(endpoint+'get-station-details').then(function(response){
      if (response.status==200)
      self.stations=response.data;
      self.getCurrentData();
      response.data.forEach(function(value,index){
        self.getPrediction(value.id);
      });
    });
  }
  self.getCurrentData = function(){
    if (self.stations){
      self.stations.forEach(function(item,index){
        var config ={
          params:{
            station:item.id,
            type:'free'
          }
        }
        $http.get(endpoint+'get-newest-record',config).then(function(response){
          if (response.status==200){
            if (!item.current) item.current={};
            item.current.value=response.data.value;
            item.current.timestamp=response.data.timestamp;
          }
        });
      });
    }
  }
  self.getPrediction = function(stationid){
    var now = new Date().getTime();
    var config = {
      params:{
        station:stationid,
        name:'parking-forecast',
        from:now,
        to: now + 60*1000*60 * 4,
      }
    }

    $http.get(endpoint + "get-records-in-timeframe",config).then(function(response){
      if (response.data){
        var data = [];
        var datamap = {};
        response.data.forEach(function(record,index){
          if (record.value<0)
          record.value = 0;
          var currentData = datamap[record.timestamp];
          if (currentData){
            if (record.created_on>currentData.created_on){
              currentData = record;
            }
          }else {
            datamap[record.timestamp] = record;
          }
        });
        for (key in datamap){
          var point = {x:new Date(datamap[key].timestamp),y:datamap[key].value};
          data.push(point);
        }
        var series = [{name:'station'+stationid, data:data}];
        self.chartData={};
        self.chartData[stationid]={
          series:series
        }
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
    });
  }

  self.getLocation = function() {
    leafletData.getMap('map').then(function(map) {
      map.locate({setView: true, maxZoom: 15, watch: true, enableHighAccuracy: true});
    });
  }

  self.getWFSLayer = function(){
    var defaultParameters = {
      service: 'WFS',
      version: '1.1.0',
      request: 'GetFeature',
      typeName: 'edi:parking',
      maxFeatures: 200,
      outputFormat: 'text/javascript',
      srsName:'EPSG:4326',
      format_options:'callback:angular.callbacks._0',

    };
    $http.jsonp(geoserver_parking,{params : defaultParameters}).then(function(response){
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
                  if (stations ){
                    stations.forEach(function(station,index){
                      if (station.id == feature.properties.stationcode && station.current){
                        var html =
                        '<div class="carpark">' +
                        '<div class="carpark-aux">' +
                        '<h2>'+station.name+'</h2>' +
                        '<ul>' +
                        '<li class="address"><a href="">'+ station.mainaddress +'</a></li>' +
                        '<li class="phone"><span>'+ station.phonenumber + '</span></li>' +
                        '</ul>' +
                        '<div class="slots">' +
                        '<strong class="available-slots '+ (station.current.value>10?'available ':''+station.current.value<=15&&station.current.value>0?'almost-full ':''+
                        station.current.value == 0 ? 'full':'') +'">'+
                        '<span class="number">'+ station.current.value + '</span>' +
                        '<span class="value_type">Free slots</span><span class="value_time"></span>' +
                        '</strong> out of <strong>' + station.capacity + ' Available slots</strong><br/>' +
                        'updated <span>' + moment(station.current.timestamp).fromNow() + '</span>' +
                        '</div>'+
                        '</div>' +
                        '</div>'
                        layer.bindPopup(html);
                        return;
                      }
                    });
                  }
                },true);
              }
            }
          }
        });
      }
    });
  }
});
