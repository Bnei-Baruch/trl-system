import React, { Component } from 'react';
import mqtt from "../../shared/mqtt";
import { Janus } from "../../lib/janus";
import {Menu, Select, Button, Icon, Popup, Segment, Message, Table, Divider, Modal} from "semantic-ui-react";
import {geoInfo, initJanus, getDevicesStream, micLevel, checkNotification, testDevices, testMic} from "../../shared/tools";
import './Client.scss'
import {audios_options, lnglist, GEO_IP_INFO} from "../../shared/consts";
import {kc} from "../../components/UserManager";
import ClientChat from "./ClientChat";
import VolumeSlider from "../../components/VolumeSlider";
import Stream from "../Stream/HttpStream";
import LoginPage from "../../components/LoginPage";
import HomerLimud from "../../components/HomerLimud";

class HttpClient extends Component {

    state = {
        audioContext: null,
        stream: null,
        audio_devices: [],
        audio_device: "",
        audio: null,
        janus: null,
        videostream: null,
        audiostream: null,
        feeds: {},
        trl_room: localStorage.getItem("trl_room"),
        rooms: [],
        room: "",
        selected_room: "",
        audiobridge: null,
        remotefeed: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        forward_id: null,
        muted: false,
        trl_muted: true,
        cammuted: false,
        shidur: false,
        protocol: null,
        user: null,
        audios: Number(localStorage.getItem("lang")) || 15,
        users: {},
        visible: true,
        selftest: "Mic Test",
        tested: false,
        video: true,
    };

