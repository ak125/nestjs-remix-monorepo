// Test preload: fails on any attempted transport, including with credentials set.
const deny = () => {
  throw new Error("SIMULATION_NETWORK_ATTEMPT");
};
require("node:net").Socket.prototype.connect = deny;
require("node:tls").connect = deny;
require("node:dgram").createSocket = deny;
require("node:http").request = deny;
require("node:http").get = deny;
require("node:https").request = deny;
require("node:https").get = deny;
globalThis.fetch = deny;
