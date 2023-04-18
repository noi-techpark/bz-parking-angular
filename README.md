# Depreacted
The web app has been reimplemented here  
https://github.com/noi-techpark/parking-app/

It is visible at the following domains  
https://parking.bz.it/  
https://parking.opendatahub.com/  

# bz-parking-angular
This is an angular client, which is a Data Consumer for the Parking API of the Open Data Hub project. It is used to visualize parking data on https://www.parking.bz.it

[![CI/CD](https://github.com/noi-techpark/bz-parking-angular/actions/workflows/main.yml/badge.svg)](https://github.com/noi-techpark/bz-parking-angular/actions/workflows/main.yml)

## URL parameters

The website supports URL parameters also called query strings, which are part of the website URL following a question mark (?). The website supports the following URL parameters:

### location

The <code>location</code> paramenter forces the website to show data from a specific location, like for example <code>location=merano</code> will force the website to show the data of the City of Merano. The complete URL would be https://parking.bz.it/?location=merano

Supported location values are:
- "bozen" or "bolzano" (default, which gets shown without any location parameter)
- "meran" or "merano"
- "rovereto"
- "trento"

## Testing

For local testing, simply open the index.html file with its absolute path in your browser.

To test features like matomo it has to be run from a server on localhost.
