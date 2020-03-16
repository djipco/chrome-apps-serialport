const EE = require("events").EventEmitter;
const util = require("util");

if (process && process.versions.nw && parseFloat(process.versions.nw) >= 0.13) {
  require("nwjs-j5-fix").fix(); // Fix issue with streams in NW.js
}

const DATABITS = [7, 8];
const STOPBITS = [1, 2];
const PARITY = ["none", "even", "mark", "odd", "space"];
const FLOWCONTROLS = ["RTSCTS"];

const _options = {
  baudrate: 9600,
  parity: "none",
  rtscts: false,
  databits: 8,
  stopbits: 1,
  buffersize: 256
};

function convertOptions(options){
  switch (options.dataBits) {
    case 7:
      options.dataBits = "seven";
      break;
    case 8:
      options.dataBits = "eight";
      break;
  }

  switch (options.stopBits) {
    case 1:
      options.stopBits = "one";
      break;
    case 2:
      options.stopBits = "two";
      break;
  }

  switch (options.parity) {
    case "none":
      options.parity = "no";
      break;
  }

  return options;
}

function SerialPort(path, options, callback) {

  EE.call(this);

  let self = this;

  let args = Array.prototype.slice.call(arguments);
  callback = args.pop();
  if (typeof(callback) !== "function") {
    callback = null;
  }

  options = (typeof options !== "function") && options || {};

  if (options.autoOpen === undefined || options.autoOpen === null) {
    options.autoOpen = true;
  }

  callback = callback || function (err) {
    if (err) {
      self.emit("error", err);
    }
  };

  let err;

  options.baudRate = options.baudRate || options.baudrate || _options.baudrate;

  options.dataBits = options.dataBits || options.databits || _options.databits;
  if (DATABITS.indexOf(options.dataBits) === -1) {
    err = new Error("Invalid \"databits\": " + options.dataBits);
    callback(err);
    return;
  }

  options.stopBits = options.stopBits || options.stopbits || _options.stopbits;
  if (STOPBITS.indexOf(options.stopBits) === -1) {
    err = new Error("Invalid \"stopbits\": " + options.stopbits);
    callback(err);
    return;
  }

  options.parity = options.parity || _options.parity;
  if (PARITY.indexOf(options.parity) === -1) {
    err = new Error("Invalid \"parity\": " + options.parity);
    callback(err);
    return;
  }

  if (!path) {
    err = new Error("Invalid port specified: " + path);
    callback(err);
    return;
  }

  options.rtscts = _options.rtscts;

  if (options.flowControl || options.flowcontrol) {
    let fc = options.flowControl || options.flowcontrol;

    if (typeof fc === "boolean") {
      options.rtscts = true;
    } else {
      let clean = fc.every(function (flowControl) {
        let fcup = flowControl.toUpperCase();
        let idx = FLOWCONTROLS.indexOf(fcup);
        if (idx < 0) {
          let err = new Error("Invalid \"flowControl\": " + fcup + ". Valid options: " +
            FLOWCONTROLS.join("", ""));
          callback(err);
          return false;
        } else {

          // "XON", "XOFF", "XANY", "DTRDTS", "RTSCTS"
          switch (idx) {
            case 0: options.rtscts = true; break;
          }
          return true;
        }
      });
      if(!clean){
        return;
      }
    }
  }

  options.bufferSize = options.bufferSize || options.buffersize || _options.buffersize;

  // defaults to chrome.serial if no options.serial passed
  // inlined instead of on _options to allow mocking global chrome.serial for optional options test
  options.serial = options.serial || (typeof chrome !== "undefined" && chrome.serial);

  if (!options.serial) {
    throw new Error("No access to serial ports. Try loading as a Chrome Application.");
  }

  this.options = convertOptions(options);

  this.options.serial.onReceiveError.addListener(function(info){

    switch (info.error) {

      case "disconnected":
      case "device_lost":
      case "system_error":
        err = new Error("Disconnected");
        // send notification of disconnect
        if (self.options.disconnectedCallback) {
          self.options.disconnectedCallback(err);
        } else {
          self.emit("disconnect", err);
        }
        if(self.connectionId >= 0){
          self.close();
        }
        break;
    }

  });

  this.path = path;
  this.isOpen = false;
  this.baudRate = this.options.baudRate;

  if (options.autoOpen) {
    process.nextTick(function () {
      self.open(callback);
    });
  }

}

