const WebSocket = require('ws');
const fs = require('fs');

const prompt = require('prompt');
prompt.get([
    {
        description: "Port number for this websocket server",
        pattern: /^\d+$/,
        message: 'Must be a number',
        name: 'port',
        required: true,
        default: "49322",
    },
], function (e, r) {
  const WsSubscribers = {
      __subscribers: {},
      websocket: undefined,
      webSocketConnected: false,
      registerQueue: [],
      init: function (port, debug, debugFilters) {
        port = r.port || 49322;
        debug = debug || false;
        if (debug) {
          if (debugFilters !== undefined) {
            console.warn(
              "WebSocket Debug Mode enabled with filtering. Only events not in the filter list will be dumped"
            );
          } else {
            console.warn(
              "WebSocket Debug Mode enabled without filters applied. All events will be dumped to console"
            );
            console.warn(
              "To use filters, pass in an array of 'channel:event' strings to the second parameter of the init function"
            );
          }
        }
        WsSubscribers.webSocket = new WebSocket("ws://localhost:" + port);
        WsSubscribers.webSocket.onmessage = function (event) {
          let jEvent = JSON.parse(event.data);
          if (!jEvent.hasOwnProperty("event")) {
            return;
          }
          let eventSplit = jEvent.event.split(":");
          let channel = eventSplit[0];
          let event_event = eventSplit[1];
          if (debug) {
            if (!debugFilters) {
              // console.log(channel, event_event, jEvent);
            } else if (
              debugFilters &&
              debugFilters.indexOf(jEvent.event) < 0
            ) {
              // console.log(channel, event_event, jEvent);
            }
          }
          WsSubscribers.triggerSubscribers(channel, event_event, jEvent.data);
        };
        WsSubscribers.webSocket.onopen = function () {
          WsSubscribers.triggerSubscribers("ws", "open");
          WsSubscribers.webSocketConnected = true;
          WsSubscribers.registerQueue.forEach((r) => {
            WsSubscribers.send("wsRelay", "register", r);
          });
          WsSubscribers.registerQueue = [];
        };
        WsSubscribers.webSocket.onerror = function () {
          WsSubscribers.triggerSubscribers("ws", "error");
          WsSubscribers.webSocketConnected = false;
        };
        WsSubscribers.webSocket.onclose = function () {
          WsSubscribers.triggerSubscribers("ws", "close");
          WsSubscribers.webSocketConnected = false;
        };
      },
      subscribe: function (channels, events, callback) {
        if (typeof channels === "string") {
          let channel = channels;
          channels = [];
          channels.push(channel);
        }
        if (typeof events === "string") {
          let event = events;
          events = [];
          events.push(event);
        }
        channels.forEach(function (c) {
          events.forEach(function (e) {
            if (!WsSubscribers.__subscribers.hasOwnProperty(c)) {
              WsSubscribers.__subscribers[c] = {};
            }
            if (!WsSubscribers.__subscribers[c].hasOwnProperty(e)) {
              WsSubscribers.__subscribers[c][e] = [];
              if (WsSubscribers.webSocketConnected) {
                WsSubscribers.send("wsRelay", "register", `${c}:${e}`);
              } else {
                WsSubscribers.registerQueue.push(`${c}:${e}`);
              }
            }
            WsSubscribers.__subscribers[c][e].push(callback);
          });
        });
      },
      clearEventCallbacks: function (channel, event) {
        if (
          WsSubscribers.__subscribers.hasOwnProperty(channel) &&
          WsSubscribers.__subscribers[channel].hasOwnProperty(event)
        ) {
          WsSubscribers.__subscribers[channel] = {};
        }
      },
      triggerSubscribers: function (channel, event, data) {
        if (
          WsSubscribers.__subscribers.hasOwnProperty(channel) &&
          WsSubscribers.__subscribers[channel].hasOwnProperty(event)
        ) {
          WsSubscribers.__subscribers[channel][event].forEach(function (
            callback
          ) {
            if (callback instanceof Function) {
              callback(data);
            }
          });
        }
      },
      send: function (channel, event, data) {
        if (typeof channel !== "string") {
          console.error("Channel must be a string");
          return;
        }
        if (typeof event !== "string") {
          console.error("Event must be a string");
          return;
        }
        if (channel === "local") {
          this.triggerSubscribers(channel, event, data);
        } else {
          let cEvent = channel + ":" + event;
          WsSubscribers.webSocket.send(
            JSON.stringify({
              event: cEvent,
              data: data,
            })
          );
        }
      },
    };

  ///acquire team name and current score
    console.log('initializing websockets...')
    WsSubscribers.init(r.port || 49322, true);
    WsSubscribers.subscribe("game", "update_state", (data) => {
      console.log('got some state yooooo')
      console.log(data)
      console.log(data[0])
      if (!data[0]) {
        return;
      }

      data[0].teams = {
        "team_0": {
          "name": data[0].game.teams[0].name,
          "players": []
        },
        "team_1": {
          "name": data[0].game.teams[1].name,
          "players": []
        }
      }
      const players = data[0].players;
      Object.keys( players ).forEach((key) => {
        if (players[key].team === 0) {
          data[0].teams["team_0"].players.push(players[key]);
        } else {
          data[0].teams["team_1"].players.push(players[key]);
        }
      })

      // json stuff
      const jsonData = JSON.stringify([
        data
      ])
      try {
        console.log("writing data...");
        fs.writeFileSync('./json-data/game.json', jsonData);
        console.log("no error.");
      } catch(e) {
        console.log('Error writing json:' + e.message)
      }

      return false;
    });
})
