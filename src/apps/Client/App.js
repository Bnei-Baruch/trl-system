import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Menu, Select, Button, Icon, Popup, Segment, Message, Table, Divider} from "semantic-ui-react";
import {geoInfo, initJanus, getDevicesStream, micLevel, checkNotification, testDevices, testMic} from "../../shared/tools";
import './App.scss'
import {audios_options, lnglist, SECRET, DANTE_IN_IP, GEO_IP_INFO} from "../../shared/consts";
import {client} from "../../components/UserManager";
import Chat from "./Chat";
import VolumeSlider from "../../components/VolumeSlider";
import {initGxyProtocol} from "../../shared/protocol";
import Stream from "../Stream/App";
import LoginPage from "../../components/LoginPage";

class TrlClient extends Component {

    state = {
        audioContext: null,
        stream: null,
        audio_devices: [],
        audio_device: "",
        janus: null,
        videostream: null,
        audiostream: null,
        feeds: [],
        feedStreams: {},
        trl_room: localStorage.getItem("trl_room"),
        rooms: [],
        room: "",
        selected_room: "",
        videoroom: null,
        remotefeed: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        forward_id: null,
        mids: [],
        audio: null,
        muted: false,
        trl_muted: true,
        cammuted: false,
        shidur: false,
        protocol: null,
        user: null,
        audios: Number(localStorage.getItem("lang")) || 15,
        users: {},
        visible: true,
        question: false,
        selftest: "Mic Test",
        tested: false,
    };