util.inherits(SerialPort, EE);

SerialPort.prototype.connectionId = -1;

SerialPort.prototype.open = function (callback) {

  let options = {
    bitrate: parseInt(this.options.baudRate, 10),
    dataBits: this.options.dataBits,
    parityBit: this.options.parity,
    stopBits: this.options.stopBits,
    ctsFlowControl: this.options.rtscts
  };

  this.options.serial.connect(this.path, options, this.proxy("onOpen", callback));

};

SerialPort.prototype.onOpen = function (callback, openInfo) {
  if(chrome.runtime.lastError){
    if(typeof callback === "function"){
      callback(chrome.runtime.lastError);
    }else{
      this.emit("error", chrome.runtime.lastError);
    }
    return;
  }

  this.connectionId = openInfo.connectionId;

  if (this.connectionId === -1) {
    this.emit("error", new Error("Could not open port."));
    return;
  }

  this.isOpen = true;
  this.emit("open", openInfo);

  this._reader = this.proxy("onRead");

  this.options.serial.onReceive.addListener(this._reader);

  if(typeof callback === "function"){
    callback(chrome.runtime.lastError, openInfo);
  }
};

SerialPort.prototype.onRead = function (readInfo) {
  if (readInfo && this.connectionId === readInfo.connectionId) {

    if (this.options.dataCallback) {
      this.options.dataCallback(toBuffer(readInfo.data));
    } else {
      this.emit("data", toBuffer(readInfo.data));
    }

  }
};

SerialPort.prototype.write = function (buffer, encoding = "utf8", callback = () => {}) {
  if (this.connectionId < 0) {
    let err = new Error("Serialport not open.");
    this.isOpen = false;
    if(typeof callback === "function"){
      callback(err);
    }else{
      this.emit("error", err);
    }
    return;
  }

  if (typeof buffer === "string") {
    buffer = str2ab(buffer);
  }

  if (encoding !== "utf8") console.warn("Only utf8 encoding is supported for strings.");

  //Make sure its not a browserify faux Buffer.
  if (!(buffer instanceof ArrayBuffer)) {
    buffer = buffer2ArrayBuffer(buffer);
  }

  this.options.serial.send(this.connectionId, buffer, function(info) {
    if (typeof callback === "function") {
      callback(chrome.runtime.lastError, info);
    }
  });
};


SerialPort.prototype.close = function (callback) {
  if (this.connectionId < 0) {
    this.isOpen = false;
    let err = new Error("Serialport not open.");
    if(typeof callback === "function"){
      callback(err);
    }else{
      this.emit("error", err);
    }
    return;
  }

  this.options.serial.disconnect(this.connectionId, this.proxy("onClose", callback));
};

SerialPort.prototype.onClose = function (callback, result) {
  this.connectionId = -1;
  this.isOpen = false;
  this.emit("close");

  this.removeAllListeners();
  if(this._reader){
    this.options.serial.onReceive.removeListener(this._reader);
    this._reader = null;
  }

  if (typeof callback === "function") {
    callback(chrome.runtime.lastError, result);
  }
};

SerialPort.prototype.flush = function (callback) {
  if (this.connectionId < 0) {
    this.isOpen = false;
    let err = new Error("Serialport not open.");
    if(typeof callback === "function"){
      callback(err);
    }else{
      this.emit("error", err);
    }
    return;
  }

  let self = this;

  this.options.serial.flush(this.connectionId, function(result) {
    if (chrome.runtime.lastError) {
      if (typeof callback === "function") {
        callback(chrome.runtime.lastError, result);
      } else {
        self.emit("error", chrome.runtime.lastError);
      }
    } else {
      callback(null, result);
    }
  });
};

SerialPort.prototype.drain = function (callback) {

  if (this.connectionId < 0) {
    this.isOpen = false;
    let err = new Error("Serialport not open.");
    if (typeof callback === "function") {
      callback(err);
    } else {
      this.emit("error", err);
    }
    return;
  }

  if (typeof callback === "function") {
    callback();
  }

};

