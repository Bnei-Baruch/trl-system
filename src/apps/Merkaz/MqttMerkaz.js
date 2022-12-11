import React, { Component } from 'react';
import log from "loglevel";
import mqtt from "../../shared/mqtt";
import device1 from "./device1";
import device2 from "./device2";
import {Menu, Select, Button, Icon, Popup, Segment, Message, Label, Divider, Modal, Grid} from "semantic-ui-react";
import {geoInfo, checkNotification, testMic, micVolume} from "../../shared/tools";
import './Client.scss'
import {audios_options, lnglist, GEO_IP_INFO, langs_list} from "../../shared/consts";
import {kc} from "../../components/UserManager";
import MarkazChat from "./MarkazChat";
import VolumeSlider from "../../components/VolumeSlider";
import LoginPage from "../../components/LoginPage";
import HomerLimud from "../../components/HomerLimud";
import {JanusMqtt} from "../../lib/janus-mqtt";
import {AudiobridgePlugin} from "../../lib/audiobridge-plugin";
import MerkazStream from "./MerkazStream";

class MqttMerkaz extends Component {

    state = {
        delay: true,
        audio1: {
            context: null,
            device: null,
            devices: {in: [], out: []},
            error: null,
            stream: null,
        },
        audio2: {
            context: null,
            device: null,
            devices: {in: [], out: []},
            error: null,
            stream: null,
        },
        audio1_out: localStorage.getItem("audio1_out"),
        audio2_out: localStorage.getItem("audio2_out"),
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
        muted1: false,
        muted2: false,
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
        mqtt.init("trl", user, (reconnected, error) => {
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
        device1.init().then(audio => {
            log.info("[client] init devices: ", audio);
            if (audio.error) {
                console.error(audio.error)
                alert("audio device not detected");
            }
            if (audio.stream) {
                let myaudio = this.refs.localAudio1;
                if (myaudio) myaudio.srcObject = audio.stream;
                if(this.refs?.canvas1) micVolume(this.refs.canvas1,1)
                this.setState({audio1: audio, init_devices: true, delay: false})
            }
        })
        device2.init().then(audio => {
            log.info("[client] init devices: ", audio);
            if (audio.error) {
                console.error(audio.error)
                alert("audio device not detected");
            }
            if (audio.stream) {
                let myaudio = this.refs.localAudio2;
                if (myaudio) myaudio.srcObject = audio.stream;
                if(this.refs?.canvas2) micVolume(this.refs.canvas2,2)
                this.setState({audio2: audio, init_devices: true, delay: false})
            }
        })
        // devices.onChange = (audio) => {
        //     setTimeout(() => {
        //         if(audio.device) {
        //             this.setDevice(audio.device)
        //         } else {
        //             log.warn("[client] No left audio devices")
        //             //FIXME: remove it from pc?
        //         }
        //     }, 1000)
        // }
    };

    setDevice = (device, c, io) => {
        if(io === "in") {
            if(c === 1) {
                device1.setAudioDevice(device, c).then(audio => {
                    if(audio.device) {
                        this.setState({audio1: audio});
                        const {audiobridge, mystream} = this.state;
                        micVolume(this.refs.canvas1,1)
                        if (audiobridge && mystream) {
                            audio.stream.getAudioTracks()[0].enabled = false;
                            audiobridge.audio(audio.stream)
                        }
                    }
                })
            }
            if(c === 2) {
                device2.setAudioDevice(device, c).then(audio => {
                    if(audio.device) {
                        this.setState({audio2: audio});
                        const {audiobridge, mystream} = this.state;
                        micVolume(this.refs.canvas2,2)
                        if (audiobridge && mystream) {
                            audio.stream.getAudioTracks()[0].enabled = false;
                            audiobridge.audio(audio.stream)
                        }
                    }
                })
            }
        }
        if(io === "out") {
            if(c === 1) {
                localStorage.setItem("audio1_out", device);
                this.setState({audio1_out: device});
                this.stream.setAudioOut(device, 1)
            }
            if(c === 2) {
                localStorage.setItem("audio2_out", device);
                this.setState({audio2_out: device});
                this.stream.setAudioOut(device, 2)
            }
        }
    };

    setStream = () => {
        const {audio1,audio2} = this.state;

        let in1 = new MediaStream();
        let in2 = new MediaStream();

        in1.addTrack(audio1.stream.getAudioTracks()[0]);
        in2.addTrack(audio2.stream.getAudioTracks()[0]);

        const audioContext = new AudioContext();

        let ctx1 = audioContext.createMediaStreamSource(in1);
        let ctx2 = audioContext.createMediaStreamSource(in1);

        let dst = audioContext.createMediaStreamDestination();

        ctx1.connect(dst);
        ctx2.connect(dst);

        return dst.stream
    }

    onFeedEvent = (list) => {
        log.debug("[client] Got feed event: ", list);
        const {feeds} = this.state;
        for(let f in list) {
            let id = list[f]["id"];
            let user = JSON.parse(list[f]["display"]);
            if(user.role === "admin")
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
        let {selected_room, user, tested} = this.state;
        let stream = this.setStream()
        localStorage.setItem("room", selected_room);
        user.self_test = tested;


        audiobridge.join(selected_room, user).then(data => {
            log.debug('[client] Joined respond :', data)
            audiobridge.publish(stream).then(data => {
                log.debug('[client] publish respond :', data)
                //device1.audio.context.suspend()
                //device2.audio.context.suspend()
                this.setState({mystream: stream})
                audiobridge.mute(false);
            }).catch(err => {
                log.error('[client] Publish error :', err);
                this.exitRoom(false);
            })

            this.onFeedEvent(data.participants)

            mqtt.join("trl/room/" + selected_room);
            mqtt.join("trl/room/" + selected_room + "/chat", true);

            this.chat.initChatEvents();

            this.stream.initJanus();

            //this.setState({muted1: true, muted2: true});
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
                this.setState({muted1: false, muted2: false, mystream: null, room: "", selected_room: (reconnect ? room : ""), i: "", feeds: {}, trl_room: null, delay: false});
                if(reconnect) this.initJanus(reconnect)
                if(!reconnect) {
                    device1.audio.context.resume()
                    device2.audio.context.resume()
                }
            })
        });
    };

    selectRoom = (i) => {
        localStorage.setItem("trl_room", i);
        let selected_room = langs_list[i].key;
        let name = langs_list[i].text;
        if (this.state.room === selected_room)
            return;
        let trl_stream = lnglist[name].trlid || lnglist[name].streamid;
        this.setState({selected_room,name,i,trl_stream});
    };

    micMute = (d) => {
        let {audiobridge, muted1,muted2,audio1,audio2} = this.state;
        //audiobridge.mute(!muted1);
        if(d === 1) {
            if(muted1) {
                audio1.stream.getAudioTracks()[0].enabled = true;
                device1.audio.context.resume()
            } else {
                audio1.stream.getAudioTracks()[0].enabled = false;
                device1.audio.context.suspend()
            }
            this.setState({muted1: !muted1});
        }
        if(d === 2) {
            if(muted2) {
                audio2.stream.getAudioTracks()[0].enabled = true;
                device2.audio.context.resume()
            } else {
                audio2.stream.getAudioTracks()[0].enabled = false;
                device2.audio.context.suspend()
            }
            this.setState({muted2: !muted2});
        }
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

        const {feeds,room,audio1,audio2,audios,i,muted1,muted2,delay,mystream,selected_room,audio1_out,audio2_out,trl_stream,trl_muted,user,video,janus} = this.state;
        const autoPlay = true;
        const controls = false;

        let adevice1_list_in = audio1.devices.in.map((device,i) => {
            const {label, deviceId} = device;
            return ({ key: i, text: label, value: deviceId})
        });

        let adevice2_list_in = audio2.devices.in.map((device,i) => {
            const {label, deviceId} = device;
            return ({ key: i, text: label, value: deviceId})
        });

        let adevice1_list_out = audio1.devices.out.map((device,i) => {
            const {label, deviceId} = device;
            return ({ key: i, text: label, value: deviceId})
        });

        let adevice2_list_out = audio2.devices.out.map((device,i) => {
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
                <Grid >

                    <Grid.Row>
                        <Grid.Column width={2}>
                            <div className="vclient__toolbar">
                                <Menu icon='labeled' secondary size="mini" floated='right'>
                                    <Menu.Item disabled={!mystream} onClick={() => this.micMute(1)} className="mute-button">
                                        <canvas className={muted1 ? 'hidden' : 'vumeter'} ref="canvas1" id="canvas1" width="15" height="35" />
                                        <Icon color={muted1 ? "red" : ""} name={!muted1 ? "microphone" : "microphone slash"} />
                                        {!muted1 ? "ON" : "OFF"}
                                    </Menu.Item>
                                </Menu>
                                <Popup
                                    trigger={<Label as='a' basic><Icon name="plug" color={!audio1.device ? 'red' : ''} /> Input</Label>}
                                    on='click'
                                    position='bottom left'
                                >
                                    <Popup.Content>
                                        <Select fluid
                                                error={!audio1.device}
                                                placeholder="Select Device:"
                                                value={audio1.device}
                                                options={adevice1_list_in}
                                                onChange={(e, {value}) => this.setDevice(value, 1, "in")}/>
                                    </Popup.Content>
                                </Popup>
                            </div>
                        </Grid.Column>
                        <Grid.Column width={10}>
                            <div className="vclient__toolbar">
                                <Menu icon='labeled' size="mini">
                                    <Menu.Item disabled >
                                        <Icon color={mystream ? 'green' : 'red'} name='power off'/>
                                        {!mystream ? "Disconnected" : "Connected"}
                                    </Menu.Item>
                                    <Modal
                                        trigger={<Menu.Item icon='book' name='Study Material'/>}
                                        on='click'
                                        closeIcon>
                                        <HomerLimud />
                                    </Modal>
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
                                        <Button attached='right' size='huge' positive icon='sign-in' disabled={delay || !selected_room || !audio2.device} onClick={this.initJanus} />:""}
                                </Menu>
                            </div>
                        </Grid.Column>
                        <Grid.Column width={2}>
                            <div className="vclient__toolbar">
                                <Menu icon='labeled' secondary size="mini" floated='right'>
                                    <Menu.Item disabled={!mystream} onClick={() => this.micMute(2)} className="mute-button">
                                        <canvas className={muted2 ? 'hidden' : 'vumeter'} ref="canvas2" id="canvas2" width="15" height="35" />
                                        <Icon color={muted2 ? "red" : ""} name={!muted2 ? "microphone" : "microphone slash"} />
                                        {!muted2 ? "ON" : "OFF"}
                                    </Menu.Item>
                                </Menu>
                                <Popup
                                    trigger={<Label as='a' basic><Icon name="plug" color={!audio2.device ? 'red' : ''} /> Input</Label>}
                                    on='click'
                                    position='bottom left'
                                >
                                    <Popup.Content>
                                        <Select fluid
                                                error={!audio2.device}
                                                placeholder="Select Device:"
                                                value={audio2.device}
                                                options={adevice2_list_in}
                                                onChange={(e, {value}) => this.setDevice(value, 2, "in")}/>
                                    </Popup.Content>
                                </Popup>
                            </div>
                        </Grid.Column>
                    </Grid.Row>

                    <Grid.Row stretched>
                        <Grid.Column width={2}>
                            <Segment basic>
                                <VolumeSlider orientation='vertical' icon='blogger b' label='1'
                                              volume={(value) => this.setStrVolume(value,1)}
                                              mute={() => this.muteStream(1)} />
                            </Segment>
                            <Popup
                                trigger={<Label as='a' basic><Icon name="headphones" color={!audio1.out ? 'red' : ''} /> Output</Label>}
                                on='click'
                                position='bottom left'
                            >
                                <Popup.Content>
                                    <Select fluid
                                            error={!audio1_out}
                                            placeholder="Select Device:"
                                            value={audio1_out}
                                            options={adevice1_list_out}
                                            onChange={(e, {value}) => this.setDevice(value, 1, "out")}/>
                                </Popup.Content>
                            </Popup>
                        </Grid.Column>
                        <Grid.Column width={10}>
                            <Segment.Group>
                                <MerkazStream ref={stream => {this.stream = stream;}} trl_stream={trl_stream} video={video} janus={janus} />
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
                                    <Segment className='stream_langs' textAlign='right'>
                                        <Select compact
                                                upward
                                                error={!audios}
                                                placeholder="Audio:"
                                                value={audios}
                                                options={audios_options}
                                                onChange={(e, {value, options}) => this.setAudio(value, options)}/>
                                    </Segment>
                                </Segment.Group>
                            </Segment.Group>

                            <audio
                                ref="localAudio1"
                                id="localAudio1"
                                autoPlay={autoPlay}
                                controls={controls}
                                muted={true}
                                playsInline={true}/>

                            <audio
                                ref="localAudio2"
                                id="localAudio2"
                                autoPlay={autoPlay}
                                controls={controls}
                                muted={true}
                                playsInline={true}/>

                            {mystream ? '' : <Divider fitted />}
                            <Segment padded color='green'>
                                {/*<VolumeSlider orientation='horizontal' icon='blogger b' label='PetahTikva' volume={(value) => this.setStrVolume(value,true)} mute={() => this.muteStream(true)} />*/}
                                <VolumeSlider orientation='horizontal' icon='address card' label='Translators' volume={this.setTrlVolume} mute={this.muteTrl} />
                                {/*<VolumeSlider orientation='horizontal' icon='bullhorn' label='Broadcast' volume={this.setStrVolume} mute={() => this.muteStream(false)}/>*/}
                            </Segment>
                        </Grid.Column>
                        <Grid.Column width={2}>
                            <Segment basic>
                                <VolumeSlider orientation='vertical' icon='blogger b' label='2'
                                              volume={(value) => this.setStrVolume(value,2)}
                                              mute={() => this.muteStream(2)} />
                            </Segment>
                            <Popup
                                trigger={<Label as='a' basic><Icon name="headphones" color={!audio2.out ? 'red' : ''} /> Output</Label>}
                                on='click'
                                position='bottom left'
                            >
                                <Popup.Content>
                                    <Select fluid
                                            error={!audio2_out}
                                            placeholder="Select Device:"
                                            value={audio2_out}
                                            options={adevice2_list_out}
                                            onChange={(e, {value}) => this.setDevice(value, 2, "out")}/>
                                </Popup.Content>
                            </Popup>
                        </Grid.Column>
                    </Grid.Row>

                    <Grid.Row stretched>
                        <Grid.Column width={2}>
                            <Segment textAlign='center' basic>

                            </Segment>
                        </Grid.Column>
                        <Grid.Column width={10}>
                            <Message color='grey' header='Online Translators:' list={list} />
                            <MarkazChat {...this.state}
                                        ref={chat => {this.chat = chat;}}
                                        visible={this.state.visible}
                                        onCmdMsg={this.handleCmdData}
                                        room={room}
                                        user={this.state.user} />
                        </Grid.Column>
                        <Grid.Column width={2}>
                            <Segment textAlign='center' basic>

                            </Segment>
                        </Grid.Column>
                    </Grid.Row>
                </Grid>

            </div>
        );

        return (

            <div>
                {user ? content : login}
            </div>

        );
    }
}

export default MqttMerkaz;
