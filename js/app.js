var map;



var largeInfoWindow;
var bounds;

function initMap() {
    // Constructor creates a new map - only center and zoom are required.
    map = new google.maps.Map(document.getElementById('map'), {
        center: {
            lat: 34.730369,
            lng: -86.586104
        },
        zoom: 12,
        styles: features,
        mapTypeControl: false
    });

    largeInfoWindow = new google.maps.InfoWindow();

    bounds = new google.maps.LatLngBounds();

    ko.applyBindings(new ViewModel());
}



var LocationMarker = function(data) {
    var self = this;

    this.title = data.title;
    this.position = data.location;
    this.type = data.type;
    this.street = '',
    this.city = '',
    this.phone = '',
    this.url = '';

    this.visible = ko.observable(true);

    // Style the markers a bit. This will be our listing marker icon.
    var defaultIcon = makeMarkerIcon('3336FF');

    // Create a "highlighted location" marker color for when the user
    // mouses over the marker.
    var highlightedIcon = makeMarkerIcon('FF5733');

    //Foursquare Credentials
    var clientID = 'F1TB42OYNBL4MCYEXAZZHHH4GOEPTH0ZYWPGOIV2OYCC200I';
    var clientSecret = 'UIGCKMYFNACR4BLY3VQAXDOQCYMJJIYBDYYRRHLMWUGXHX21';

    //API URL to foursquare to get JSON request data
    var apiURL = 'https://api.foursquare.com/v2/venues/search?ll=' + this.position.lat + ',' + this.position.lng + '&client_id=' + clientID + '&client_secret=' + clientSecret + '&v=20180118' + '&query=' + this.title;

    $.getJSON(apiURL).done(function (data) {
        var results = data.response.venues[0];
        self.street = results.location.formattedAddress[0] ? results.location.formattedAddress[0] : 'N/A';
        self.city = results.location.formattedAddress[1] ? results.location.formattedAddress[1] : 'N/A';
        self.phone = results.contact.formattedPhone ? results.contact.formattedPhone : 'N/A';
        self.url = results.url ? results.url : '';
    }).fail(function () {
        alert('Foursquare did not load properly. Please refresh your page');
    });

    // Create a marker per location, and put into markers array.
    this.marker = new google.maps.Marker({
        position: this.position,
        title: this.title,
        type: this.type,
        animation: google.maps.Animation.DROP,
        icon: defaultIcon
    });

    self.filterMarkers = ko.computed(function () {
        if (self.visible() === true) {
            self.marker.setMap(map);
            bounds.extend(self.marker.position);
            map.fitBounds(bounds);
        } else {
            self.marker.setMap(null);
        }
    });
    // Create an onclick event to open an infowindow at each marker.
    this.marker.addListener('click', function () {
        populateInfoWindow(this, self.street, self.city, self.phone, self.url, largeInfoWindow);
        markerBounce(this);
        map.panTo(this.getPosition());
    });

    // Two event listeners - one for mouseover, one for mouseout,
    // to change the colors back and forth.
    this.marker.addListener('mouseover', function () {
        this.setIcon(highlightedIcon);
    });
    this.marker.addListener('mouseout', function () {
        this.setIcon(defaultIcon);
    });

    this.showMarker = function (locationItem) {
        google.maps.event.trigger(self.marker, 'click');
    };


    this.bounceMarker = function (place) {
        google.maps.event.trigger(self.marker, 'click');
    };
};


// View Model
var ViewModel = function() {
    var self = this;

    this.locationList = ko.observableArray([]);
    this.searchList = ko.observable('');

    // add location markers for each location
    locations.forEach(function (locationItem) {
        self.locationList.push(new LocationMarker(locationItem));
    });

    // locations viewed on map
    this.placesList = ko.computed(function() {
        var filter = self.searchList().toLowerCase();
        if (filter) {
            return ko.utils.arrayFilter(self.locationList(), function (locationItem) {
                var str = locationItem.title.toLowerCase();
                var result = str.includes(filter);
                locationItem.visible(result);
                return result;
            });
        }
        self.locationList().forEach(function(locationItem) {
            locationItem.visible(true);
        });
        return self.locationList();
    }, self);
};

// Function to handle google maps error
function googleMapError() {
    alert('An error occured while loading Google Maps...Please try again!');
}

// This function populates the infowindow when the marker is clicked. We'll only allow
// one infowindow which will open at the marker that is clicked, and populate based
// on that markers position.
function populateInfoWindow(marker, street, city, phone, url, infowindow) {
    // Check to make sure the infowindow is not already opened on this marker.
    if (infowindow.marker != marker) {
        // Clear the infowindow content to give the streetview time to load.
        infowindow.setContent('');
        infowindow.marker = marker;
        // Make sure the marker property is cleared if the infowindow is closed.
        infowindow.addListener('closeclick', function () {
            infowindow.marker = null;
        });
        var streetViewService = new google.maps.StreetViewService();
        var radius = 50;
        // In case the status is OK, which means the pano was found, compute the
        // position of the streetview image, then calculate the heading, then get a
        // panorama from that and set the options
        function getStreetView(data, status) {
            if (status == google.maps.StreetViewStatus.OK) {
                var nearStreetViewLocation = data.location.latLng;
                var heading = google.maps.geometry.spherical.computeHeading(
                    nearStreetViewLocation, marker.position);
                infowindow.setContent('<div>' + marker.title + '</div>' + '<div>' + street + '</div>' + '<div>' + city + '</div>' + '<div>' + phone + '</div>' + '<a href=' + url + '>' + url + '</a><div id="pano"></div> <div>' + marker.type + '</div>');
                var panoramaOptions = {
                    position: nearStreetViewLocation,
                    pov: {
                        heading: heading,
                        pitch: 30
                    }
                };
                var panorama = new google.maps.StreetViewPanorama(
                    document.getElementById('pano'), panoramaOptions);
            } else {
                infowindow.setContent('<div>' + marker.title + '</div>' + '<div>' + street + '</div>' + '<div>' + city + '</div>' + '<div>' + phone + '</div>' + '<a href=' + url + '>' + url + '</a>' +
                    '<div>No Street View Found</div>' + marker.type + '</div>');
            }
        };
        // Use streetview service to get the closest streetview image within
        // 50 meters of the markers position
        streetViewService.getPanoramaByLocation(marker.position, radius, getStreetView);
        // Open the infowindow on the correct marker.
        infowindow.open(map, marker);
    }
}

function markerBounce(marker) {
    if (marker.getAnimation() !== null) {
        marker.setAnimation(null);
    } else {
        marker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(function () {
            marker.setAnimation(null);
        }, 1400);
    }
}


function makeMarkerIcon(markerColor) {
    var markerImage = new google.maps.MarkerImage(
        'http://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|' + markerColor +
        '|40|_|%E2%80%A2',
        new google.maps.Size(21, 34),
        new google.maps.Point(0, 0),
        new google.maps.Point(10, 34),
        new google.maps.Size(21, 34));
    return markerImage;
}
