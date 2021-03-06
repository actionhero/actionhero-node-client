import * as net from "net";
import * as tls from "tls";
import * as util from "util";
import * as uuid from "uuid";
import { EventEmitter } from "events";

export type ActionHeroNodeClientParams = {
  host?: string;
  port?: number;
  secure?: boolean;
  delimiter?: string;
  logLength?: number;
  timeout?: number;
  reconnectTimeout?: number;
  reconnectAttempts?: number;
};

export default class ActionheroNodeClient extends EventEmitter {
  id: string;
  connected: boolean;
  connection: NodeJS.Socket;
  params: ActionHeroNodeClientParams;
  details: { [key: string]: string | number | boolean };
  lastLine: { [key: string]: any };
  stream: string;
  log: Array<{ timestamp: Date; data: any }>;
  reconnectAttempts: number;
  expectedResponses: { [key: string]: Function };
  responseTimeouts: { [key: string]: NodeJS.Timeout };
  startingTimeStamps: { [key: string]: number };
  sending: boolean;

  constructor() {
    super();

    this.id = null;
    this.connected = false;
    this.connection = null;
    this.params = {
      host: "127.0.0.1",
      port: 5000,
      delimiter: "\r\n",
      logLength: 10,
      secure: false,
      timeout: 5000,
      reconnectTimeout: 1000,
      reconnectAttempts: 10,
    };
    this.details = null;
    this.lastLine = null;
    this.stream = "";
    this.log = [];
    this.reconnectAttempts = 0;
    this.expectedResponses = {};
    this.startingTimeStamps = {};
    this.responseTimeouts = {};
    this.sending = false;
  }

  async connect(params?: ActionHeroNodeClientParams) {
    if (this.connection) {
      delete this.connection;
    }

    if (params) {
      for (const k in params) {
        this.params[k] = params[k];
      }
    }

    await new Promise((resolve) => {
      if (this.params.secure === true) {
        this.connection = tls.connect(this.params.port, this.params.host);
      } else {
        this.connection = net.connect(this.params.port, this.params.host);
      }
      this.connection.setEncoding("utf8");

      this.connection.on("data", (chunk) => {
        this.emit("rawData", String(chunk));
        this.stream += String(chunk);
        let delimited = false;
        if (this.stream.indexOf(this.params.delimiter) >= 0) {
          delimited = true;
        }

        if (delimited === true) {
          try {
            const lines = this.stream.split(this.params.delimiter);
            for (const j in lines) {
              const line = lines[j];
              if (line.length > 0) {
                this.handleData(line);
              }
            }
            this.stream = "";
          } catch (e) {
            this.lastLine = null;
          }
        }
      });

      this.connection.on("connect", async (error) => {
        if (error) this.emit("error", error);

        this.connected = true;
        this.reconnectAttempts = 0;
        await this.detailsView();
        this.emit("connected");
        return resolve(null);
      });

      this.connection.on("error", (error) => {
        this.emit("error", error);
        this.reconnect();
      });

      this.connection.on("end", () => {
        if (this.connected) {
          this.connected = false;
        }
        this.emit("end");
        this.connection.removeAllListeners("data");
        this.connection.removeAllListeners("error");
        this.connection.removeAllListeners("end");
        this.reconnect();
      });
    });

    return this.details;
  }

  async reconnect() {
    this.reconnectAttempts++;

    if (this.reconnectAttempts > this.params.reconnectAttempts) {
      this.emit("error", new Error("maximin reconnectAttempts reached"));
    } else if (
      this.connected === false &&
      this.params.reconnectTimeout &&
      this.params.reconnectTimeout > 0
    ) {
      await util.promisify(setTimeout)(this.params.reconnectTimeout);
      return this.connect();
    }
  }

  async disconnect() {
    this.connected = null;
    this.send("exit");
    return util.promisify(setTimeout)(10);
  }

