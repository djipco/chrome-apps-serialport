# chrome-apps-serialport

## Introduction

The **chrome-apps-serialport** JavaScript module is a 
[Chrome Apps](https://developer.chrome.com/apps/)-compatible implementation of the 
[`node-serialport`](https://serialport.io/) module used for serial communication.

This library was created to provide Chrome Apps (including NW.js) interoperability for libraries 
already depending on the `node-serialport` module for serial communication (e.g. `johnny-five`, 
`firmata`, etc.). 


## NW.js Support

The main use case for this library is to simplify usage of Johnny-Five and Firmata inside NW.js. 
While `node-serialport` can be used within NW.js, it needs to be specifically recompiled. This can
prove to be troublesome. This library bypasses this problem by using the `chrome.serial` API which
is already available in NW.js (via the builtin support for the Chrome Apps APIs).

## History

The `chrome-apps-serialport` module is a repackaging of 
[`browser-serialport`](https://github.com/garrows/browser-serialport) (created by Glen Arrowsmith). 
This module was working great until API changes were introduced in version 8 of `node-serialport`. 
These changes forced dependent projects to update which, in turnm broke compatibility with 
`browser-serialport`. Since `browser-serialport` has not been updated in many years, I created
`chrome-apps-serialport` to insure compatibility with the latest version of `node-serialport` 
(while remaining backwards-compatible).

## Compatibility

You should be able to use `chrome-apps-serialport` wherever `node-serialport` is used as long as 
you are within a Chrome App or NW.js. The library does have a shortcoming:

* Parsers are not implemented

There are also a few subtle differences: 

* The options are different:

    * __dataBits__: 7, 8
    * __stopBits__: 1, 2
    * __parity__: 'none', 'even', 'mark', 'odd', 'space'
    * __flowControl__: 'RTSCTS'
    
* Error messages differ

## Installation

```
npm install chrome-apps-serialport
```

## Usage

```js
const SerialPort = require("chrome-apps-serialport").SerialPort;

let port = new SerialPort("/dev/tty-usbserial1", {
  baudrate: 57600
});
```
