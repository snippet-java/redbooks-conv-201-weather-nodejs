/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests
var Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk

var app = express();

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());

// Create the service wrapper
var conversation = new Conversation({
  // If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
  // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
  // username: '<username>',
  // password: '<password>',
  url: 'https://gateway.watsonplatform.net/conversation/api',
  version_date: '2016-10-21',
  version: 'v1'
});

// Endpoint to be call from the client side
app.post('/api/message', function(req, res) {
  var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  if (!workspace || workspace === '<workspace-id>') {
    return res.json({
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    });
  }
  var payload = {
    workspace_id: workspace,
    context: req.body.context || {},
    input: req.body.input || {}
  };

  // Send the input to the conversation service
  conversation.message(payload, function(err, data) {
    if (err) {
      return res.status(err.code || 500).json(err);
    }
    updateMessage(payload, data, function(response) {
		return res.json(response);
	});
  });
});

/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Conversation service
 * @param  {Object} response The response from the Conversation service
 * @param  {Object} callback The response from Weather Company Data
 * @return {Object}          The response with the updated message
 */
function updateMessage(input, response, callback) {
    var responseText = null;
    if (!response.output) {
        response.output = {};
        callback(response);
    }
    // In case the entity is city, then get the location coordinates for the city and call Weather Company Data to get the forecast for this city.
    else if (response.entities.length > 0 && response.entities[0].entity === 'city') {
        var location = getLocationCoordinatesForCity(response.entities[0].value);
        getWeatherForecastForCity(location, function(e, weatherOutput) {
            response.output.text[0] = weatherOutput;
            callback(response);

        });
    } else {
        callback(response);
    }
}

/**
 * Get the latitude and longitude of city
 * @param  {Object} city The target city
 * @return {Object} The latitude and longitude of the city
 */
function getLocationCoordinatesForCity(city) {
    var location = {};
    if (city === 'Cairo') {
        location.latitude = '30.0444';
        location.longitude = '31.2357';
    } else if (city === 'NYC') {
        location.latitude = '40.7128';
        location.longitude = '74.0059';
    }
    return location;
}


//Weather Company Endpoint
var vcap = JSON.parse(process.env.VCAP_SERVICES);
var weatherCompanyEndpoint = vcap.weatherinsights[0].credentials.url;
var request = require('request'); // request module
/**
 * Get the weather forecast for a city through calling Weather Company Data
 * @param  {Object} city The target city
 * @return {Object} Weather Forecast for the specified city.
 */
function getWeatherForecastForCity(location, callback) {
    var options = {
        url: weatherCompanyEndpoint + '/api/weather/v1/geocode/' + location.latitude + '/' + location.longitude + '/forecast/daily/3day.json'
    };
    request(
        options,
        function(error, response, body) {
            try {
                var json = JSON.parse(body);
                var weatherOutput = json.forecasts[1].narrative;
                callback(null, weatherOutput);
            } catch (e) {
                callback(e, null);
            }
        }
    );
};

module.exports = app;
