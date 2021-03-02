var geolib;
// var convertSensorsToStations: any;
var moment;
var angular;
var L;
var i18n;
var navigator;
var parking = angular.module("parking", [
    "leaflet-directive",
    "angular-chartist",
]);
var endpoint = "https://mobility.api.opendatahub.bz.it/v2/flat/ParkingStation,ParkingSensor/";
parking.config(function ($sceDelegateProvider) {
    $sceDelegateProvider.resourceUrlWhitelist([
        "self",
        "*://mobility.api.opendatahub.bz.it/**",
        "*://ipchannels.integreen-life.bz.it/**",
    ]);
});
parking.run(function ($rootScope) {
    var lang = navigator.language;
    // || navigator.userLanguage;
    $rootScope.lang = lang.split("-")[0];
    $rootScope.i18n = i18n;
    moment.locale($rootScope.lang);
    $rootScope.moment = moment;
    if (!$rootScope.i18n[$rootScope.lang])
        lang = "en";
    $rootScope.$watch("lang", function (newLocale) {
        if (newLocale)
            moment.locale(newLocale);
    });
});
parking.controller("parking", function ($scope, $http, $interval, $window, leafletData, $filter, $q) {
    var self = $scope;
    function startApp(position) {
        self.currentPosition = position;
        self.getData(self.getAllPredictions);
    }
    function startAppWithoutLocation() {
        self.getData(self.getAllPredictions);
    }
    self.conditionalSorting = function (obj) {
        if (self.currentPosition &&
            obj.scoordinate &&
            obj.scoordinate.y &&
            obj.scoordinate.x) {
            var distance = geolib.getDistance({
                longitude: self.currentPosition.coords.longitude,
                latitude: self.currentPosition.coords.latitude
            }, { longitude: obj.scoordinate.x, latitude: obj.scoordinate.y });
            return distance;
        }
        else {
            if (obj.current)
                return obj.current.timestamp * -1;
            else
                return 0;
        }
    };
    function drawCharts() {
        var stationId;
        for (stationId in self.predictions) {
            var data = [];
            for (var i in self.predictions[stationId]) {
                var point = {
                    x: new Date(self.predictions[stationId][i].mvalidtime),
                    y: self.predictions[stationId][i].mvalue
                };
                data.push(point);
            }
            data.sort(function (a, b) { return a.x.getTime() - b.x.getTime(); });
            var series = [{ name: "station" + stationId, data: data }];
            if (!self.chartData)
                self.chartData = {};
            self.chartData[stationId] = { series: series };
            var Chartist;
            self.options = {
                axisX: {
                    type: Chartist ? Chartist.FixedScaleAxis : null,
                    divisor: 5,
                    labelInterpolationFnc: function (value) {
                        return moment(value).format("HH:mm");
                    }
                }
            };
        }
    }
    self.getAllPredictions = function () {
        if (self.data && self.data.length > 0) {
            var datamap = {};
            var now = new Date();
            var later = new Date(now.getTime() + 60 * 1000 * 60 * 4);
            $http
                .get(endpoint +
                "parking-forecast-30,parking-forecast-60,parking-forecast-120,parking-forecast-240/" +
                now.toISOString() +
                "/" +
                later.toISOString() +
                "?limit=-1&offset=0&shownull=false&distinct=false&select=scode,mvalue,mperiod,mvalidtime")
                .then(function (response) {
                var data = response.data.data;
                self.predictions = data.reduce(function (map, item) {
                    if (map[item.scode]) {
                        if (map[item.scode][item.mvalidtime]) {
                            if (map[item.scode][item.mvalidtime].mperiod > item.mperiod) {
                                map[item.scode][item.mvalidtime] = item;
                            }
                        }
                        else {
                            map[item.scode][item.mvalidtime] = item;
                        }
                    }
                    else {
                        map[item.scode] = {};
                        map[item.scode][item.mvalidtime] = item;
                    }
                    return map;
                }, {});
                drawCharts();
            });
        }
    };
    self.filterByCity = function (station) {
        // solves error "municipality of undefined"
        console.log(station);
        console.log(station.smetadata.municipality);
        if (station.smetadata && station.smetadata.municipality in self.mMap) {
            // if (station.smetadata && station.smetadata.municipality) {
            return self.mMap[station.smetadata.municipality].active;
        }
        else {
            // console.log(station.smetadata);
        }
        return false;
    };
    self.init = function () {
        var geoLocation = navigator.geolocation.getCurrentPosition(startApp, startAppWithoutLocation); //first parameter success callback, second fail callback
        angular.extend(self, {
            southTyrol: {
                lat: 46.629849,
                lng: 11.3711693,
                zoom: 11
            },
            geojson: {},
            layers: {
                baselayers: {
                    osm: {
                        name: "OpenStreetMap",
                        type: "xyz",
                        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                        layerOptions: {
                            subdomains: ["a", "b", "c"],
                            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                            continuousWorld: true
                        }
                    }
                }
            }
        });
        $interval(self.getData, 1000 * 60);
        $interval(self.getAllPredictions, 1000 * 60 * 4);
    };
    var convertSensorsToStations = function (data) {
        var parkingStations = data
            .filter(function (s) { return s.stype == "ParkingSensor"; })
            .reduce(function (stations, sensor) {
            var station = stations[sensor.smetadata.group];
            if (station == undefined) {
                station = JSON.parse(JSON.stringify(sensor));
                station.sname = sensor.smetadata.group;
                station.smetadata.capacity = 1;
                station["virtual"] = true;
                station.stype = "ParkingStation";
                station.scode = station.scode + "-virtual";
                stations[station.sname] = station;
            }
            else {
                station.mvalue += sensor.mvalue;
                station.smetadata.capacity++;
                if (station.mvalidtime < sensor.mvalidtime)
                    station.mvalidtime = sensor.mvalidtime;
            }
            return stations;
        }, []);
        //return [].concat(data, Object.values(parkingStations));
        return [].concat(data, parkingStations.values());
    };
    self.getData = function (callback) {
        $http
            .get(endpoint +
            "occupied/latest?limit=-1&offset=0&shownull=false&distinct=true")
            .then(function (response) {
            if (response.status == 200) {
                var data = convertSensorsToStations(response.data.data);
                console.log(data);
                self.data = data;
                // console.log(self.mMap);
                if (!self.mMap || Object.keys(self.mMap).length === 0) {
                    var distinctMunicipalities = [
                        new Array(data.map(function (item) {
                            if (item.smetadata) {
                                return item.smetadata.municipality;
                            }
                        })),
                    ].sort();
                    //   self.mMap = distinctMunicipalities.reduce(function (map, item) {
                    //     return (
                    //       (map[item] = {
                    //         active: item && item.indexOf("Bozen") != -1,
                    //         value: item,
                    //       }),
                    //       map
                    //     );
                    //   }, {});
                    var obj = {};
                    var ret_arr = [];
                    console.log(distinctMunicipalities);
                    for (var i = 0; i < distinctMunicipalities[0][0].length; i++) {
                        obj[distinctMunicipalities[0][0][i]] = true;
                    }
                    for (var key in obj) {
                        ret_arr.push(key);
                    }
                    self.mMap = ret_arr;
                    console.log(self.mMap);
                }
                drawGJ();
                if (callback && typeof callback == "function")
                    callback();
            }
        });
    };
    self.getLocation = function () {
        leafletData.getMap("map").then(function (map) {
            map.locate({
                setView: true,
                maxZoom: 15,
                watch: false,
                enableHighAccuracy: true
            });
        });
    };
    self.updateAllPopUps = function (stations, feature, layer) {
        if (stations) {
            stations.forEach(function (station, index) {
                if (station.scode == feature.properties.stationcode &&
                    station.mvalue != undefined) {
                    var free_places = station.stype === "ParkingSensor"
                        ? station.mvalue * -1 + 1
                        : station.smetadata.capacity - station.mvalue;
                    var html = '<div class="carpark">' +
                        '<div class="carpark-aux">' +
                        "<h2>" +
                        station.sname +
                        "</h2>" +
                        "<ul>" +
                        '<li class="address"><a target="_blank" href="https://maps.google.com?saddr=My+Location&mode=driving&daddr=' +
                        station.scoordinate.y +
                        "," +
                        station.scoordinate.x +
                        '">' +
                        (station.smetadata.mainaddress
                            ? station.smetadata.mainaddress
                            : self.i18n[self.lang].not_available) +
                        "</a></li>" +
                        '<li class="phone"><span>' +
                        (station.smetadata.phonenumber
                            ? station.smetadata.phonenumber
                            : self.i18n[self.lang].not_available) +
                        "</span></li>" +
                        "</ul>" +
                        '<div class="slots">' +
                        '<strong class="available-slots ' +
                        (free_places > 10
                            ? "available "
                            : free_places <= 15 && free_places > 0
                                ? "almost-full "
                                : free_places == 0
                                    ? "full"
                                    : "") +
                        '">' +
                        '<span class="number">' +
                        free_places +
                        "</span>" +
                        '<span class="value_type">' +
                        self.i18n[self.lang].free_slots +
                        '</span><span class="value_time"></span>' +
                        "</strong>" +
                        self.i18n[self.lang].out_of +
                        " <strong>" +
                        (station.smetadata.capacity ? station.smetadata.capacity : "1") +
                        " " +
                        self.i18n[self.lang].available_slots +
                        "</strong><br/>" +
                        "updated <span>" +
                        moment(station.mvalidtime).fromNow() +
                        "</span>" +
                        "</div>" +
                        "</div>" +
                        "</div>";
                    layer.bindPopup(html);
                    return;
                }
            });
        }
    };
    function drawGJ() {
        var gj = convertToGeoJson(self.data);
        angular.extend(self.geojson, {
            parking: {
                data: gj,
                pointToLayer: function (feature, latlng) {
                    var image = "marker-icon-grey.png";
                    var current = feature.properties.occupacypercentage;
                    if (current < 90)
                        image = "marker-icon-green.png";
                    else if (current >= 90 && current < 100) {
                        image = "marker-icon-yellow.png";
                    }
                    else if (current == 100)
                        image = "marker-icon-red.png";
                    return new L.Marker(latlng, {
                        icon: L.icon({
                            iconUrl: "images/" + image,
                            iconAnchor: [25, 41],
                            popupAnchor: [-18, -50]
                        })
                    });
                },
                onEachFeature: function (feature, layer) {
                    if (feature.properties && feature.properties.stationcode) {
                        self.$watch("data", function (stations) {
                            self.updateAllPopUps(stations, feature, layer);
                        }, true);
                        self.$watch("lang", function (lang) {
                            self.updateAllPopUps(self.data, feature, layer);
                        });
                    }
                }
            }
        });
    }
    function convertToGeoJson(data) {
        var gj = {
            type: "FeatureCollection",
            features: [],
            totalFeatures: data.length,
            numberMatched: data.length,
            numberReturned: data.length,
            timeStamp: "2020-04-10T13:19:01.589Z",
            crs: {
                type: "name",
                properties: {
                    name: "urn:ogc:def:crs:EPSG::4326"
                }
            }
        };
        data.forEach(function (station, index) {
            if (station.virtual !== true) {
                var obj = {
                    type: "Feature",
                    id: station.id,
                    geometry: {
                        type: "Point",
                        coordinates: [
                            station.scoordinate ? station.scoordinate.x : null,
                            station.scoordinate ? station.scoordinate.y : null,
                        ]
                    },
                    geometry_name: "pointprojection",
                    properties: {
                        stationcode: station.scode,
                        occupacypercentage: station.stype === "ParkingStation"
                            ? (station.mvalue / station.smetadata.capacity) * 100
                            : 100 * station.mvalue
                    }
                };
                gj.features.push(obj);
            }
        });
        return gj;
    }
});
