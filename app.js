var parking= angular.module('parking', ['angularMoment','leaflet-directive']);
var endpoint = 'http://ipchannels.integreen-life.bz.it/parkingFrontEnd/rest/';
var geoserver_parking = 'http://geodata.integreen-life.bz.it/geoserver/edi/ows';
parking.config(function ($sceDelegateProvider) {
  $sceDelegateProvider.resourceUrlWhitelist([
    'self',                    // trust all resources from the same origin
    '*://geodata.integreen-life.bz.it/**'   // trust all resources from `www.youtube.com`
  ]);
});
parking.controller('parking',function($scope,$http,$interval){
  var self = $scope;
  self.getStations = function(){
    $http.get(endpoint+'get-station-details').then(function(response){
      if (response.status==200)
      self.stations=response.data;
      self.getCurrentData();
    });
  }
  self.getCurrentData = function(){
    if (self.stations)
    {
      self.stations.forEach(function(item,index){
        var config ={
          params:{
            station:item.id,
            type:'free'
          }
        }
        $http.get(endpoint+'get-newest-record',config).then(function(response){
          if (response.status==200)
          item.current=response.data;
        });
      });
    }
  }
  $interval(self.getCurrentData,63000);
  $interval(self.getStations,1000*60*60);

  angular.extend($scope, {
    southTyrol: {
      lat: 46.629849,
      lng: 11.3711693 ,
      zoom: 10
    },
    geojson:{}
  });
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
  $http.jsonp(geoserver_parking,{params : defaultParameters})
  .then(function(response){
    if (response.status==200){
      angular.extend($scope, {
        geojson : response.data

      //   name:'Parking Lots',
      //   type: 'geoJSON',
      //   data: response.data,
      //   visible: true,
      //   layerOptions: {
      //     style: {
      //       color: '#00D',
      //       fillColor: 'red',
      //       weight: 2.0,
      //       opacity: 0.6,
      //       fillOpacity: 0.2
      //     }
      //   }
      // }
    });
  }
});
});