    checkPermission = (user) => {
        let gxy_group = user.roles.filter(role => role === 'trl_user').length > 0;
        if (gxy_group) {
            delete user.roles;
            user.role = "user";
            this.initClient(user);
        } else {
            alert("Access denied!");
            client.signoutRedirect();
        }
    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    initClient = (user,error) => {
        checkNotification();
        geoInfo(`${GEO_IP_INFO}`, data => {
            Janus.log(data);
            user.ip = data.ip;
        });
        initJanus(janus => {
            user.session = janus.getSessionId();
            this.setState({janus, user});
            this.chat.initChat(janus);
            this.initVideoRoom(error);
        }, er => {
            setTimeout(() => {
                this.initClient(user,er);
            }, 5000);
        }, true);
    };

    initDevices = () => {
        Janus.listDevices(devices => {
            if (devices.length > 0) {
                let audio_devices = devices.filter(device => device.kind === "audioinput");
                // Be sure device still exist
                let audio_device = localStorage.getItem("audio_device");
                let achk = audio_devices.filter(a => a.deviceId === audio_device).length > 0;
                let audio_id = audio_device !== "" && achk ? audio_device : audio_devices[0].deviceId;
                Janus.log(" :: Got Audio devices: ", audio_devices);
                this.setState({audio_devices});
                this.setDevice(audio_id);
            } else {
                //Try to get audio fail reson
                testDevices(false, true, steam => {});
                alert(" :: No input devices found ::");
                this.setState({audio_device: null});
            }
        }, { audio: true, video: false });
    };

    setDevice = (audio_device) => {
        if(audio_device !== this.state.audio_device) {
            this.setState({audio_device});
            if(this.state.audio_device !== "") {
                localStorage.setItem("audio_device", audio_device);
                Janus.log(" :: Going to check Devices: ");
                getDevicesStream(audio_device,stream => {
                    Janus.log(" :: Check Devices: ", stream);
                    let myaudio = this.refs.localVideo;
                    Janus.attachMediaStream(myaudio, stream);
                    if(this.state.audioContext) {
                        this.state.audioContext.close();
                    }
                    micLevel(stream ,this.refs.canvas1,audioContext => {
                        this.setState({audioContext,stream});
                    });
                })
            }
        }
    };

    selfTest = () => {
        this.setState({selftest: "Recording... 9"});
        testMic(this.state.stream);

        let rect = 9;
        let rec = setInterval(() => {
            rect--;
            this.setState({selftest: "Recording... " + rect});
            if(rect <= 0) {
                clearInterval(rec);
                let playt = 11;
                let play = setInterval(() => {
                    playt--;
                    this.setState({selftest: "Playing... " + playt});
                    if(playt <= 0) {
                        clearInterval(play);
                        this.setState({selftest: "Mic Test", tested: true});
                    }
                },1000);
            }
        },1000);
    };

    getRoomList = () => {
        const {videoroom} = this.state;
        if (videoroom) {
            videoroom.send({message: {request: "list"},
                success: (data) => {
                    Janus.debug(" :: Get Rooms List: ", data.list);
                    data.list.sort((a, b) => {
                        if (a.description > b.description) return 1;
                        if (a.description < b.description) return -1;
                        return 0;
                    });
                    this.setState({rooms: data.list});
                    if(this.state.trl_room !== null)
                        this.selectRoom(Number(this.state.trl_room));
                    //this.getFeedsList(data.list)
                }
            });
        }
    };

    listForwarders = () => {
        const {videoroom,room} = this.state;
        let fwlist = [];
        let req = {request:"listforwarders", room:room, secret:`${SECRET}`};
        videoroom.send ({"message": req,
            success: (data) => {
                for(let i=0; i<data.publishers.length; i++) {
                    if(data.publishers[i].forwarders) {
                        for(let f=0; f<data.publishers[i].forwarders.length; f++) {
                            let port = data.publishers[i].forwarders[f].port;
                            fwlist.push(port);
                        }
                    }
                }
                Janus.log(fwlist);
                this.setPort(fwlist);
            }
        });
    };

    setPort = (fwlist) => {
        let {name} = this.state;
        let fwport = lnglist[name].port;
        if(fwlist.length === 0) {
            Janus.log("-- ::We alone here");
            this.startForward(fwport);
        } else if(fwlist.length === 9) {
            Janus.log("-- ::Only 9 Translator avalabale - exiting!");
            alert("Only 9 connection possible");
            this.state.janus.destroy();
        } else {
            do {
                Janus.debug("--  Port: "+fwport+" TAFUS");
                fwport = fwport + 1;
                Janus.debug("--  Let's check: "+fwport+" port");
                // eslint-disable-next-line no-loop-func
            } while (fwlist.find(p => p === fwport) !== undefined);
            Janus.log("--  Going to set: "+fwport+" port");
            this.startForward(fwport);
        }
    };


    startForward = (port) => {
        let {room,myid} = this.state;
        const {videoroom} = this.state;
        Janus.log(" :: Start forward from room: ", room);
        let forward = { request: "rtp_forward", publisher_id:myid, room:room, secret:`${SECRET}` ,host:`${DANTE_IN_IP}`, audio_port:port};
        videoroom.send({"message": forward,
            success: (data) => {
                Janus.log(":: Forward callback: ", data);
                let forward_id = data["rtp_stream"]["audio_stream_id"];
                // Janus.log(":: Forward ID: ", forward_id);
                this.setState({forward_id});
            },
        });
    };

    stopForward = (room) => {
        const {forward_id,myid} = this.state;
        const {videoroom} = this.state;
        if(forward_id) {
            Janus.log(" :: Stop forward from room: ", room);
            let stopfw = { request:"stop_rtp_forward", stream_id:forward_id, publisher_id:myid, room:room, secret:`${SECRET}` };
            videoroom.send({"message": stopfw,
                success: (data) => {
                    Janus.log(":: Forward callback: ", data);
                    this.setState({forward_id: null});
                },
            });
        }
    };

    initVideoRoom = (reconnect) => {
        if(this.state.videoroom)
            this.state.videoroom.detach();
        if(this.state.remoteFeed)
            this.state.remoteFeed.detach();
        this.state.janus.attach({
            plugin: "janus.plugin.videoroom",
            opaqueId: "videoroom_user",
            success: (videoroom) => {
                Janus.log(" :: My handle: ", videoroom);
                Janus.log("Plugin attached! (" + videoroom.getPlugin() + ", id=" + videoroom.getId() + ")");
                Janus.log("  -- This is a publisher/manager");
                let {user} = this.state;
                user.handle = videoroom.getId();
                this.setState({videoroom, user, remoteFeed: null});
                this.getRoomList();
                this.initDevices(true);
                if(reconnect) {
                    setTimeout(() => {
                        this.joinRoom(reconnect);
                    }, 5000);
                }
            },
            error: (error) => {
                Janus.log("Error attaching plugin: " + error);
            },
            consentDialog: (on) => {
                Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
            },
            iceState: (state) => {
                Janus.log("ICE state changed to " + state);
            },
            mediaState: (medium, on) => {
                Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
                //this.startForward();
                setTimeout(() => {
                    this.listForwarders()
                }, 3000);
            },
            webrtcState: (on) => {
                Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
            },
            slowLink: (uplink, nacks) => {
                Janus.log("Janus reports problems " + (uplink ? "sending" : "receiving") +
                    " packets on this PeerConnection (" + nacks + " NACKs/s " + (uplink ? "received" : "sent") + ")");
            },
            onmessage: (msg, jsep) => {
                this.onMessage(this.state.videoroom, msg, jsep, false);
            },
            onlocaltrack: (track, on) => {
                Janus.log(" ::: Got a local track event :::");
                Janus.log("Local track " + (on ? "added" : "removed") + ":", track);
                //this.state.videoroom.muteAudio();
                this.setState({mystream: track});
            },
            onremotestream: (stream) => {
                // The publisher stream is sendonly, we don't expect anything here
            },
            ondataopen: (label) => {
                Janus.log("Publisher - DataChannel is available! ("+label+")");
            },
            ondata: (data, label) => {
                Janus.log("Publisher - Got data from the DataChannel! ("+label+")" + data);
            },
            oncleanup: () => {
                Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
            }
        });
    };

    publishOwnFeed = () => {
        let {videoroom,audio_device} = this.state;
        videoroom.createOffer(
            {
                // Add data:true here if you want to publish datachannels as well
                media: {
                    audioRecv: false, videoRecv: false, audioSend: true, videoSend: false, audio: {
                        autoGainControl: false,
                        echoCancellation: false,
                        highpassFilter: false,
                        noiseSuppression: false,
                        deviceId: {
                            exact: audio_device
                        }
                    },
                    data: true
                },
                //media: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true },	// Publishers are sendonly
                simulcast: false,
                success: (jsep) => {
                    Janus.debug("Got publisher SDP!");
                    Janus.debug(jsep);
                    let publish = { "request": "configure", "audio": true, "video": false, "data": true };
                    videoroom.send({"message": publish, "jsep": jsep});
                },
                error: (error) => {
                    Janus.error("WebRTC error:", error);
                }
            });
    };

    onMessage = (videoroom, msg, jsep, initdata) => {
        Janus.log(" ::: Got a message (publisher) :::");
        Janus.log(msg);
        let event = msg["videoroom"];
        if(event !== undefined && event !== null) {
            if(event === "joined") {
                // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                let myid = msg["id"];
                let mypvtid = msg["private_id"];
                this.setState({myid ,mypvtid});
                Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
                this.publishOwnFeed(true);
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    let feeds = list.filter(feeder => JSON.parse(feeder.display).role === "user");
                    //let feeds = [];
                    let {feedStreams,users} = this.state;
                    Janus.log(":: Got Pulbishers list: ", feeds);
                    if(feeds.length > 9) {
                        alert("Max users in this room is reached");
                        window.location.reload();
                    }
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.log(list);
                    let subscription = [];
                    for(let f in feeds) {
                        let id = feeds[f]["id"];
                        let display = JSON.parse(feeds[f]["display"]);
                        let talk = feeds[f]["talking"];
                        let streams = feeds[f]["streams"];
                        feeds[f].display = display;
                        feeds[f].talk = talk;
                        for (let i in streams) {
                            let stream = streams[i];
                            stream["id"] = id;
                            stream["display"] = display;
                        }
                        feedStreams[id] = {id, display, streams};
                        users[display.id] = display;
                        users[display.id].rfid = id;
                        subscription.push({
                            feed: id,	// This is mandatory
                            //mid: stream.mid		// This is optional (all streams, if missing)
                        });
                    }
                    this.setState({feeds,feedStreams,users});
                    if(subscription.length > 0)
                        this.subscribeTo(subscription);
                }
            } else if(event === "talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                Janus.log("User: "+id+" - start talking");
                for(let i=0; i<feeds.length; i++) {
                    if(feeds[i] && feeds[i].id === id) {
                        feeds[i].talk = true;
                    }
                }
                this.setState({feeds});
            } else if(event === "stopped-talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                Janus.log("User: "+id+" - stop talking");
                for(let i=0; i<feeds.length; i++) {
                    if(feeds[i] && feeds[i].id === id) {
                        feeds[i].talk = false;
                    }
                }
                this.setState({feeds});
            } else if(event === "destroyed") {
                // The room has been destroyed
                Janus.warn("The room has been destroyed!");
            } else if(event === "event") {
                // Any info on our streams or a new feed to attach to?
                let {feedStreams,user,myid} = this.state;
                if(msg["streams"] !== undefined && msg["streams"] !== null) {
                    let streams = msg["streams"];
                    for (let i in streams) {
                        let stream = streams[i];
                        stream["id"] = myid;
                        stream["display"] = user;
                    }
                    feedStreams[myid] = {id: myid, display: user, streams: streams};
                    this.setState({feedStreams})
                } else if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let feed = msg["publishers"];
                    let {feeds,feedStreams,users} = this.state;
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.log(feed);
                    let subscription = [];
                    for(let f in feed) {
                        let id = feed[f]["id"];
                        let display = JSON.parse(feed[f]["display"]);
                        if(display.role !== "user")
                            return;
                        let streams = feed[f]["streams"];
                        feed[f].display = display;
                        for (let i in streams) {
                            let stream = streams[i];
                            stream["id"] = id;
                            stream["display"] = display;
                        }
                        feedStreams[id] = {id, display, streams};
                        users[display.id] = display;
                        users[display.id].rfid = id;
                        subscription.push({
                            feed: id,	// This is mandatory
                            //mid: stream.mid		// This is optional (all streams, if missing)
                        });
                    }
                    feeds.push(feed[0]);
                    this.setState({feeds,feedStreams,users});
                    if(subscription.length > 0)
                        this.subscribeTo(subscription);
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    var leaving = msg["leaving"];
                    Janus.log("Publisher left: " + leaving);
                    this.unsubscribeFrom(leaving);

                } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                    let unpublished = msg["unpublished"];
                    Janus.log("Publisher left: " + unpublished);
                    if(unpublished === 'ok') {
                        // That's us
                        videoroom.hangup();
                        return;
                    }
                    this.unsubscribeFrom(unpublished);

                } else if(msg["error"] !== undefined && msg["error"] !== null) {
                    if(msg["error_code"] === 426) {
                        Janus.log("This is a no such room");
                    } else {
                        Janus.log(msg["error"]);
                    }
                }
            }
        }
        if(jsep !== undefined && jsep !== null) {
            Janus.debug("Handling SDP as well...");
            Janus.debug(jsep);
            videoroom.handleRemoteJsep({jsep: jsep});
        }
    };

    newRemoteFeed = (subscription) => {
        this.state.janus.attach(
            {
                plugin: "janus.plugin.videoroom",
                opaqueId: "remotefeed_user",
                success: (pluginHandle) => {
                    let remoteFeed = pluginHandle;
                    Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
                    Janus.log("  -- This is a multistream subscriber",remoteFeed);
                    this.setState({remoteFeed, creatingFeed: false});
                    // We wait for the plugin to send us an offer
                    let subscribe = {request: "join", room: this.state.room, ptype: "subscriber", streams: subscription};
                    remoteFeed.send({ message: subscribe });
                },
                error: (error) => {
                    Janus.error("  -- Error attaching plugin...", error);
                },
                iceState: (state) => {
                    Janus.log("ICE state (remote feed) changed to " + state);
                },
                webrtcState: (on) => {
                    Janus.log("Janus says this WebRTC PeerConnection (remote feed) is " + (on ? "up" : "down") + " now");
                },
                slowLink: (uplink, nacks) => {
                    Janus.warn("Janus reports problems " + (uplink ? "sending" : "receiving") +
                        " packets on this PeerConnection (remote feed, " + nacks + " NACKs/s " + (uplink ? "received" : "sent") + ")");
                },
                onmessage: (msg, jsep) => {
                    Janus.log(" ::: Got a message (subscriber) :::");
                    Janus.log(msg);
                    let event = msg["videoroom"];
                    Janus.log("Event: " + event);
                    let {remoteFeed} = this.state;
                    if(msg["error"] !== undefined && msg["error"] !== null) {
                        Janus.debug("-- ERROR: " + msg["error"]);
                    } else if(event !== undefined && event !== null) {
                        if(event === "attached") {
                            this.setState({creatingFeed: false});
                            Janus.log("Successfully attached to feed in room " + msg["room"]);
                        } else if(event === "event") {
                            // Check if we got an event on a simulcast-related event from this publisher
                        } else {
                            // What has just happened?
                        }
                    }
                    if(msg["streams"]) {
                        // Update map of subscriptions by mid
                        let {mids} = this.state;
                        for(let i in msg["streams"]) {
                            let mindex = msg["streams"][i]["mid"];
                            //let feed_id = msg["streams"][i]["feed_id"];
                            mids[mindex] = msg["streams"][i];
                        }
                        this.setState({mids});
                    }
                    if(jsep !== undefined && jsep !== null) {
                        Janus.debug("Handling SDP as well...");
                        Janus.debug(jsep);
                        // Answer and attach
                        remoteFeed.createAnswer(
                            {
                                jsep: jsep,
                                // Add data:true here if you want to subscribe to datachannels as well
                                // (obviously only works if the publisher offered them in the first place)
                                media: { audioSend: false, videoSend: false, data:true },	// We want recvonly audio/video
                                success: (jsep) => {
                                    Janus.debug("Got SDP!");
                                    Janus.debug(jsep);
                                    let body = { request: "start", room: this.state.room };
                                    remoteFeed.send({ message: body, jsep: jsep });
                                },
                                error: (error) => {
                                    Janus.error("WebRTC error:", error);
                                    Janus.debug("WebRTC error... " + JSON.stringify(error));
                                }
                            });
                    }
                },
                onlocaltrack: (track, on) => {
                    // The subscriber stream is recvonly, we don't expect anything here
                },
                onremotetrack: (track, mid, on) => {
                    Janus.log(" ::: Got a remote track event ::: (remote feed)");
                    if(!mid) {
                        mid = track.id.split("janus")[1];
                    }
                    Janus.log("Remote track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
                    // Which publisher are we getting on this mid?
                    let {mids,feedStreams} = this.state;
                    let feed = mids[mid].feed_id;
                    Janus.log(" >> This track is coming from feed " + feed + ":", mid);
                    // If we're here, a new track was added
                    if(track.kind === "audio" && on) {
                        // New audio track: create a stream out of it, and use a hidden <audio> element
                        let stream = new MediaStream();
                        stream.addTrack(track.clone());
                        Janus.log("Created remote audio stream:", stream);
                        feedStreams[feed].audio_stream = stream;
                        this.setState({feedStreams});
                        let remoteaudio = this.refs["remoteAudio" + feed];
                        Janus.attachMediaStream(remoteaudio, stream);
                    } else if(track.kind === "data") {
                        Janus.log("Created remote data channel");
                    } else {
                        Janus.log("-- Already active stream --");
                    }
                },
                ondataopen: (label) => {
                    Janus.log("Feed - DataChannel is available! ("+label+")");
                },
                ondata: (data, label) => {
                    Janus.log("Feed - Got data from the DataChannel! ("+label+")" + data);
                    let msg = JSON.parse(data);
                    this.onRoomData(msg);
                    Janus.log(" :: We got msg via DataChannel: ",msg)
                },
                oncleanup: () => {
                    Janus.log(" ::: Got a cleanup notification (remote feed) :::");
                }
            });
    };

    subscribeTo = (subscription) => {
        // New feeds are available, do we need create a new plugin handle first?
        if (this.state.remoteFeed) {
            this.state.remoteFeed.send({message:
                    {request: "subscribe", streams: subscription}
            });
            return;
        }

        // We don't have a handle yet, but we may be creating one already
        if (this.state.creatingFeed) {
            // Still working on the handle
            setTimeout(() => {
                this.subscribeTo(subscription);
            }, 500);
            return;
        }

        // We don't creating, so let's do it
        this.setState({creatingFeed: true});
        this.newRemoteFeed(subscription);
    };

    unsubscribeFrom = (id) => {
        // Unsubscribe from this publisher
        let {feeds,remoteFeed,users,feedStreams} = this.state;
        for (let i=0; i<feeds.length; i++) {
            if (feeds[i].id === id) {
                Janus.log("Feed " + feeds[i] + " (" + id + ") has left the room, detaching");
                //TODO: remove mids
                delete users[feeds[i].display.id];
                delete feedStreams[id];
                feeds.splice(i, 1);
                // Send an unsubscribe request
                let unsubscribe = {
                    request: "unsubscribe",
                    streams: [{ feed: id }]
                };
                if(remoteFeed !== null)
                    remoteFeed.send({ message: unsubscribe });
                this.setState({feeds,users,feedStreams});
                break
            }
        }
    };

    onProtocolData = (data) => {
        //TODO: Need to add transaction handle (filter and acknowledge)
        // let {room,feeds,users,user} = this.state;
        // if (data.type === "question" && data.room === room && user.id !== data.user.id) {
        //     let rfid = users[data.user.id].rfid;
        //     for (let i = 0; i < feeds.length; i++) {
        //         if (feeds[i] && feeds[i].id === rfid) {
        //             feeds[i].question = data.status;
        //             break
        //         }
        //     }
        //     this.setState({feeds});
        // }
    };

    sendDataMessage = (key,value) => {
        let {videoroom,user} = this.state;
        user[key] = value;
        var message = JSON.stringify(user);
        Janus.log(":: Sending message: ",message);
        videoroom.data({ text: message })
    };

    joinRoom = (reconnect) => {
        this.setState({delay: true});
        setTimeout(() => {
            this.setState({delay: false});
        }, 3000);
        let {janus, videoroom, selected_room, user, tested} = this.state;
        localStorage.setItem("room", selected_room);
        user.self_test = tested;
        initGxyProtocol(janus, user, protocol => {
            this.setState({protocol});
        }, ondata => {
            Janus.log("-- :: It's protocol public message: ", ondata);
            const {type,error_code,id,to} = ondata;
            if(type === "error" && error_code === 420) {
                alert(ondata.error);
                this.state.protocol.hangup();
            } else if(type === "joined") {
                let register = { "request": "join", "room": selected_room, "ptype": "publisher", "display": JSON.stringify(user) };
                videoroom.send({"message": register});
                this.setState({user, room: selected_room});
                setTimeout(() => {
                    this.micMute();
                }, 3000);
                this.chat.initChatRoom(user,selected_room);
                this.stream.initJanus();
            } else if(type === "chat-broadcast") {
                this.chat.showSupportMessage(ondata);
            } else if(type === "question" && user.id === to) {
                this.chat.showSupportMessage(ondata);
            } else if(type === "client-reconnect" && user.id === id) {
                this.exitRoom(true);
            } else if(type === "client-reload" && user.id === id) {
                window.location.reload();
            } else if(type === "client-disconnect" && user.id === id) {
                this.exitRoom();
            } else if(type === "client-mute" && user.id === id) {
                this.micMute();
            } else if(type === "sound-test" && user.id === id) {
                let {user} = this.state;
                user.sound_test = true;
                localStorage.setItem("sound_test", true);
                this.setState({user});
            }
            this.onProtocolData(ondata);
        });
    };

    exitRoom = (reconnect) => {
        let {videoroom, remoteFeed, protocol, room} = this.state;
        let leave = {request : "leave"};
        if(remoteFeed)
            remoteFeed.send({"message": leave});
        videoroom.send({"message": leave});
        this.chat.exitChatRoom(room);
        this.stream.exitJanus();
        this.stopForward(room);
        this.setState({
            muted: false, mystream: null, room: "", selected_room: (reconnect ? room : ""), i: "", feeds: [], mids: [], remoteFeed: null, question: false, trl_room: null
        });
        this.initVideoRoom(reconnect);
        protocol.detach();
    };

    selectRoom = (i) => {
        localStorage.setItem("trl_room", i);
        const {rooms} = this.state;
        let selected_room = rooms[i].room;
        let name = rooms[i].description;
        if (this.state.room === selected_room)
            return;
        let fw_port = lnglist[name].port;
        let trl_stream = lnglist[name].streamid;
        this.setState({selected_room,name,i,fw_port,trl_stream});
    };

    micMute = () => {
        let {videoroom, muted} = this.state;
        //mystream.getAudioTracks()[0].enabled = !muted;
        muted ? videoroom.unmuteAudio() : videoroom.muteAudio();
        this.setState({muted: !muted});
    };

    setAudio = (audios,options) => {
        this.setState({audios});
        this.stream.setAudio(audios, options)
    };

    toggleFullScreen = () => {
        this.stream.toggleFullScreen();
    };

    setStrVolume = (value,trl) => {
        this.stream.setVolume(value,trl);
    };

    muteStream = (trl) => {
        this.stream.audioMute(trl);
    };

    muteTrl = () => {
        const {trl_muted} = this.state;
        this.setState({trl_muted: !trl_muted});
    };

    setTrlVolume = (value) => {
        const {feeds} = this.state;
        for(let i=0; i<feeds.length; i++) {
            this.refs["remoteAudio" + feeds[i].id].volume = value;
        }
    };

    initConnection = () => {
        const {mystream} = this.state;
        mystream ? this.exitRoom() : this.joinRoom();
    };


    render() {

        const { feeds,rooms,room,audio_devices,audio_device,audios,i,muted,delay,mystream,selected_room,selftest,tested,trl_stream,trl_muted,user} = this.state;
        const autoPlay = true;
        const controls = false;

        let rooms_list = rooms.map((data,i) => {
            const {room, description} = data;
            return ({ key: room, text: description, value: i})
        });

        let adevices_list = audio_devices.map((device,i) => {
            const {label, deviceId} = device;
            return ({ key: i, text: label, value: deviceId})
        });

        let trlaudio = this.state.feeds.map((feed) => {
            if(feed) {
                let id = feed.display.rfid;
                //let talk = feed.talk;
                //let question = feed.question;
                //let name = feed.display.display;
                return (<audio
                        key={id}
                        ref={"remoteAudio" + id}
                        id={"remoteAudio" + id}
                        autoPlay={autoPlay}
                        controls={controls}
                        muted={trl_muted}
                        playsInline={true} />);
            }
            return true;
        });

        //let l = (<Label key='Carbon' floating size='mini' color='red'>{count}</Label>);

        const list = feeds.map((feed,i) => {
            if(feed) {
                let id = feed.display.rfid;
                let talk = feed.talk;
                //let question = feed.question;
                let name = feed.display.name;
                return (<Message key={id} className='trl_name' attached={i === feeds.length-1 ? 'bottom' : true} warning color={talk ? 'green' : 'red'} >{name}</Message>);
            }
            return true;
        });

        let login = (<LoginPage user={user} checkPermission={this.checkPermission} />);

        let content = (
            <div className="vclient" >
                <div className="vclient__toolbar">
                    <Menu icon='labeled' size="mini">
                        <Menu.Item disabled >
                            <Icon color={mystream ? 'green' : 'red'} name='power off'/>
                            {!mystream ? "Disconnected" : "Connected"}
                        </Menu.Item>
                        <Popup
                            trigger={<Menu.Item><Icon name="settings" color={!audio_device ? 'red' : ''} />Input Device</Menu.Item>}
                            on='click'
                            position='bottom left'
                        >
                            <Popup.Content>
                                <Select fluid
                                        disabled={mystream}
                                        error={!audio_device}
                                        placeholder="Select Device:"
                                        value={audio_device}
                                        options={adevices_list}
                                        onChange={(e, {value}) => this.setDevice(value)}/>
                            </Popup.Content>
                        </Popup>
                    </Menu>
                    <Menu icon='labeled' secondary size="mini">
                        <Select className='trl_select'
                                attached='left'
                                compact
                                disabled={mystream}
                                error={!selected_room}
                                placeholder="Translate to:"
                                value={i}
                                options={rooms_list}
                                onChange={(e, {value}) => this.selectRoom(value)} />
                        {mystream ?
                            <Button attached='right' size='huge' warning icon='sign-out' onClick={() => this.exitRoom(false)} />:""}
                        {!mystream ?
                            <Button attached='right' size='huge' positive loading={delay} icon='sign-in' disabled={delay || !selected_room || !audio_device} onClick={this.joinRoom} />:""}
                    </Menu>
                    <Menu icon='labeled' secondary size="mini" floated='right'>
                        {!mystream ?
                            <Menu.Item position='right' disabled={selftest !== "Mic Test" || mystream} onClick={this.selfTest}>
                                <Icon color={tested ? 'green' : 'red'} name="sound" />
                                {selftest}
                            </Menu.Item> : ""}
                        <Menu.Item disabled={!mystream} onClick={this.micMute} className="mute-button">
                            <canvas className={muted ? 'hidden' : 'vumeter'} ref="canvas1" id="canvas1" width="15" height="35" />
                            <Icon color={muted ? "red" : ""} name={!muted ? "microphone" : "microphone slash"} />
                            {!muted ? "ON" : "OFF"}
                        </Menu.Item>
                    </Menu>
                </div>

                <audio
                    ref="localVideo"
                    id="localVideo"
                    autoPlay={autoPlay}
                    controls={controls}
                    muted={true}
                    playsinline={true}/>

                {trlaudio}

                {mystream ? '' : <Divider fitted />}

                <Segment basic color='blue' className={mystream ? '' : 'hidden'}>
                    <Table basic='very' fixed>
                        <Table.Row>
                            <Table.Cell width={8} rowSpan='2'>
                                <Message color='grey' header='Online Translators:' list={list} />
                                <Segment.Group>
                                    <Stream ref={stream => {this.stream = stream;}} trl_stream={trl_stream} />
                                    <Segment.Group horizontal>
                                        <Segment>
                                            <Select compact
                                                    upward
                                                    error={!audios}
                                                    placeholder="Audio:"
                                                    value={audios}
                                                    options={audios_options}
                                                    onChange={(e, {value, options}) => this.setAudio(value, options)}/>
                                        </Segment>
                                        <Segment className='no-border' textAlign='right'>
                                            <Button color='blue'
                                                    icon='expand arrows alternate'
                                                    onClick={this.toggleFullScreen}/>
                                        </Segment>
                                    </Segment.Group>
                                </Segment.Group>
                            </Table.Cell>
                            <Table.Row>
                                <Table.Cell width={7}>
                                    <Segment padded color='green'>
                                        <VolumeSlider icon='blogger b' label='PetahTikva' volume={(value) => this.setStrVolume(value,true)} mute={() => this.muteStream(true)} />
                                        <VolumeSlider icon='address card' label='Translators' volume={this.setTrlVolume} mute={this.muteTrl} />
                                        <VolumeSlider icon='bullhorn' label='Broadcast' volume={this.setStrVolume} mute={() => this.muteStream(false)}/>
                                    </Segment>
                                </Table.Cell>
                            </Table.Row>
                            <Table.Row>
                                <Table.Cell width={7}>
                                    <Chat {...this.state}
                                          ref={chat => {this.chat = chat;}}
                                          visible={this.state.visible}
                                          janus={this.state.janus}
                                          room={room}
                                          user={this.state.user} />
                                </Table.Cell>
                            </Table.Row>
                        </Table.Row>
                    </Table>
                </Segment>
            </div>
        );

        return (

            <div>
                {user ? content : login}
            </div>

        );
    }
}

export default TrlClient;
