var start_location = null;
var end_location = null;

var roads = {};
var directionsDisplay, directionsService, geocoder, map;
var previousPolylines = [];

/*
	Hook that is called when the Google Maps API script is loaded.
	We want to initialize all the services we're going to use and center the map;
*/
function initMaps() {
	map = new google.maps.Map(document.getElementById('map'), {
		center: { lat: 38.9983955, lng: -76.9722686 },
		zoom: 8,
		mapTypeId: 'roadmap'
	});
	initSearchbox("pac-input1", map)
	initSearchbox("pac-input2", map)

	directionsService = new google.maps.DirectionsService();
	directionsDisplay = new google.maps.DirectionsRenderer();
	directionsDisplay.setMap(map);
}


/*
	Initialize the Google Maps searchboxes.
*/
function initSearchbox(id, map) {
	// Create the search box and link it to the UI element.
	var input = document.getElementById(id);
	var searchBox = new google.maps.places.SearchBox(input);

	// Bias the SearchBox results towards current map's viewport.
	map.addListener('bounds_changed', function () {
		searchBox.setBounds(map.getBounds());
	});

	var markers = [];
	// Listen for the event fired when the user selects a prediction and retrieve
	// more details for that place.
	searchBox.addListener('places_changed', function () {
		var places = searchBox.getPlaces();

		if (places.length == 0) {
			return;
		}

		if (id == "pac-input1") {
			console.log("Setting start_location to " + places[0]);
			start_location = places[0];
		} else {
			console.log("Setting destination to " + places[0]);
			end_location = places[0];
		}

		// Clear out the old markers.
		markers.forEach(function (marker) {
			marker.setMap(null);
		});
		markers = [];

		// For the first place, get the icon, name and location.
		var place = places[0];
		var bounds = new google.maps.LatLngBounds();
		if (!place.geometry) {
			console.log("Returned place contains no geometry");
			return;
		}
		var icon = {
			url: place.icon,
			size: new google.maps.Size(71, 71),
			origin: new google.maps.Point(0, 0),
			anchor: new google.maps.Point(17, 34),
			scaledSize: new google.maps.Size(25, 25)
		};

		// Create a marker for each place.
		markers.push(new google.maps.Marker({
			map: map,
			icon: icon,
			title: place.name,
			position: place.geometry.location
		}));

		if (place.geometry.viewport) {
			// Only geocodes have viewport.
			bounds.union(place.geometry.viewport);
		} else {
			bounds.extend(place.geometry.location);
		}
		map.fitBounds(bounds);

		onPlaceChanged();
	});

}

var routePaths = [];

/*
	Called whenever the Calculate Probability button is pressed.
	Makes a bunch of requests, one for each road along the route.
*/
function onCalcPressed() {
	console.log("Calculate button pressed");

	var roadNames = Object.keys(roads);
	var roadArr = [];


	//map.clear();
	for(var i = 0; i < previousPolylines.length; i++) {
		console.log("Calling setMap(null) on polyline");
		console.log(previousPolylines[i]);
		previousPolylines[i].setMap(null);
	}

	previousPolylines = [];	

	for (var i = 0; i < roadNames.length; i++) {
		var roadName = roadNames[i];
		var road = roads[roadName];

		roadArr.push({ 
			roadName: roadName, 
			latitude: road.latitude, 
			longitude: road.longitude, 
			speed: road.speed });
	}
	
	var url = "/getcrashprobability";
	var method = "POST";
	var postData = JSON.stringify({roadArr});

	var request = new XMLHttpRequest();

	console.log("Sending server request...");

	request.onload = function () {
		var status = request.status; // HTTP response status, e.g., 200 for "200 OK"
		var data = JSON.parse(request.responseText); //.replace("[", '').replace("]", '').replace("\"", '').replace("\"", ''); // Returned data, e.g., an HTML document.

		console.log(data);

		if (!data) {
			return;
		}

		console.log("Setting route path...");

		var probs = data.roadProbabilities;

		var probArray = [];
		for(var i = 0; i < probs.length; i++) {
			probArray.push(parseFloat(probs[i].result));
		}

		calculateCrashProbability(probs);

		console.log(probArray);

		for(var i = 0; i < probs.length; i++) {
			var probObj = probs[i];
			var roadName = probObj.roadName;
			var probability = parseFloat(probObj.result);
			var road = roads[roadName];
			var percentile = percentRank(probArray, probability) * 1.5;

			console.log("probability: " + probability + ", percentile: " + percentile);

			for(var k = 0; k < road.paths.length; k++) {
				var dumbPath = road.paths[k];
				var path = [];
				for (var j = 0; j < dumbPath.length; j++) {
					var location = dumbPath[j];
					var latLngArray = new String(location).replace("(", "").replace(")", "").split(',', 2);
					var latlng = { lat: parseFloat(latLngArray[0]), lng: parseFloat(latLngArray[1]) };
		
					path.push(latlng);
				}

				var color = '#' + fullColorHex(Math.floor(percentile * 255), 255 - Math.floor(percentile * 255), 0);
				console.log("stroke color: " + color);
		
				var routePath = new google.maps.Polyline({
					path: path,
					geodesic: true,
					strokeColor: color,
					strokeOpacity: 1.0,
					strokeWeight: 5
				});
		
				routePath.setMap(map);
				routePaths.push(path);
				previousPolylines.push(routePath);	
			}
	
		}
		console.log(routePaths);
	}

	request.open(method, url, true);
	request.setRequestHeader("Content-Type", "application/json;charset=UTF-8");



	// Actually sends the request to the server.
	request.send(postData);
}

