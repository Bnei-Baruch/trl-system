import mqtt from 'mqtt';
import {MKZ_MQTT_URL, TRL_MQTT_URL, WE_MQTT_URL} from "./consts";
import {randomString} from "./tools";
import log from "loglevel";

const mqttTimeout = 5 // Seconds
const mqttKeepalive = 2 // Seconds

class MqttMsg {
    constructor() {
        this.user = null;
        this.mq = null;
        this.isConnected = false;
        this.room = null;
        this.token = null;
        this.reconnect_count = 0;
    }

    init = (app, user, callback) => {
        this.user = user;
        const RC = mqttTimeout;

        const transformUrl = (url, options, client) => {
            client.options.password = this.token;
            return url;
        };

        let options = {
            keepalive: mqttKeepalive,
            clientId: user.id + "-" + randomString(3),
            protocolId: "MQTT",
            protocolVersion: 5,
            clean: true,
            username: user.email,
            password: this.token,
            transformWsUrl: transformUrl,
            properties: {
                sessionExpiryInterval: 5,
                maximumPacketSize: 256000,
                requestResponseInformation: true,
                requestProblemInformation: true,
            },
        };

        let url = app === "trl" ? MKZ_MQTT_URL : app === "trl1" ? TRL_MQTT_URL : WE_MQTT_URL;
        this.mq = mqtt.connect(`wss://${url}`, options);
        this.mq.setMaxListeners(50)

        this.mq.on("connect", (data) => {
            if (data && !this.isConnected) {
                log.info('[mqtt] Connected to server: ', data);
                this.isConnected = true;
                if(typeof callback === "function") callback(false, false);
            } else {
                log.info("[mqtt] Connected: ", data);
                this.isConnected = true;
                if(this.reconnect_count > RC) {
                    if(typeof callback === "function") callback(true, false);
                }
                this.reconnect_count = 0;
            }
        });

        this.mq.on("close", () => {
            if(this.reconnect_count < RC + 2) {
                this.reconnect_count++;
                log.debug("[mqtt] reconnecting counter: " + this.reconnect_count)
            }
            if(this.reconnect_count === RC) {
                this.reconnect_count++;
                log.warn("[mqtt] - disconnected - after: " + this.reconnect_count + " seconds")
                if(typeof callback === "function") callback(false, true);
            }
        });

    };

    join = (topic, chat) => {
        if (!this.mq) return;
        log.info("[mqtt] Subscribe to: ", topic);
        let options = chat ? {qos: 0, nl: false} : {qos: 1, nl: true};
        this.mq.subscribe(topic, {...options}, (err) => {
            err && log.error("[mqtt] Error: ", err);
        });
    };

    exit = (topic) => {
        if (!this.mq) return;
        let options = {};
        log.info("[mqtt] Unsubscribe from: ", topic);
        this.mq.unsubscribe(topic, {...options}, (err) => {
            err && log.error("[mqtt] Error: ", err);
        });
    };

    send = (message, retain, topic, rxTopic, user) => {
        if (!this.mq) return;
        let correlationData = JSON.parse(message)?.transaction
        let cd = correlationData ? " | transaction: " + correlationData : ""
        log.debug("%c[mqtt] --> send message" + cd + " | topic: " + topic + " | data: " + message, "color: darkgrey");
        let properties = !!rxTopic ? {userProperties: user || this.user, responseTopic: rxTopic, correlationData} : {userProperties: user || this.user};
        let options = {qos: 1, retain, properties};
        this.mq.publish(topic, message, {...options}, (err) => {
            err && log.error("[mqtt] Error: ", err);
        });
    };

    watch = (callback) => {
        this.mq.on("message", (topic, data, packet) => {
            log.trace("[mqtt] <-- receive packet: ", packet)
            let cd = packet?.properties?.correlationData ? " | transaction: " + packet?.properties?.correlationData?.toString() : ""
            log.debug("%c[mqtt] <-- receive message" + cd + " | topic : " + topic, "color: darkgrey");
            const t = topic.split("/")
            if(t[0] === "msg") t.shift()
            const [root, service, id, target] = t
            switch(root) {
                case "trl":
                    if(service === "room" && target === "chat")
                        this.mq.emit("MqttChatEvent", data);
                    else if (service === "room" && target !== "chat" || service === "service" && id !== "user")
                        callback(JSON.parse(data.toString()), topic);
                    else if (service === "users" && id === "broadcast")
                        this.mq.emit("MqttBroadcastMessage", data);
                    else
                        this.mq.emit("MqttPrivateMessage", data);
                    break;
                case "janus":
                    const json = JSON.parse(data)
                    const mit = json?.session_id || packet?.properties?.userProperties?.mit || service
                    this.mq.emit(mit, data, id);
                    break;
                default:
                    if(typeof callback === "function")
                        callback(JSON.parse(data.toString()), topic);
            }
        });
    };

    setToken = (token) => {
        this.token = token;
    };
}

const defaultMqtt = new MqttMsg();

export default defaultMqtt;
