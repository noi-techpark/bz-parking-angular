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
      zoom: 11
    },
    geojson:{
    }
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
      angular.extend($scope.geojson, {
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
            return new L.Marker(latlng, {icon:L.icon({
              iconUrl: 'images/'+image,
              // iconSize: [38, 95],
              iconAnchor: [25, 41],
              popupAnchor: [-3, -76]
            })
          });
        },
        onEachFeature: function(feature,layer){
          if (feature.properties && feature.properties.stationcode){
            $scope.$watch('stations',function(stations){
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
                  // 'updated <span am-time-ago="station.current.timestamp"></span>
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
