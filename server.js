const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');
const app = express();
const port = 3000;
const ps = require('python-shell');

app.use(express.static('public'))
app.use(bodyParser.json());

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/public/index.html');
});


app.post('/getcrashprobability', (req, res) => {
	console.log("getcrashprobability request received")
	console.log("req: " + JSON.stringify(req.body));

	var roads = req.body.roadArr;
	var numCompleted = 0;
	var roadProbabilities = [];

	for(var i = 0; i < roads.length; i++) {
		var road = roads[i];
		var hour = new Date().getHours();
		var now = new Date();
		var start = new Date(now.getFullYear(), 0, 0);
		var diff = now - start;
		var oneDay = 1000 * 60 * 60 * 24;
		var day = Math.floor(diff / oneDay) - 1;
		var roadName = road.roadName;
		var speed = road.speed;
		var latitude = road.latitude;
		var longitude = road.longitude;
		var weatherCode = 0;
	
		var options = {
			mode: 'text',
			//scriptPath: 'path/to/my/scripts',
			args: [hour, roadName, speed, weatherCode, day]
		};
	
	
		ps.PythonShell.run('probability_calculator.py', options, function (err, results) {
			numCompleted++;
			if (err) throw err;
			// results is an array consisting of messages collected during execution
			console.log('results: %j', results);

			var rslts = results[0].split(',');

			roadProbabilities.push({ roadName: rslts[0], result: rslts[1]});
			if(numCompleted == roads.length) {
				res.send(JSON.stringify({roadProbabilities}));
			}
		});	
	}

	
	/*https.get('https://api.openweathermap.org/data/2.5/weather?lat=' + latitude + '&lon=' + longitude, (resp) => {
		let data = '';

		// A chunk of data has been recieved.
		resp.on('data', (chunk) => {
			data += chunk;
			console.log(data);
		});

		// The whole response has been received. Print out the result.
		resp.on('end', () => {
			console.log(JSON.parse(data));
		});

	}).on("error", (err) => {
		console.log("Error: " + err.message);
	});*/
});


app.listen(port, () => console.log(`Example app listening on port ${port}!`))





//REST API call example


//const https = require('https');

/* https.get('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY', (resp) => {
	let data = '';

	// A chunk of data has been recieved.
	resp.on('data', (chunk) => {
		data += chunk;
	});

	// The whole response has been received. Print out the result.
	resp.on('end', () => {
		//console.log(JSON.parse(data).explanation);
	});

}).on("error", (err) => {
	console.log("Error: " + err.message);
}); */