  handleData(dataLine: string) {
    let line: {};
    try {
      line = JSON.parse(dataLine);
      this.lastLine = line;
    } catch (e) {
      return this.emit("error", e, dataLine);
    }

    this.emit("data", line);
    this.addLog(line);

    // welcome message; indicates successful connection
    if (line["context"] === "api" && line["welcome"]) {
      return this.emit("welcome", line["welcome"]);
    }

    // "say" messages from other users
    if (line["context"] === "user") {
      return this.emit("say", {
        timeStamp: new Date(),
        message: line["message"],
        from: line["from"],
      });
    }

    // responses to your actions
    if (line["context"] === "response") {
      const resolveResponse = this.expectedResponses[line["messageId"]];
      if (resolveResponse) {
        clearTimeout(this.responseTimeouts[line["messageId"]]);
        const delta =
          new Date().getTime() - this.startingTimeStamps[line["messageId"]];

        let error = null;
        if (line["error"]) {
          error = new Error(line["error"]);
        } else if (line["status"] && line["status"] !== "OK") {
          error = new Error(line["status"]);
        }

        resolveResponse({ error, data: line, delta });

        delete this.expectedResponses[line["messageId"]];
        delete this.startingTimeStamps[line["messageId"]];
        delete this.responseTimeouts[line["messageId"]];
      }
    }
  }

  send(string: string) {
    this.connection.write(string + "\r\n");
  }

  async sleep(time: number) {
    await new Promise((resolve) => {
      setTimeout(resolve, time);
    });
  }

  async awaitServerResponse(msg) {
    if (this.sending) {
      await this.sleep(10);
      return this.awaitServerResponse(msg);
    } else {
      if (!this.connected) {
        throw new Error("Not Connected");
      }
      this.sending = true;

      const messageId = uuid.v4();
      let response;
      try {
        this.send(`paramAdd messageId=${messageId}`);
        await this.sleep(1);
        this.send(msg);

        response = await new Promise((resolve, reject) => {
          this.expectedResponses[messageId] = resolve;
          this.startingTimeStamps[messageId] = new Date().getTime();
          this.responseTimeouts[messageId] = setTimeout(() => {
            delete this.expectedResponses[messageId];
            delete this.startingTimeStamps[messageId];
            delete this.expectedResponses[messageId];
            this.emit("timeout", msg);
            reject(new Error(`Timeout reached (${msg})`));
          }, this.params.timeout);
        });
      } finally {
        this.sending = false;
      }

      return response;
    }
  }

  async paramAdd(key: string, value: string) {
    if (!key) throw new Error("key is required");
    if (!value) throw new Error("value is required");

    return this.awaitServerResponse(`paramAdd ${key}=${value}`);
  }

  async paramDelete(key: string) {
    if (!key) throw new Error("key is required");

    return this.awaitServerResponse(`paramDelete ${key}`);
  }

  async paramsDelete() {
    return this.awaitServerResponse("paramsDelete");
  }

  async paramView(k: string) {
    return this.awaitServerResponse(`paramView ${k}`);
  }

  async paramsView() {
    return this.awaitServerResponse("paramsView");
  }

  async detailsView() {
    const details = await this.awaitServerResponse("detailsView");
    this.details = details.data;
    this.id = details.data.data.id;
    return details.data;
  }

  async roomAdd(room: string) {
    if (!room) throw new Error("room is required");

    return this.awaitServerResponse(`roomAdd ${room}`);
  }

  async roomLeave(room: string) {
    if (!room) throw new Error("room is required");

    return this.awaitServerResponse(`roomLeave ${room}`);
  }

  async roomView(room: string) {
    if (!room) throw new Error("room is required");

    return this.awaitServerResponse(`roomView ${room}`);
  }

  async say(room: string, message: string) {
    if (!room) throw new Error("room is required");
    if (!message) throw new Error("message is required");

    return this.awaitServerResponse(`say ${room} ${message}`);
  }

  async action(action: string) {
    if (!action) throw new Error("action is required");

    return this.awaitServerResponse(action);
  }

  async actionWithParams(action: string, params: { [key: string]: any }) {
    if (!action) throw new Error("action is required");
    if (!params) throw new Error("params are required");

    return this.awaitServerResponse(JSON.stringify({ action, params }));
  }

  async file(file: string) {
    if (!file) throw new Error("file is required");

    this.awaitServerResponse(`file ${file}`);
  }

  addLog(entry: any) {
    this.log.push({
      timestamp: new Date(),
      data: entry,
    });

    while (this.log.length > this.params.logLength) {
      this.log.splice(0, 1);
    }
  }
}