/*
	Based on the probabilities array sent from the server, calculator the total crash probability
	according to formula:
	d1p1 + d2p2 ... / sum of distances
*/
function calculateCrashProbability(probabilities) {
	var numerator = 0;
	var denominator = 0;
	for(var i = 0; i < probabilities.length; i++) {
		var roadName = probabilities[i].roadName;
		var distance = roads[roadName].distance;
		var probability = probabilities[i].result;

		numerator = numerator + distance * probability;
		denominator += distance;
	}

	var probability = numerator / denominator;

	document.getElementById("crash-probability").innerHTML = probability * 100 + "%";

	return probability;
}

/*
	Calculates a route between start_location and end_location by calling the Google Maps API.
	It also lists out each road of the journey and says their durations.
*/
function calcRoute() {
	// Prepare the API call
	var start = start_location.geometry.location;
	var end = end_location.geometry.location;
	var request = {
		origin: start,
		destination: end,
		travelMode: 'DRIVING'
	};

	// Call Google Maps API
	directionsService.route(request, function (result, status) {
		console.log(result);
		if (status == 'OK') {
			// Update the map to show the route
			directionsDisplay.setDirections(result);

			// List out the roads that the route includes
			var routes = result.routes;

			document.getElementById("routeslist").innerHTML = '';
			for (var i = 0; i < routes[0].legs[0].steps.length; i++) {
				var routePath = routes[0].legs[0].steps[i].path;
				var road_location = routePath[Math.floor(routePath.length / 2)];
				var duration = routes[0].legs[0].steps[i].duration.value;
				var distance = routes[0].legs[0].steps[i].distance.value;

				// speed in miles per hour
				var speed = distance * 0.000621371 / (duration / 3600);

				
				//console.log("Speed: " + speed);

				speed = Math.max(20, Math.round(speed/10) * 10);

				//console.log("New Speed: " + speed);
				var polyline = routes[0].legs[0].steps[i].polyline;

				processStep(road_location, duration, distance, speed, routePath, polyline);
			}
		}


	});
}

/*
	Called every time a place textbox changes. If both textboxes are set, it should calculate a route.
*/
function onPlaceChanged() {

	console.log("Start location: " + start_location + ", destination: " + end_location);
	if (start_location && end_location) {
		console.log("Calculating route between " + start_location.name + " and " + end_location.name);
		calcRoute();
	}
}

// Calculates which road in our path do we spend the most time on

function longestRoad() {
	var max = 0;
	var roadNames = Object.keys(roads)

	for (var i = 0; i < roadNames.length; i++) {
		if (roads[roadNames[i]].duration > max) {
			max = roads[roadNames[i]].duration;
		}
	}
	console.log(max);
}

/*
	Updates routeslist to be a sorted by duration list of roads
	based on "roads" variable.
*/
function renderList() {
	// First, we need to put the objects into an array.
	var roadsList = Object.values(roads);

	// Then, we need to sort the array.
	roadsList.sort((a, b) => -a.duration + b.duration);

	// Then, we need to clear the list and add new elements
	var listElement = document.getElementById("routeslist");
	listElement.innerHTML = '';
	for (var i = 0; i < roadsList.length; i++) {
		var road = roadsList[i];
		var speed = road.distance * 0.000621371 / (road.duration / 3600);

		console.log("Speed: " + speed);

		listElement.append(getListNode(roadsList[i].roadName, Math.round(speed), road.distance));
	}
}