    checkPermission = (user) => {
        const gxy_group = kc.hasRealmRole("trl_user");
        if (gxy_group) {
            delete user.roles;
            user.role = "user";
            this.initClient(user);
        } else {
            alert("Access denied!");
            kc.logout();
        }
    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    initClient = (user,error) => {
        checkNotification();
        geoInfo(`${GEO_IP_INFO}`, data => {
            user.ip = data.ip;
            initJanus(janus => {
                user.session = janus.getSessionId();
                user.system = navigator.userAgent;
                this.setState({janus, user});

                // Protocol init
                mqtt.init(user, (data) => {
                    console.log("[mqtt] init: ", data, user);
                    mqtt.join("trl/users/broadcast");
                    mqtt.join("trl/users/" + user.id);
                    this.chat.initChatEvents();
                    mqtt.watch((message) => {
                        this.handleCmdData(message);
                    });
                });

                this.initVideoRoom(error);
            }, er => {
                setTimeout(() => {
                    this.initClient(user,er);
                }, 5000);
            }, true);
        });
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
        this.setState({selftest: "Recording... 4"});
        testMic(this.state.stream);

        let rect = 4;
        let rec = setInterval(() => {
            rect--;
            this.setState({selftest: "Recording... " + rect});
            if(rect <= 0) {
                clearInterval(rec);
                let playt = 5;
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
        const {audiobridge} = this.state;
        if (audiobridge) {
            audiobridge.send({message: {request: "list"},
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
                }
            });
        }
    };

    iceState = () => {
        let count = 0;
        let chk = setInterval(() => {
            count++;
            let {ice,user} = this.state;
            if(count < 11 && ice === "connected") {
                clearInterval(chk);
            }
            if(count >= 10) {
                clearInterval(chk);
                this.exitRoom(false);
                alert("Network setting is changed!");
                this.initClient(user,true);
            }
        },3000);
    };

    mediaState = (media) => {
        if(media === "audio") {
            let count = 0;
            let chk = setInterval(() => {
                count++;
                let {audio,ice} = this.state;

                // Audio is back stop counter
                if(count < 11 && audio) {
                    clearInterval(chk);
                }

                // Network problem handled in iceState
                if(count < 11 && ice === "disconnected") {
                    clearInterval(chk);
                }

                // Audio still not back
                if(count >= 10 && !audio) {
                    clearInterval(chk);
                    this.exitRoom(false);
                    alert("Server stopped receiving our Audio! Check your Mic");
                }
            },3000);
        }
    };

    initVideoRoom = (reconnect) => {
        if(this.state.audiobridge)
            this.state.audiobridge.detach();
        this.state.janus.attach({
            plugin: "janus.plugin.audiobridge",
            opaqueId: "videoroom_user",
            success: (audiobridge) => {
                Janus.log(" :: My handle: ", audiobridge);
                Janus.log("Plugin attached! (" + audiobridge.getPlugin() + ", id=" + audiobridge.getId() + ")");
                Janus.log("  -- This is a publisher/manager");
                let {user} = this.state;
                user.handle = audiobridge.getId();
                this.setState({audiobridge, user, delay: false});
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
                this.setState({ice: state});
                if(state === "disconnected") {
                    // FIXME: ICE restart does not work properly, so we will do silent reconnect
                    this.iceState();
                }
            },
            mediaState: (media, on) => {
                Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + media);
                this.setState({[media]: on});
                if(!on) {
                    this.mediaState(media);
                }
            },
            webrtcState: (on) => {
                Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
            },
            slowLink: (uplink, nacks) => {
                Janus.log("Janus reports problems " + (uplink ? "sending" : "receiving") +
                    " packets on this PeerConnection (" + nacks + " NACKs/s " + (uplink ? "received" : "sent") + ")");
            },
            onmessage: (msg, jsep) => {
                this.onBridgeMessage(this.state.audiobridge, msg, jsep);
            },
            onlocaltrack: (track, on) => {
                Janus.log(" ::: Got a local track event :::");
                Janus.log("Local track " + (on ? "added" : "removed") + ":", track);
                this.setState({mystream: track});
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
            oncleanup: () => {
                Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
            }
        });
    };

    publishOwnFeed = () => {
        let {audiobridge,audio_device} = this.state;
        audiobridge.createOffer(
            {
                media: {video: false, audio: {
                        // autoGainControl: false,
                        echoCancellation: false,
                        highpassFilter: true,
                        noiseSuppression: true,
                        deviceId: {exact: audio_device}
                        }
                    },	// This is an audio only room
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

                    // Subscribe to mqtt topic
                    // FIXME: Make sure here the stream is initialized
                    setTimeout(() => {
                        mqtt.join("trl/room/" + msg["room"]);
                        mqtt.join("trl/room/" + msg["room"] + "/chat", true);
                    }, 3000);

                    this.stream.initJanus();

                    this.publishOwnFeed();
                    this.setState({muted: true});
                    // Any room participant?
                    if(msg["participants"]) {
                        const {feeds} = this.state;
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
                            feeds[id].talking = false;
                        }
                        this.setState({feeds});
                    }
                }
            } else if(event === "roomchanged") {
                // The user switched to a different room
                let myid = msg["id"];
                Janus.log("Moved to room " + msg["room"] + ", new ID: " + myid);
                // Any room participant?
                if(msg["participants"]) {
                    const {feeds} = this.state;
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
                        feeds[id].talking = false;
                    }
                    this.setState({feeds});
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
                    const {feeds} = this.state;
                    for(let f in list) {
                        let id = list[f]["id"];
                        //if(feeds[id]) return;
                        let user = JSON.parse(list[f]["display"]);
                        if(user.role !== "user")
                            continue
                        list[f]["display"] = user;
                        feeds[id] = list[f];
                        feeds[id].talking = false;
                    }
                    this.setState({feeds});
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

    handleCmdData = (ondata) => {
        Janus.log("-- :: It's protocol public message: ", ondata);
        const {user} = this.state;
        const {type, id, to} = ondata;

        if(type === "chat-broadcast") {
            this.chat.showSupportMessage(ondata);
        } else if(type === "support" && user.id === to) {
            this.chat.showSupportMessage(ondata);
        } else if(type === "client-reconnect" && user.id === id) {
            this.exitRoom(true);
        } else if(type === "client-reload" && user.id === id) {
            window.location.reload();
        } else if (type === 'client-reload-all') {
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
    };

    joinRoom = (reconnect) => {
        this.setState({delay: true});
        let {audiobridge, selected_room, user, tested} = this.state;
        localStorage.setItem("room", selected_room);
        user.self_test = tested;
        const param = new URL(window.location.href).searchParams.get("volume");
        const volume = param ? parseInt(param, 10) : 100;
        let register = {request: "join", prebuffer: 10, quality: 10, volume, room: selected_room, muted : true, display: JSON.stringify(user)};
        audiobridge.send({"message": register});
        this.setState({user, room: selected_room});
    };

    exitRoom = (reconnect) => {
        let {audiobridge, room} = this.state;
        audiobridge.send({"message": {request : "leave"}});
        this.stream.exitJanus();
        this.setState({muted: false, mystream: null, room: "", selected_room: (reconnect ? room : ""), i: "", feeds: {}, trl_room: null});
        this.initVideoRoom(reconnect);
        mqtt.exit("galaxy/room/" + room);
        mqtt.exit("galaxy/room/" + room + "/chat");
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
        let {audiobridge, muted} = this.state;
        let req = {request : "configure", muted: !muted}
        audiobridge.send({"message": req});
        this.setState({muted: !muted});
    };

    setAudio = (audios,options) => {
        this.setState({audios});
        this.stream.setAudio(audios, options)
    };

    toggleFullScreen = () => {
        this.stream.toggleFullScreen();
    };

    videoMute = () => {
        let {video} = this.state;
        this.setState({video: !video});
        this.stream.videoMute(!video);
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
        this.refs.remoteAudio.volume = value;
    };

    initConnection = () => {
        const {mystream} = this.state;
        mystream ? this.exitRoom() : this.joinRoom();
    };


    render() {

        const { feeds,rooms,room,audio_devices,audio_device,audios,i,muted,delay,mystream,selected_room,selftest,tested,trl_stream,trl_muted,user,video} = this.state;
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

        //let l = (<Label key='Carbon' floating size='mini' color='red'>{count}</Label>);

        const list = Object.values(feeds).map((feed,i) => {
            if(feed) {
                let id = feed.display.rfid;
                let role = feed.display.role;
                let talking = feed.talking;
                let muted = feed.muted;
                //let question = feed.question;
                let name = feed.display.name;
                return (<Message key={id} className='trl_name'
                                 attached={i === feeds.length-1 ? 'bottom' : true} warning
                                 color={!muted || talking ? 'green' : role === "user" ? 'red' : 'blue'} >{name}</Message>);
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
                        <Modal
                            trigger={<Menu.Item icon='book' name='Study Material'/>}
                            on='click'
                            closeIcon>
                            <HomerLimud />
                        </Modal>
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
                    playsInline={true}/>

                <audio
                    ref={"remoteAudio"}
                    id={"remoteAudio"}
                    autoPlay={autoPlay}
                    controls={controls}
                    muted={trl_muted}
                    playsInline={true} />

                {mystream ? '' : <Divider fitted />}

                <Segment basic color='blue' className={mystream ? '' : 'hidden'}>
                    <Table basic='very' fixed>
                        <Table.Row>
                            <Table.Cell width={8} rowSpan='2'>
                                <Message color='grey' header='Online Translators:' list={list} />
                                <Segment.Group>
                                    <Stream ref={stream => {this.stream = stream;}} trl_stream={trl_stream} video={video} />
                                    <Segment.Group horizontal>
                                        <Segment className='stream_langs'>
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
                                            <Button positive={video} negative={!video}
                                                    icon={video ? "eye" : "eye slash"}
                                                    onClick={this.videoMute} />
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
                                    <ClientChat {...this.state}
                                                ref={chat => {this.chat = chat;}}
                                                visible={this.state.visible}
                                                onCmdMsg={this.handleCmdData}
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

export default HttpClient;
