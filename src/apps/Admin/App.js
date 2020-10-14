import React, { Component } from 'react';
import platform from "platform";
import { Janus } from "../../lib/janus";
import {Segment, Menu, Button, Input, Table, Grid, Message, Select, Icon, Popup, List, Tab, Label, Confirm, Header} from "semantic-ui-react";
import {initJanus, initChatRoom, getDateString, joinChatRoom, getPublisherInfo, notifyMe} from "../../shared/tools";
import './App.css';
import {SECRET} from "../../shared/consts";
import {initGxyProtocol,sendProtocolMessage} from "../../shared/protocol";
import {kc} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import VolumeSlider from "../../components/VolumeSlider";

class TrlAdmin extends Component {

    state = {
        bitrate: 150000,
        chatroom: null,
        forwarders: [],
        groups: [],
        janus: null,
        feeds: {},
        rooms: [],
        feed_id: null,
        feed_user: null,
        feed_info: null,
        feed_talk: false,
        feed_rtcp: {},
        current_room: "",
        room_id: "",
        room_name: "Forward",
        audiobridge: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        msg_type: "room",
        audio: null,
        muted: true,
        user: null,
        description: "",
        messages: [],
        visible: false,
        input_value: "",
        users: {},
        root: false,
        support_chat: {},
        active_tab: null,
        trl_muted: true,
    };

    componentDidMount() {
        document.addEventListener("keydown", this.onKeyPressed);
    };

    componentWillUnmount() {
        document.removeEventListener("keydown", this.onKeyPressed);
        this.state.janus.destroy();
    };

    checkPermission = (user) => {
        const gxy_group = kc.hasRealmRole("trl_admin");
        const gxy_root = kc.hasRealmRole("trl_root");
        if (gxy_group) {
            this.setState({root: gxy_root});
            delete user.roles;
            user.role = "admin";
            this.initShidurAdmin(user);
        } else {
            alert("Access denied!");
            kc.logout();
        }
    };

    onKeyPressed = (e) => {
        if(e.code === "Enter")
            this.sendMessage();
    };

    initShidurAdmin = (user) => {
        initJanus(janus => {
            this.setState({janus,user});
            this.initVideoRoom();

            initChatRoom(janus, null, chatroom => {
                Janus.log(":: Got Chat Handle: ",chatroom);
                this.setState({chatroom});
            }, data => {
                this.onData(data);
            });

            initGxyProtocol(janus, this.state.user, protocol => {
                this.setState({protocol});
            }, ondata => {
                Janus.log("-- :: It's protocol public message: ", ondata);
                this.onProtocolData(ondata);
            });
        }, er => {
            kc.logout();
        }, true);
        setInterval(() => {
            this.getRoomList();
            if(this.state.feed_user)
                this.getFeedInfo()
        }, 5000 );
    };

    getRoomList = () => {
        const {audiobridge} = this.state;
        if (audiobridge) {
            audiobridge.send({message: {request: "list"},
                success: (data) => {
                    data.list.sort((a, b) => {
                        // if (a.num_participants > b.num_participants) return -1;
                        // if (a.num_participants < b.num_participants) return 1;
                        if (a.description > b.description) return 1;
                        if (a.description < b.description) return -1;
                        return 0;
                    });
                    this.setState({rooms: data.list});
                }
            });
        }
    };

    getFeedsList = (room_id) => {
        const {audiobridge} = this.state;
        if (audiobridge) {
            audiobridge.send({message: {request: "listparticipants", "room": room_id},
                success: (data) => {
                    Janus.log(" :: Got Feeds List (room :"+room_id+"): ", data);
                    let feeds = data.participants;
                    Janus.log(feeds)
                }
            });
        }
    };

