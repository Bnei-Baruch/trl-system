import React, { Component } from 'react';
import log from "loglevel";
import mqtt from "../../shared/mqtt";
import devices from "../../lib/devices";
import {Menu, Select, Button, Icon, Popup, Segment, Message, Table, Divider, Modal} from "semantic-ui-react";
import {geoInfo, checkNotification, testMic, micVolume} from "../../shared/tools";
import './Client.scss'
import {audios_options, lnglist, GEO_IP_INFO, langs_list} from "../../shared/consts";
import {kc} from "../../components/UserManager";
import ClientChat from "./ClientChat";
import VolumeSlider from "../../components/VolumeSlider";
import LoginPage from "../../components/LoginPage";
import HomerLimud from "../../components/HomerLimud";
import MqttStream from "../Stream/MqttStream";
import {JanusMqtt} from "../../lib/janus-mqtt";
import {AudiobridgePlugin} from "../../lib/audiobridge-plugin";

class MqttClient extends Component {

    state = {
        delay: true,
        audio: {
            context: null,
            device: null,
            devices: [],
            error: null,
            stream: null,
        },
        janus: null,
        videostream: null,
        audiostream: null,
        feeds: {},
        trl_room: localStorage.getItem("trl_room"),
        room: "",
        selected_room: "",
        audiobridge: null,
        remotefeed: null,
        myid: null,
        mypvtid: null,
        mystream: null,
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
        init_devices: false
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

    initClient = (user) => {
        if(this.state.trl_room !== null)
            this.selectRoom(Number(this.state.trl_room));
        checkNotification();
        geoInfo(`${GEO_IP_INFO}`, data => {
            user.ip = data.ip;
            user.system = navigator.userAgent;
            this.setState({user})
            this.initMQTT(user)
        });
    };

    initMQTT = (user) => {
        mqtt.init(user, (reconnected, error) => {
            if (error) {
                log.info("[client] MQTT disconnected");
                this.setState({mqttOn: false});
                window.location.reload()
                alert("- Lost Connection to TRL System -")
            } else if (reconnected) {
                this.setState({mqttOn: true});
                log.info("[client] MQTT reconnected");
            } else {
                this.setState({mqttOn: true});
                mqtt.join("trl/users/broadcast");
                mqtt.join("trl/users/" + user.id);
                this.initDevices();
                mqtt.watch((message) => {
                    this.handleCmdData(message);
                });
            }
        });
    };

    initJanus = (reconnect = false) => {
        this.setState({delay: true});
        const {user} = this.state;
        let janus = new JanusMqtt(user, "trl1")
        janus.onStatus = (srv, status) => {
            if(status === "offline") {
                alert("Janus Server - " + srv + " - Offline")
                window.location.reload()
            }

            if(status === "error") {
                log.error("[client] Janus error, reconnecting...")
                this.exitRoom(false);
            }
        }

        let audiobridge = new AudiobridgePlugin();
        audiobridge.onFeedEvent = this.onFeedEvent
        audiobridge.onTrack = this.onTrack
        audiobridge.onLeave = this.onLeave

        janus.init().then(data => {
            log.info("[client] Janus init", data)
            janus.attach(audiobridge).then(data => {
                log.info('[client] Publisher Handle: ', data);
                this.setState({janus, audiobridge});
                this.joinRoom(data, reconnect);
            })
        }).catch(err => {
            log.error("[client] Janus init", err);
            this.exitRoom(false);
        })

    }

    initDevices = () => {
        if(this.state.init_devices) return
        devices.init().then(audio => {
            log.info("[client] init devices: ", audio);
            if (audio.error) {
                alert("audio device not detected");
            }
            if (audio.stream) {
                let myaudio = this.refs.localVideo;
                if (myaudio) myaudio.srcObject = audio.stream;
                if(this.refs?.canvas1) micVolume(this.refs.canvas1)
                this.setState({audio, init_devices: true, delay: false})
            }
        })
        devices.onChange = (audio) => {
            setTimeout(() => {
                if(audio.device) {
                    this.setDevice(audio.device)
                } else {
                    log.warn("[client] No left audio devices")
                    //FIXME: remove it from pc?
                }
            }, 1000)
        }
    };

    setDevice = (device, cam_mute) => {
        devices.setAudioDevice(device, cam_mute).then(audio => {
            if(audio.device) {
                this.setState({audio});
                const {audiobridge, mystream} = this.state;
                micVolume(this.refs.canvas1)
                if (audiobridge && mystream) {
                    audio.stream.getAudioTracks()[0].enabled = false;
                    audiobridge.audio(audio.stream)
                }
            }
        })
    };

    onFeedEvent = (list) => {
        log.debug("[client] Got feed event: ", list);
        const {feeds} = this.state;
        for(let f in list) {
            let id = list[f]["id"];
            let user = JSON.parse(list[f]["display"]);
            if(user.role !== "user")
                continue
            list[f]["display"] = user;
            feeds[id] = list[f];
        }
        this.setState({feeds});
    }

    onLeave = (id) => {
        const {feeds} = this.state;
        delete feeds[id];
        this.setState({feeds});
    }

    onTrack = (track, mid, on) => {
        log.debug("[client] >> This track is coming from feed :", mid, on);
        let stream = new MediaStream();
        stream.addTrack(track.clone());
        log.debug("[client] Created remote audio stream: ", stream);
        let remoteaudio = this.refs.remoteAudio;
        if(remoteaudio) remoteaudio.srcObject = stream;
    }

    selfTest = () => {
        this.setState({selftest: "Recording... 4"});
        testMic(this.state.audio.stream);

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

    handleCmdData = (ondata) => {
        log.debug("-- :: It's protocol public message: ", ondata);
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
            this.exitRoom(false);
        } else if(type === "client-mute" && user.id === id) {
            this.micMute();
        } else if(type === "sound-test" && user.id === id) {
            let {user} = this.state;
            user.sound_test = true;
            localStorage.setItem("sound_test", true);
            this.setState({user});
        }
    };

    joinRoom = (audiobridge, reconnect = false) => {
        let {selected_room, user, tested, audio: {stream}} = this.state;
        localStorage.setItem("room", selected_room);
        user.self_test = tested;


        audiobridge.join(selected_room, user).then(data => {
            log.debug('[client] Joined respond :', data)
            audiobridge.publish(stream).then(data => {
                log.debug('[client] publish respond :', data)
                devices.audio.context.suspend()
                this.setState({mystream: stream})
            }).catch(err => {
                log.error('[client] Publish error :', err);
                this.exitRoom(false);
            })

            this.onFeedEvent(data.participants)

            mqtt.join("trl/room/" + selected_room);
            mqtt.join("trl/room/" + selected_room + "/chat", true);

            this.chat.initChatEvents();

            this.stream.initJanus();

            this.setState({muted: true});
        }).catch(err => {
            log.error('[client] Join error :', err);
            this.exitRoom(false);
        })


        this.setState({user, room: selected_room});
    };

    exitRoom = (reconnect = false) => {
        let {audiobridge, room, janus} = this.state;
        audiobridge.leave().then(() => {
            this.stream.exitJanus()
            janus.destroy().then(() => {
                mqtt.exit("trl/room/" + room);
                mqtt.exit("trl/room/" + room + "/chat");
                this.setState({muted: false, mystream: null, room: "", selected_room: (reconnect ? room : ""), i: "", feeds: {}, trl_room: null, delay: false});
                if(reconnect) this.initJanus(reconnect)
                if(!reconnect) devices.audio.context.resume()
            })
        });
    };

    selectRoom = (i) => {
        localStorage.setItem("trl_room", i);
        let selected_room = langs_list[i].key;
        let name = langs_list[i].text;
        if (this.state.room === selected_room)
            return;
        let trl_stream = lnglist[name].streamid;
        this.setState({selected_room,name,i,trl_stream});
    };

    micMute = () => {
        let {audiobridge, muted} = this.state;
        audiobridge.mute(!muted);
        muted ? devices.audio.context.resume() : devices.audio.context.suspend()
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

    render() {

        const {feeds,room,audio:{devices,device},audios,i,muted,delay,mystream,selected_room,selftest,tested,trl_stream,trl_muted,user,video,janus} = this.state;
        const autoPlay = true;
        const controls = false;

        let adevices_list = devices.map((device,i) => {
            const {label, deviceId} = device;
            return ({ key: i, text: label, value: deviceId})
        });

        const list = Object.values(feeds).map((feed,i) => {
            if(feed) {
                const {muted, display: {rfid, role, name}} = feed
                return (<Message key={rfid} className='trl_name'
                                 attached={i === feeds.length-1 ? 'bottom' : true} warning
                                 color={!muted ? 'green' : role === "user" ? 'red' : 'blue'} >{name}</Message>);
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
                            trigger={<Menu.Item><Icon name="settings" color={!device ? 'red' : ''} />Input Device</Menu.Item>}
                            on='click'
                            position='bottom left'
                        >
                            <Popup.Content>
                                <Select fluid
                                        error={!device}
                                        placeholder="Select Device:"
                                        value={device}
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
                                options={langs_list}
                                onChange={(e, {value}) => this.selectRoom(value)} />
                        {mystream ?
                            <Button attached='right' size='huge' warning icon='sign-out' onClick={() => this.exitRoom(false)} />:""}
                        {!mystream ?
                            <Button attached='right' size='huge' positive icon='sign-in' disabled={delay || !selected_room || !device} onClick={this.initJanus} />:""}
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
                                    <MqttStream ref={stream => {this.stream = stream;}} trl_stream={trl_stream} video={video} janus={janus} />
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

export default MqttClient;
