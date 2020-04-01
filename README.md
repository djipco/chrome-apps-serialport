# chrome-apps-serialport

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

The **chrome-apps-serialport** module also fixes a 
[long-standing issue](https://github.com/nwjs/nw.js/issues/586) in NW.js that must be dealt with in
order to successfully use the serial port. This means that, if you use this module, you do not need
to bother importing the [`nwjs-j5-fix`](https://github.com/djipco/nwjs-j5-fix) module. It will be 
taken care of for you.

## Installation

```
npm install chrome-apps-serialport
```

## Basic Usage

```js
const SerialPort = require("chrome-apps-serialport").SerialPort;

let port = new SerialPort("/dev/tty-usbserial1", {
  baudrate: 57600
});
```

## Using the module with Johnny-Five

```js
const SerialPort = require("chrome-apps-serialport").SerialPort;
const Firmata = require("firmata-io")(SerialPort);
const five = require("johnny-five");

SerialPort.list().then(ports => {

  const device = ports.find(port => {
    return port.manufacturer && port.manufacturer.startsWith("Arduino")
  });

  const board = new five.Board({
    io: new Firmata(device.path)
  });

  board.on("ready", () => {
    console.log("Johnny-Five is ready!");
    const led = new five.Led(13);
    led.blink(500);
  });

  board.on("close", () => console.log("Closed!"));

});
```

## History

The `chrome-apps-serialport` module is a repackaging of 
[`browser-serialport`](https://github.com/garrows/browser-serialport) (created by 
[Glen Arrowsmith](https://github.com/garrows)). This module was working great until API changes were 
introduced in version 8 of `node-serialport`. These changes forced dependent projects to update 
which, in turnm broke compatibility with `browser-serialport`. Since `browser-serialport` has not 
been updated in many years, I packaged `chrome-apps-serialport` to insure compatibility with the 
latest version of `node-serialport`.

## Compatibility

Unless you are using very specialized functionalities (see below), you should be able to use 
`chrome-apps-serialport` wherever `node-serialport` v8.x+ is used. Obviously, this is only true if 
you are executing the code within a Chrome App or NW.js.

Due to the underlying architecture (`chrome.serial`), there are a few differences that should be 
noted:

* The connection options are a little bit different:

    * __dataBits__: 7, 8
    * __stopBits__: 1, 2
    * __parity__: 'none', 'even', 'mark', 'odd', 'space'
    * __flowControl__: 'RTSCTS'
    * __highWaterMark__: ignored
    * __lock__: ignored
    * __xon__, __xoff__, __xany__: ignored
   
* Parsers are not implemented.

* The `read()` method is not implemented.

* The `drain()` method can be called but will not do anything. This also means that no `drain` 
events are ever dispatched.

* Only UTF8 is supported when passing strings to the `write()` method.
    
* Error messages differ.