/*
	Process a step in a route.
	Finds a road name given a location and sets the text of the "element" parameter to the
	road name.
*/
function processStep(location, duration, distance, speed, path, polyline) {
	var latLngArray = new String(location).replace("(", "").replace(")", "").split(',', 2);
	var latlng = { lat: parseFloat(latLngArray[0]), lng: parseFloat(latLngArray[1]) };

	httpGetAsync("https://nominatim.openstreetmap.org/reverse?format=json&lat=" + latlng.lat + "&lon=" + latlng.lng + "&zoom=18&addressdetails=1", function (data) {
		var road;
		try {
			road = JSON.parse(data).address.road;
		} catch (err) {
			console.warn("Error finding road name from GPS coordinates " + location + " :(");
		}

		if (!road) {
			console.warn("Error finding road name from GPS coordinates " + location + " :(");
		}
		else if (!roads[road]) {
			var listNode = getListNode(road, duration, distance, speed);
			roads[road] = {
				duration: duration,
				element: listNode,
				latitude: latlng.lat,
				longitude: latlng.lng,
				roadName: road,
				distance: distance,
				speed: speed,
				paths: [path],
				polylines: [polyline]
			};
		} else {
			var road = roads[road];
			road.duration += duration;
			road.distance += distance;
			road.paths.push(path);
			road.polylines.push(polyline);
		}
		renderList();
	});
}



/*
	Helper Functions:
*/

/*
	HTTP Get Request helper function
*/
function httpGetAsync(theUrl, callback) {
	var xmlHttp = new XMLHttpRequest();
	xmlHttp.onreadystatechange = function () {
		if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
			callback(xmlHttp.responseText);
	}
	xmlHttp.open("GET", theUrl, true); // true for asynchronous 
	xmlHttp.send(null);
}

function getListNode(roadName, speed, distance) {
	var liNode = document.createElement("li");

	liNode.appendChild(getListNodeInner(roadName, speed, distance));
	return liNode;
}

function getListNodeInner(roadName, speed, distance) {
	var spanNode = document.createElement("span");
	var spanNodeInner = document.createElement("span");

	spanNode.classList.add("roadNameContainer");
	spanNodeInner.classList.add("roadNameInner");

	spanNode.appendChild(document.createTextNode(roadName));
	spanNodeInner.appendChild(document.createTextNode(speed + " mph, "));
	//spanNodeInner.appendChild(document.createTextNode(secondsToHms(duration)));
	spanNodeInner.appendChild(document.createTextNode(meterToMile(distance)));
	spanNode.appendChild(spanNodeInner);
	return spanNode;
}

/*
	Formats seconds parameter to hours and minutes
*/
function secondsToHms(d) {
	d = Number(d);
	var h = Math.floor(d / 3600);
	var m = Math.floor(d % 3600 / 60);
	var s = Math.floor(d % 3600 % 60);

	var hDisplay = h > 0 ? h + (h == 1 ? " hr, " : " hrs, ") : "";
	var mDisplay = m > 0 ? m + (m == 1 ? " min, " : " min, ") : "";
	var sDisplay = s > 0 ? s + (s == 1 ? " sec" : " sec ") : "";
	return hDisplay + mDisplay + sDisplay;
}

function meterToKilometer(m) {
	var km = Number(m);

	var kmDisplay = km > 1000 ? Math.round(km / 100) / 10 + " km" : km + " m"

	return kmDisplay;
}


function meterToMile(m) {
	var miles = Number(m) * 0.000621371;

	miles = Math.round(miles*10)/10;

	return miles + " mi";
}


var rgbToHex = function (rgb) {
	var hex = Number(rgb).toString(16);
	if (hex.length < 2) {
		hex = "0" + hex;
	}
	return hex;
};
var fullColorHex = function (r, g, b) {
	var red = rgbToHex(r);
	var green = rgbToHex(g);
	var blue = rgbToHex(b);
	return red + green + blue;
};

function percentRank(arr, v) {
    if (typeof v !== 'number') throw new TypeError('v must be a number');
    for (var i = 0, l = arr.length; i < l; i++) {
        if (v <= arr[i]) {
            while (i < l && v === arr[i]) i++;
            if (i === 0) return 0;
            if (v !== arr[i-1]) {
                i += (v - arr[i-1]) / (arr[i] - arr[i-1]);
            }
            return i / l;
        }
    }
    return 1;
}