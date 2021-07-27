import mqtt from "mqtt";
import {MQTT_URL} from "./consts";
import {randomString} from "./tools";

class MqttMsg {
    constructor() {
        this.user = null;
        this.mq = null;
        this.connected = false;
        this.room = null;
        this.token = null;
    }

    init = (user, callback) => {
        this.user = user;

        const transformUrl = (url, options, client) => {
            client.options.password = this.token;
            return url;
        };

        let options = {
            keepalive: 10,
            connectTimeout: 10 * 1000,
            clientId: user.id + "-" + randomString(3),
            protocolId: "MQTT",
            protocolVersion: 5,
            clean: true,
            username: user.email,
            password: this.token,
            transformWsUrl: transformUrl,
            properties: {
                sessionExpiryInterval: 5,
                maximumPacketSize: 10000,
                requestResponseInformation: true,
                requestProblemInformation: true,
            },
        };

        this.mq = mqtt.connect(`wss://${MQTT_URL}`, options);

        this.mq.on("connect", (data) => {
            if (data && !this.connected) {
                console.log("[mqtt] Connected to server: ", data);
                this.connected = true;
                callback(data);
            }
        });

        this.mq.on("error", (data) => console.error("[mqtt] Error: ", data));
        this.mq.on("disconnect", (data) => console.error("[mqtt] Error: ", data));
    };

    join = (topic, chat) => {
        if (!this.mq) return;
        console.log("[mqtt] Subscribe to: ", topic);
        let options = chat ? {qos: 0, nl: false} : {qos: 2, nl: true};
        this.mq.subscribe(topic, {...options}, (err) => {
            err && console.error("[mqtt] Error: ", err);
        });
    };

    exit = (topic) => {
        if (!this.mq) return;
        let options = {};
        console.log("[mqtt] Unsubscribe from: ", topic);
        this.mq.unsubscribe(topic, {...options}, (err) => {
            err && console.error("[mqtt] Error: ", err);
        });
    };

    send = (message, retain, topic) => {
        if (!this.mq) return;
        console.log("[mqtt] Send data on topic: ", topic, message);
        let options = {qos: 2, retain, properties: {messageExpiryInterval: 0, userProperties: this.user}};
        this.mq.publish(topic, message, {...options}, (err) => {
            err && console.error("[mqtt] Error: ", err);
        });
    };

    watch = (callback, stat) => {
        let message;
        this.mq.on("message", (topic, data, packet) => {
            console.debug("[mqtt] Got data on topic: ", topic);
            if (/trl\/room\/\d+\/chat/.test(topic)) {
                this.mq.emit("MqttChatEvent", data);
            } else if (/trl\/users\//.test(topic)) {
                if (topic.split("/")[2] === "broadcast") {
                    this.mq.emit("MqttBroadcastMessage", data);
                } else {
                    this.mq.emit("MqttPrivateMessage", data);
                }
            } else {
                if (stat) {
                    message = data.toString();
                } else {
                    try {
                        message = JSON.parse(data.toString());
                    } catch (e) {
                        console.error(e);
                        console.error("[mqtt] Not valid JSON, ", data.toString());
                        return;
                    }
                }
                console.log("[mqtt] Got data on topic: ", topic, message);
                callback(message, topic);
            }
        });
    };

    setToken = (token) => {
        this.token = token;
    };
}

const defaultMqtt = new MqttMsg();

export default defaultMqtt;