    initVideoRoom = (room_id) => {
        if(this.state.audiobridge)
            this.state.audiobridge.detach();
        this.state.janus.attach({
            plugin: "janus.plugin.audiobridge",
            opaqueId: "videoroom_user",
            success: (audiobridge) => {
                Janus.log(" :: My handle: ", audiobridge);
                Janus.log("Plugin attached! (" + audiobridge.getPlugin() + ", id=" + audiobridge.getId() + ")");
                Janus.log("  -- This is a publisher/manager");
                this.setState({audiobridge, groups: []});
                this.getRoomList();
            },
            error: (error) => {
                Janus.log("Error attaching plugin: " + error);
            },
            consentDialog: (on) => {
                Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
            },
            mediaState: (medium, on) => {
                Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
            },
            webrtcState: (on) => {
                Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
            },
            onmessage: (msg, jsep) => {
                this.onBridgeMessage(this.state.audiobridge, msg, jsep);
            },
            onlocalstream: (mystream) => {
                Janus.debug(" ::: Got a local stream :::");
            },
            onremotetrack: (track, mid, on) => {
                Janus.log(" ::: Got a remote track event ::: (remote feed)");
                Janus.log("Remote track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
                // If we're here, a new track was added
                if(track.kind === "audio" && on) {
                    // New audio track: create a stream out of it, and use a hidden <audio> element
                    let stream = new MediaStream();
                    stream.addTrack(track.clone());
                    Janus.log("Created remote audio stream:", stream);
                    let remoteaudio = this.refs.remoteAudio;
                    Janus.attachMediaStream(remoteaudio, stream);
                } else if(track.kind === "data") {
                    Janus.log("Created remote data channel");
                } else {
                    Janus.log("-- Already active stream --");
                }
            },
            ondataopen: (data) => {
                Janus.log("The DataChannel is available!(publisher)");
            },
            ondata: (data) => {
                Janus.debug("We got data from the DataChannel! (publisher) " + data);
            },
            oncleanup: () => {
                Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
            }
        });
    };

    joinRoom = (data, i) => {
        Janus.log(" -- joinRoom: ", data, i);
        const {rooms, chatroom, user, audiobridge, current_room} = this.state;
        let room = rooms[i].room;
        let room_name = rooms[i].description;
        if (current_room === room)
            return;

        Janus.log(" :: Enter to room: ", room);

        if(!current_room) {
            let register = { "request": "join", "room": room, muted : true, "display": JSON.stringify(user) };
            audiobridge.send({"message": register});
            this.setState({current_room: room, room_name, feeds: {}, feed_user: null, feed_id: null});
            joinChatRoom(chatroom,room,user);
            return;
        }

        this.switchRoom(room);
        let chatreq = {textroom : "leave", transaction: Janus.randomString(12) ,"room": current_room};
        this.setState({current_room: room, room_name, feeds: {}, feed_user: null, feed_id: null});
        chatroom.data({text: JSON.stringify(chatreq),
            success: () => {
                Janus.log(":: Text room leave callback: ");
                joinChatRoom(chatroom,room,user);
            }
        });
    };

    exitRoom = (room) => {
        let {audiobridge, chatroom} = this.state;
        let videoreq = {request : "leave", "room": room};
        let chatreq = {textroom : "leave", transaction: Janus.randomString(12),"room": room};
        Janus.log(room);
        audiobridge.send({"message": videoreq,
            success: () => {
                Janus.log(":: Video room leave callback: ");
                //this.getRoomList();
            }});
        chatroom.data({text: JSON.stringify(chatreq),
            success: () => {
                Janus.log(":: Text room leave callback: ");
            }
        });
    };

    switchRoom = (room_id) => {
        let {audiobridge, user} = this.state;
        let switchroom = {request: "changeroom", room: room_id, display: JSON.stringify(user)};
            audiobridge.send ({"message": switchroom,
            success: (cb) => {
                Janus.log(" :: Switch Room: ", room_id, cb);
            }
        })
    };

    publishOwnFeed = () => {
        let {audiobridge} = this.state;
        audiobridge.createOffer(
            {
                media: {video: false},
                success: (jsep) => {
                    Janus.debug("Got SDP!");
                    Janus.debug(jsep);
                    let publish = { "request": "configure", "muted": true };
                    audiobridge.send({"message": publish, "jsep": jsep});
                },
                error: (error) => {
                    Janus.error("WebRTC error:", error);
                }
            });
    };

    onBridgeMessage = (audiobridge, msg, jsep) => {
        Janus.log(" ::: Got a message :::");
        Janus.log(msg);
        let event = msg["audiobridge"];
        Janus.debug("Event: " + event);
        if(event) {
            if(event === "joined") {
                // Successfully joined, negotiate WebRTC now
                if(msg["id"]) {
                    let myid = msg["id"];
                    Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
                    this.publishOwnFeed();
                    // Any room participant?
                    if(msg["participants"]) {
                        const {feeds, users} = this.state;
                        let list = msg["participants"];
                        Janus.log("Got a list of participants:");
                        Janus.log(list);
                        for(let f in list) {
                            let id = list[f]["id"];
                            let user = JSON.parse(list[f]["display"]);
                            if(user.role !== "user")
                                continue
                            list[f]["display"] = user;
                            feeds[id] = list[f];
                            users[user.id] = user;
                            users[user.id].rfid = id;
                        }
                        this.setState({feeds, users});
                    }
                }
            } else if(event === "roomchanged") {
                // The user switched to a different room
                let myid = msg["id"];
                Janus.log("Moved to room " + msg["room"] + ", new ID: " + myid);
                // Any room participant?
                if(msg["participants"]) {
                    const {feeds, users} = this.state;
                    let list = msg["participants"];
                    Janus.log("Got a list of participants:");
                    Janus.log(list);
                    for(let f in list) {
                        let id = list[f]["id"];
                        let user = JSON.parse(list[f]["display"]);
                        if(user.role !== "user")
                            continue
                        list[f]["display"] = user;
                        feeds[id] = list[f];
                        users[user.id] = user;
                        users[user.id].rfid = id;
                    }
                    this.setState({feeds, users});
                }
            } else if(event === "talking") {
                const {feeds} = this.state;
                const id = msg["id"];
                if(!feeds[id]) return;
                feeds[id].talking = true;
                this.setState({feeds});
            } else if(event === "stopped-talking") {
                const {feeds} = this.state;
                const id = msg["id"];
                if(!feeds[id]) return;
                feeds[id].talking = false;
                this.setState({feeds});
            } else if(event === "destroyed") {
                // The room has been destroyed
                Janus.warn("The room has been destroyed!");
            } else if(event === "event") {
                if(msg["participants"]) {
                    let list = msg["participants"];
                    Janus.log("New feed joined:");
                    Janus.log(list);
                    const {feeds, users} = this.state;
                    for(let f in list) {
                        let id = list[f]["id"];
                        let user = JSON.parse(list[f]["display"]);
                        if(user.role !== "user")
                            continue
                        list[f]["display"] = user;
                        feeds[id] = list[f];
                        users[user.id] = user;
                        users[user.id].rfid = id;
                    }
                    this.setState({feeds, users});
                } else if(msg["error"]) {
                    console.error(msg["error"]);
                }
                // Any new feed to attach to?
                if(msg["leaving"]) {
                    // One of the participants has gone away?
                    let leaving = msg["leaving"];
                    Janus.log("Participant left: " + leaving + " elements with ID #rp" +leaving + ")");
                    const {feeds} = this.state;
                    delete feeds[leaving];
                    this.setState({feeds});
                }
            }
        }
        if(jsep) {
            Janus.debug("Handling SDP as well...");
            Janus.debug(jsep);
            audiobridge.handleRemoteJsep({jsep: jsep});
        }
    };

    onData = (data) => {
        Janus.debug(":: We got message from Data Channel: ",data);
        let json = JSON.parse(data);
        let what = json["textroom"];
        if (what === "message") {
            // Incoming message: public or private?
            let msg = json["text"];
            let room = json["room"];
            msg = msg.replace(new RegExp('<', 'g'), '&lt');
            msg = msg.replace(new RegExp('>', 'g'), '&gt');
            let from = json["from"];
            let dateString = getDateString(json["date"]);
            let whisper = json["whisper"];
            if (whisper === true) {
                // Private message
                let {messages} = this.state;
                let message = JSON.parse(msg);
                message.user.username = message.user.display;
                message.time = dateString;
                Janus.log("-:: It's private message: ", message, from);
                messages.push(message);
                this.setState({messages});
                this.scrollToBottom();
            } else {
                // Public message
                let {messages} = this.state;
                let message = JSON.parse(msg);
                message.time = dateString;
                Janus.log("-:: It's public message: ", message);
                messages.push(message);
                this.setState({messages}, () => {
                    this.scrollToBottom();
                });
            }
        } else if (what === "join") {
            // Somebody joined
            let username = json["username"];
            let display = json["display"];
            Janus.log("-:: Somebody joined - username: "+username+" : display: "+display)
        } else if (what === "leave") {
            // Somebody left
            let username = json["username"];
            let when = new Date();
            Janus.log("-:: Somebody left - username: "+username+" : Time: "+getDateString())
        } else if (what === "kicked") {
            // Somebody was kicked
            // var username = json["username"];
        } else if (what === "destroyed") {
            let room = json["room"];
            Janus.log("The room: "+room+" has been destroyed")
        }
    };

    onProtocolData = (data) => {
        let {users,rooms} = this.state;

        if(data.type === "question") {
            if(data.user.role === "admin")
                return;
            if(users[data.user.id]) {
                users[data.user.id].question = data.status;
                this.setState({users});
            } else {
                users[data.user.id] = {question: data.status};
                this.setState({users});
            }
            let {support_chat,active_tab} = this.state;
            if(!support_chat[data.user.id]) {
                let room  = rooms.filter(r => r.room === data.room);
                support_chat[data.user.id] = {};
                support_chat[data.user.id].msgs = [];
                support_chat[data.user.id].count = 0;
                support_chat[data.user.id].name = data.user.name;
                support_chat[data.user.id].lang = room[0].description;
            }
            if(!active_tab) {
                this.setState({active_tab:{index: 0, id: data.user.id}});
                support_chat[data.user.id].count = 0;
            } else if(active_tab.id !== data.user.id) {
                support_chat[data.user.id].count = support_chat[data.user.id].count + 1;
            } else {
                support_chat[data.user.id].count = 0;
            }
            //data.text = "test";
            support_chat[data.user.id].msgs.push(data);
            this.setState({support_chat,msg_type: "support"},() => {
                this.scrollToBottom();
            });
            if(document.hidden)
                notifyMe(data.user.name, data.text,true);
        } else if(data.type === "sound-test") {
            if(users[data.id]) {
                users[data.id].sound_test = true;
                this.setState({users});
            } else {
                users[data.id] = {sound_test: true};
                this.setState({users});
            }
        }
    };

    sendDataMessage = () => {
        let {input_value,user} = this.state;
        let msg = {user, text: input_value};
        let message = {
            textroom: "message",
            transaction: Janus.randomString(12),
            room: this.state.current_room,
            text: JSON.stringify(msg),
        };
        // Note: messages are always acknowledged by default. This means that you'll
        // always receive a confirmation back that the message has been received by the
        // server and forwarded to the recipients. If you do not want this to happen,
        // just add an ack:false property to the message above, and server won't send
        // you a response (meaning you just have to hope it succeeded).
        this.state.chatroom.data({
            text: JSON.stringify(message),
            error: (reason) => { alert(reason); },
            success: () => {
                Janus.log(":: Message sent ::");
                this.setState({input_value: ""});
            }
        });
    };

    sendPrivateMessage = () => {
        let {input_value,user,feed_user,current_room} = this.state;
        if(!feed_user) {
            alert("Choose user");
            return
        };
        let msg = {user, text: input_value};
        let message = {
            textroom: "message",
            transaction: Janus.randomString(12),
            room: this.state.current_room,
            to: feed_user.id,
            text: JSON.stringify(msg),
        };
        // Note: messages are always acknowledged by default. This means that you'll
        // always receive a confirmation back that the message has been received by the
        // server and forwarded to the recipients. If you do not want this to happen,
        // just add an ack:false property to the message above, and server won't send
        // you a response (meaning you just have to hope it succeeded).
        this.state.chatroom.data({
            text: JSON.stringify(message),
            error: (reason) => { alert(reason); },
            success: () => {
                Janus.log(":: Message sent ::");
                //FIXME: it's directly put to message box
                let {messages} = this.state;
                msg.time = getDateString();
                msg.to = current_room === 1234 ? feed_user.username : feed_user.display;
                Janus.log("-:: It's public message: "+msg);
                messages.push(msg);
                this.setState({messages, input_value: ""});
                this.scrollToBottom();
            }
        });
    };

    supportMessage = () => {
        const {protocol,current_room,input_value,user,active_tab,support_chat} = this.state;
        let msg = { type: "question", room: current_room, user, text: input_value, to: active_tab.id};
        msg.time = getDateString();
        support_chat[active_tab.id].msgs.push(msg);
        sendProtocolMessage(protocol, user, msg );
        Janus.log("-:: It's support message: "+msg);
        this.setState({support_chat, input_value: "", msg_type: "support"}, () => {
            this.scrollToBottom();
        });
    };

    sendBroadcastMessage = () => {
        const { protocol, current_room, input_value, messages, user } = this.state;
        let msg = { type: "chat-broadcast", room: current_room, user, text: input_value};
        sendProtocolMessage(protocol, null, msg );
        msg.time = getDateString();
        msg.to = "ALL";
        Janus.log("-:: It's broadcast message: "+msg);
        messages.push(msg);
        this.setState({messages, input_value: "", msg_type: "room"}, () => {
            this.scrollToBottom();
        });
    };

    sendRemoteCommand = (command_type) => {
        const {protocol,feed_user,user} = this.state;

        if (command_type === "client-reload-all") {
            const msg = {type: "client-reload-all", status: true, id: null, user: null, room: null};
            sendProtocolMessage(protocol, user, msg);
            return;
        }

        if(feed_user) {
            let msg = { type: command_type, id: feed_user.id};
            sendProtocolMessage(protocol, user, msg);
        }
    };

    sendMessage = () => {
        const {msg_type} = this.state;
        if(msg_type === "support") {
            this.supportMessage();
        } else if(msg_type === "room") {
            this.sendDataMessage();
        } else if(msg_type === "all") {
            this.sendBroadcastMessage();
        }
    };

    scrollToBottom = () => {
        if(this.refs.end)
            this.refs.end.scrollIntoView({ behavior: 'smooth' })
        if(this.supt)
            this.supt.scrollIntoView({ behavior: 'smooth' })
    };

    selectRoom = (i) => {
        const {rooms} = this.state;
        let room_id = rooms[i].room;
        this.setState({room_id});
    };

    getRoomID = () => {
        const {rooms} = this.state;
        let id = 1028;
        for(let i=id; i<9999; i++) {
            let room_id = rooms.filter(room => room.room === i);
            if (room_id.length === 0) {
                return i;
            }
        }
    };

    createChatRoom = (id,description) => {
        const {chatroom} = this.state;
        let req = {
            textroom : "create",
            room : id,
            transaction: Janus.randomString(12),
            secret: `${SECRET}`,
            description : description,
            is_private : false,
            permanent : true
        };
        chatroom.data({text: JSON.stringify(req),
            success: () => {
                Janus.log(":: Successfuly created room: ",id);
            },
            error: (reason) => {
                Janus.log(reason);
            }
        });
    };

    removeChatRoom = (id) => {
        const {chatroom} = this.state;
        let req = {
            textroom: "destroy",
            room: id,
            transaction: Janus.randomString(12),
            secret: `${SECRET}`,
            permanent: true,
        };
        chatroom.data({text: JSON.stringify(req),
            success: () => {
                Janus.log(":: Successfuly removed room: ", id);
            },
            error: (reason) => {
                Janus.log(reason);
            }
        });
    };

    setBitrate = (bitrate) => {
        this.setState({bitrate});
    };

    createRoom = () => {
        let {bitrate,description,audiobridge} = this.state;
        let room_id = this.getRoomID();
        let janus_room = {
            request : "create",
            room: room_id,
            description: description,
            secret: `${SECRET}`,
            publishers: 20,
            bitrate: bitrate,
            fir_freq: 10,
            audiocodec: "opus",
            videocodec: "h264",
            audiolevel_event: true,
            audio_level_average: 100,
            audio_active_packets: 25,
            record: false,
            is_private: false,
            permanent: true,
        };
        Janus.log(description);
        audiobridge.send({"message": janus_room,
            success: (data) => {
                Janus.log(":: Create callback: ", data);
                this.getRoomList();
                alert("Room: "+description+" created!")
                this.createChatRoom(room_id,description);
            },
        });
        this.setState({description: ""});
    };

    removeRoom = () => {
        const {room_id,audiobridge} = this.state;
        let janus_room = {
            request: "destroy",
            room: room_id,
            secret: `${SECRET}`,
            permanent: true,
        };
        audiobridge.send({"message": janus_room,
            success: (data) => {
                Janus.log(":: Remove callback: ", data);
                this.getRoomList();
                alert("Room ID: "+room_id+" removed!");
                this.removeChatRoom(room_id);
            },
        });
    };

    disableRoom = (e, data, i) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            Janus.log(data)
            // let {disabled_rooms} = this.state;
            // disabled_rooms.push(data);
            // this.setState({disabled_rooms});
            // this.getRoomList();
        }
    };

    kickUser = (id) => {
        const {current_room,audiobridge,feed_id} = this.state;
        let request = {
            request: "kick",
            room: current_room,
            secret: `${SECRET}`,
            id: feed_id,
        };
        audiobridge.send({"message": request,
            success: (data) => {
                Janus.log(":: Kick callback: ", data);
            },
        });
    };

    getUserInfo = (feed) => {
        Janus.log(" :: Selected feed: ",feed);
        let {display,id,talking} = feed;
        let feed_info = display.system ? platform.parse(display.system) : null;
        this.setState({feed_id: id, feed_user: display, feed_talk: talking, feed_info});
        Janus.log(display,id,talking);
    };

    getFeedInfo = () => {
        if(this.state.feed_user) {
            let {session,handle} = this.state.feed_user;
            if(session && handle) {
                getPublisherInfo(session, handle, json => {
                        //Janus.log(":: Publisher info", json);
                        let audio = json.info.webrtc.media[0].rtcp.main;
                        this.setState({feed_rtcp: {audio}});
                    }, true
                )
            }
        }
    };

    tabChange = (e, data) => {
        let {active_tab,support_chat} = this.state;
        active_tab.index = data.activeIndex;
        active_tab.id = data.panes[data.activeIndex].menuItem.key;
        support_chat[active_tab.id].count = 0;
        this.setState({support_chat,active_tab} ,() => {
            this.scrollToBottom();
        });
    };

    muteTrl = () => {
        const {trl_muted} = this.state;
        this.setState({trl_muted: !trl_muted});
    };

    setTrlVolume = (value) => {
        this.refs.remoteAudio.volume = value;
    };

    removeFromSupport = (e,id) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {support_chat} = this.state;
            delete support_chat[id];
            this.setState({support_chat});
            if(Object.keys(support_chat).length === 0) {
                this.setState({msg_type: "room"});
            }
        }
    };

    addToSupport = (e,id) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {support_chat,users,current_room,active_tab} = this.state;
            if(support_chat[id])
                return;
            if(Object.keys(support_chat).length === 0) {
                active_tab = {index: 0, id};
                this.setState({active_tab});
            }
            let user = users[id];
            let data = {user, room: current_room,time: getDateString(),type: "question",text: ":: Admin request ::"};
            this.onProtocolData(data);
        }
    };

    onConfirmReloadAllCancel = (e, data) => {
        this.setState({showConfirmReloadAll: false});
    };

    onConfirmReloadAllConfirm = (e, data) => {
        console.log("RELOAD ALL")
        this.setState({showConfirmReloadAll: false});
        this.sendRemoteCommand("client-reload-all");
    };


  render() {

      const { bitrate,rooms,current_room,user,feeds,feed_id,feed_info,i,messages,description,room_id,room_name,root,support_chat,feed_rtcp,trl_muted,msg_type,showConfirmReloadAll} = this.state;

      const f = (<Icon name='volume up' />);
      const q = (<Icon color='red' name='help' />);
      const v = (<Icon name='checkmark' />);
      const x = (<Icon name='close' />);

      const bitrate_options = [
          { key: 1, text: '150Kb/s', value: 150000 },
          { key: 2, text: '300Kb/s', value: 300000 },
          { key: 3, text: '600Kb/s', value: 600000 },
      ];

      const send_options = [
          { key: 'all', text: 'All', value: 'all'},
          { key: 'room', text: 'Room', value: 'room' },
          { key: 'support', text: 'Support', value: 'support', disabled: Object.keys(support_chat).length === 0 },
      ];

      let rooms_list = rooms.map((data,i) => {
          const {room, num_participants, description} = data;
          return ({ key: room, text: description, value: i, description: num_participants.toString()})
      });

      let rooms_grid = rooms.map((data,i) => {
          const {room, num_participants, description} = data;
          return (
              <Table.Row active={current_room === room}
                         key={i} onClick={() => this.joinRoom(data, i)}
                         onContextMenu={(e) => this.disableRoom(e, data, i)} >
                  <Table.Cell width={5}>{description}</Table.Cell>
                  <Table.Cell width={1}>{num_participants}</Table.Cell>
              </Table.Row>
          )
      });

      let users_grid = Object.values(feeds).map((feed,i) => {
          if(feed) {
              let talking = feed.talking;
              let muted = feed.muted;
              return (
                  <Table.Row active={feed.id === this.state.feed_id} key={i} positive={!muted || talking}
                             onClick={() => this.getUserInfo(feed)}
                             onContextMenu={(e) => this.addToSupport(e,feed.display.id)} >
                      <Table.Cell width={10}>{feed.display.name}</Table.Cell>
                      <Table.Cell width={1}>{!muted || talking ? f : ""}</Table.Cell>
                  </Table.Row>
              )
          }
      });

      let list_msgs = messages.map((msg,i) => {
          let {user,time,text} = msg;
          return (
              <div key={i} ref='end'><p>
                  <i style={{color: 'grey'}}>[{time}]</i>&nbsp;
                  <u style={{color: user.role === "admin" ? 'red' : 'blue'}}>{user.name}</u> : {text}</p>
              </div>
          );
      });

      let panes = Object.keys(support_chat).map((id, i) => {
          let {msgs,name,count,lang} = support_chat[id];
          let l = (<Label color='red'>{count}</Label>);
          return (
              {menuItem: (<Menu.Item key={id} onContextMenu={(e) => this.removeFromSupport(e,id)} >{name} [<i>{lang}</i>] {count > 0 ? l : ""}</Menu.Item>),
                  render: () => <Tab.Pane>
                      <Message className='messages_list'>
                          <div className="messages-wrapper">
                              {msgs.map((msg,i) => {
                                  let {user,time,text} = msg;
                                  return (
                                      <div key={i+id} ref={el => { this.supt = el; }}><p>
                                          <i style={{color: 'grey'}}>[{time}]</i>&nbsp;
                                          <u style={{color: user.role === "admin" ? 'red' : 'blue'}}>{user.name}</u> : {text}</p>
                                      </div>
                                  );
                              })}
                          </div>
                      </Message>
                  </Tab.Pane>,
              }
          );
      });

      let login = (<LoginPage user={user} checkPermission={this.checkPermission} />);

      let root_content = (
          <Menu secondary >
              <Menu.Item>
                  <Button color='orange' icon='bell slash' labelPosition='right'
                          content={room_name} onClick={this.stopForward} />
              </Menu.Item>
              <Menu.Item>
              </Menu.Item>
              <Menu.Item>
                  <Button negative onClick={this.removeRoom}>Remove</Button>
                  :::
                  <Select
                      error={room_id}
                      scrolling
                      placeholder="Select Room:"
                      value={i}
                      options={rooms_list}
                      onChange={(e, {value}) => this.selectRoom(value)} />
              </Menu.Item>
              <Menu.Item>
                  <Input type='text' placeholder='Room description...' action value={description}
                         onChange={(v,{value}) => this.setState({description: value})}>
                      <input />
                      <Select
                          compact={true}
                          scrolling={false}
                          placeholder="Room Bitrate:"
                          value={bitrate}
                          options={bitrate_options}
                          onChange={(e, {value}) => this.setBitrate(value)}/>
                      <Button positive onClick={this.createRoom}>Create</Button>
                  </Input>
              </Menu.Item>
          </Menu>
      );

      let content = (
          <Segment className="virtual_segment" color='blue' raised>

              <Segment textAlign='center' className="ingest_segment">
                  {/*<Button color='blue' icon='sound' onClick={() => this.sendRemoteCommand("sound-test")} />*/}
                  <Popup
                      trigger={<Button positive icon='info' onClick={this.getFeedInfo} />}
                      position='bottom left'
                      content={
                          <List as='ul'>
                              <List.Item as='li'>System
                                  <List.List as='ul'>
                                      <List.Item as='li'>OS: {feed_info ? feed_info.os.toString() : ""}</List.Item>
                                      <List.Item as='li'>Browser: {feed_info ? feed_info.name : ""}</List.Item>
                                      <List.Item as='li'>Version: {feed_info ? feed_info.version : ""}</List.Item>
                                  </List.List>
                              </List.Item>
                              <List.Item as='li'>Audio
                                  <List.List as='ul'>
                                      <List.Item as='li'>in-link-quality: {feed_rtcp.audio ? feed_rtcp.audio["in-link-quality"] : ""}</List.Item>
                                      <List.Item as='li'>in-media-link-quality: {feed_rtcp.audio ? feed_rtcp.audio["in-media-link-quality"] : ""}</List.Item>
                                      <List.Item as='li'>jitter-local: {feed_rtcp.audio ? feed_rtcp.audio["jitter-local"] : ""}</List.Item>
                                      <List.Item as='li'>jitter-remote: {feed_rtcp.audio ? feed_rtcp.audio["jitter-remote"] : ""}</List.Item>
                                      <List.Item as='li'>lost: {feed_rtcp.audio ? feed_rtcp.audio["lost"] : ""}</List.Item>
                                  </List.List>
                              </List.Item>
                          </List>
                      }
                      on='click'
                      hideOnScroll
                  />
                  <Menu secondary className='volume' >
                      <VolumeSlider volume={this.setTrlVolume} mute={this.muteTrl} />
                  </Menu>
                  {/*{root ? root_content : ""}*/}
              </Segment>

              <Grid>
                  <Grid.Row stretched columns='equal'>
                      <Grid.Column width={4}>
                          <Segment.Group>
                              { root ?
                              <Segment textAlign='center'>
                                  {/*<Popup trigger={<Button color="orange" icon='bell slash' onClick={() => this.stopForward(feed_id)} />} content='Stop forward' inverted />*/}
                                  {/*<Popup trigger={<Button negative icon='user x' onClick={this.kickUser} />} content='Kick' inverted />*/}
                                      {/*<Popup trigger={<Button color="brown" icon='sync alternate' alt="test" onClick={() => this.sendRemoteCommand("client-reconnect")} />} content='Reconnect' inverted />*/}
                                      <Popup trigger={<Button color="olive" icon='redo alternate' onClick={() => this.sendRemoteCommand("client-reload")} />} content='Reload page(LOST FEED HERE!)' inverted />
                                      <Popup trigger={<Button color="teal" icon='microphone' onClick={() => this.sendRemoteCommand("client-mute")} />} content='Mute/Unmute' inverted />
                                      <Popup trigger={<Button color="blue" icon='power off' onClick={() => this.sendRemoteCommand("client-disconnect")} />} content='Disconnect(LOST FEED HERE!)' inverted />
                                      <Popup trigger={<Button color="red" icon='redo' onClick={() => this.setState({showConfirmReloadAll: !showConfirmReloadAll})} />} content='RELOAD ALL' inverted />
                                      {/*<Popup trigger={<Button color="yellow" icon='question' onClick={() => this.sendRemoteCommand("client-question")} />} content='Set/Unset question' inverted />*/}
                                  <Confirm
                                      open={showConfirmReloadAll}
                                      header={
                                          <Header><Icon name="warning circle" color="red"/>Caution</Header>
                                      }
                                      content="Are you sure you want to force ALL USERS to reload their page ?!"
                                      onCancel={this.onConfirmReloadAllCancel}
                                      onConfirm={this.onConfirmReloadAllConfirm}
                                  />
                              </Segment>
                                  : ""}
                          <Segment textAlign='center' className="group_list" raised>
                              <Table selectable compact='very' basic structured className="admin_table" unstackable>
                                  <Table.Body>
                                      <Table.Row disabled>
                                          <Table.Cell width={10} />
                                          <Table.Cell width={1} />
                                      </Table.Row>
                                      {users_grid}
                                      <audio
                                          ref={"remoteAudio"}
                                          id={"remoteAudio"}
                                          autoPlay={true}
                                          controls={false}
                                          muted={trl_muted}
                                          playsInline={true}/>
                                  </Table.Body>
                              </Table>
                          </Segment>
                          </Segment.Group>
                      </Grid.Column>
                      <Grid.Column largeScreen={9}>
                          <Message className='messages_list'>
                              {list_msgs}
                              <div ref='end' />
                          </Message>
                          {/*<Input className='room_input' fluid type='text' placeholder='Type your message' action value={this.state.input_value}*/}
                          {/*       onChange={(v,{value}) => this.setState({input_value: value})}>*/}
                          {/*    <input />*/}
                          {/*    <Button positive onClick={this.sendDataMessage}>Send</Button>*/}
                          {/*</Input>*/}
                      </Grid.Column>
                      <Grid.Column width={3}>

                          <Segment textAlign='center' className="group_list" raised>
                              <Table selectable compact='very' basic structured className="admin_table" unstackable>
                                  <Table.Body>
                                      {rooms_grid}
                                  </Table.Body>
                              </Table>
                          </Segment>

                      </Grid.Column>
                  </Grid.Row>
              </Grid>

              <Segment className='chat_segment'>
                  {this.state.active_tab ? <Tab panes={panes} onTabChange={this.tabChange} /> : ""}
                  <Input fluid type='text' placeholder='Type your message' action value={this.state.input_value}
                         onChange={(v,{value}) => this.setState({input_value: value})}>
                      <input />
                      <Select options={send_options}
                              value={msg_type}
                              error={msg_type === "all"}
                              onChange={(e,{value}) => this.setState({msg_type: value})} />
                      <Button positive negative={msg_type === "all"} onClick={this.sendMessage}>Send</Button>
                  </Input>
              </Segment>

          </Segment>
      );

      return (

          <div>
              {user ? content : login}
          </div>

      );
  }
}

export default TrlAdmin;