SerialPort.prototype.pause = function (callback) {

  if (this.connectionId < 0) {
    this.isOpen = false;
    let err = new Error("Serialport not open.");
    if (typeof callback === "function") {
      callback(err);
    } else {
      this.emit("error", err);
    }
    return;
  }

  this.options.serial.setPaused(this.connectionId, true, callback);

};

SerialPort.prototype.resume = function (callback) {

  if (this.connectionId < 0) {
    this.isOpen = false;
    let err = new Error("Serialport not open.");
    if (typeof callback === "function") {
      callback(err);
    } else {
      this.emit("error", err);
    }
    return;
  }

  this.options.serial.setPaused(this.connectionId, false, callback);

};

SerialPort.prototype.update = function (options = {}, callback = () => {}) {

  if (this.connectionId < 0) {
    this.isOpen = false;
    let err = new Error("Serialport not open.");
    if (typeof callback === "function") {
      callback(err);
    } else {
      this.emit("error", err);
    }
    return;
  }

  this.options.serial.update(this.connectionId, {bitrate: options.baudRate}, callback);

};


SerialPort.prototype.proxy = function () {
  let self = this;
  let proxyArgs = [];

  //arguments isnt actually an array.
  for (let i = 0; i < arguments.length; i++) {
    proxyArgs[i] = arguments[i];
  }

  let functionName = proxyArgs.splice(0, 1)[0];

  return function() {
    let funcArgs = [];
    for (let i = 0; i < arguments.length; i++) {
      funcArgs[i] = arguments[i];
    }
    let allArgs = proxyArgs.concat(funcArgs);

    self[functionName].apply(self, allArgs);
  };

};

SerialPort.prototype.set = function (options, callback) {
  this.options.serial.setControlSignals(this.connectionId, options, function(result){
    callback(chrome.runtime.lastError, result);
  });
};

SerialPort.prototype.get = function (options, callback) {
  this.options.serial.getControlSignals(this.connectionId, function(signals){
    callback(chrome.runtime.lastError, signals);
  });
};

SerialPort.list = async function(callback) {

  if (typeof chrome != "undefined" && chrome.serial) {

    return new Promise(resolve => {

      chrome.serial.getDevices(function(ports) {

        let portObjects = new Array(ports.length);

        for (let i = 0; i < ports.length; i++) {
          portObjects[i] = {
            comName: ports[i].path, // backwards-compatibility with older versions of serialport
            path: ports[i].path,
            manufacturer: ports[i].displayName,
            serialNumber: "",
            pnpId: "",
            locationId:"",
            vendorId: "0x" + (ports[i].vendorId||0).toString(16),
            productId: "0x" + (ports[i].productId||0).toString(16)
          };
        }

        if (typeof callback === "function") callback(chrome.runtime.lastError, portObjects);
        resolve(portObjects);

      });

    });

  } else {
    let error = new Error("No access to serial ports. Try loading as a Chrome Application.");
    callback(error, null);
    return Promise.reject(error);
  }

};

// Convert string to ArrayBuffer
function str2ab(str) {
  let buf = new ArrayBuffer(str.length);
  let bufView = new Uint8Array(buf);
  for (let i = 0; i < str.length; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

// Convert buffer to ArrayBuffer
function buffer2ArrayBuffer(buffer) {
  let buf = new ArrayBuffer(buffer.length);
  let bufView = new Uint8Array(buf);
  for (let i = 0; i < buffer.length; i++) {
    bufView[i] = buffer[i];
  }
  return buf;
}

function toBuffer(ab) {
  let buffer = new Buffer(ab.byteLength);
  let view = new Uint8Array(ab);
  for (let i = 0; i < buffer.length; ++i) {
    buffer[i] = view[i];
  }
  return buffer;
}

module.exports = {
  SerialPort: SerialPort,
  list: SerialPort.list, // this is for backwards-compatibility
  buffer2ArrayBuffer: buffer2ArrayBuffer,
  used: [] //Populate this somewhere!!
};
