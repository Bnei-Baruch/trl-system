import React, { Component } from 'react';
import log from "loglevel";
import mqtt from "../../shared/mqtt";
import device1 from "./device1";
import device2 from "./device2";
import { Button, Badge, Group, Modal, ActionIcon, Paper, Stack, Popover, Select, Alert, Text, Grid, SimpleGrid, Container } from '@mantine/core';
import { IconMicrophone, IconMicrophoneOff, IconPlug, IconPower, IconBook, IconHeadphones, IconLogin, IconLogout, IconInfoCircle } from '@tabler/icons-react';
import {geoInfo, checkNotification, testMic, micVolume, cloneTrl, setupLogCapture} from "../../shared/tools";
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
import version from '../../version.js';

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
        audiobridge1: null,
        audiobridge2: null,
        remotefeed: null,
        myid: null,
        mypvtid: null,
        mystream1: null,
        mystream2: null,
        muted1: false,
        muted2: false,
        trl_muted1: true,
        trl_muted2: true,
        cammuted: false,
        shidur: false,
        protocol: null,
        user: null,
        audios1: Number(localStorage.getItem("lang_trl1")) || 15,
        audios2: Number(localStorage.getItem("lang_trl2")) || 15,
        users: {},
        visible: true,
        selftest: "Mic Test",
        tested: false,
        video: false,
        init_devices: false,
        studyModalOpen: false
    };

    checkPermission = (user) => {
        log.info(" :: Version :: ", version);
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
        document.removeEventListener("keydown", this.onKeyPressed);
        window.removeEventListener('resize', this.initVolumeMeter);
        this.state.janus.destroy();
    };

    componentDidMount() {
        document.addEventListener("keydown", this.onKeyPressed);
        setupLogCapture();
        
        // Improved initialization for volume meters
        const initVolumeMeter = () => {
            if (this.refs?.canvas1) {
                const container = this.refs.canvas1.parentElement;
                if (container) {
                    // Set canvas dimensions to match container width
                    this.refs.canvas1.width = container.clientWidth;
                }
                
                // Force clear the canvas first
                const ctx1 = this.refs.canvas1.getContext('2d');
                ctx1.clearRect(0, 0, this.refs.canvas1.width, this.refs.canvas1.height);
                
                // Initialize the volume meter
                micVolume(this.refs.canvas1, 1);
                
                // Ensure audio context is initialized if available
                if (device1.audio && device1.audio.context) {
                    device1.initMicLevel();
                }
            }
            
            if (this.refs?.canvas2) {
                const container = this.refs.canvas2.parentElement;
                if (container) {
                    // Set canvas dimensions to match container width
                    this.refs.canvas2.width = container.clientWidth;
                }
                
                // Force clear the canvas first
                const ctx2 = this.refs.canvas2.getContext('2d');
                ctx2.clearRect(0, 0, this.refs.canvas2.width, this.refs.canvas2.height);
                
                // Initialize the volume meter
                micVolume(this.refs.canvas2, 2);
                
                // Ensure audio context is initialized if available
                if (device2.audio && device2.audio.context) {
                    device2.initMicLevel();
                }
            }
            
            console.log("Volume meters initialized");
        };
        
        // Initial setup
        initVolumeMeter();
        
        // Make multiple attempts to initialize, as sometimes the canvases may not be ready immediately
        setTimeout(initVolumeMeter, 500);
        setTimeout(initVolumeMeter, 1000);
        setTimeout(initVolumeMeter, 2000);
        
        // Re-initialize after device configuration if needed
        if (this.state.init_devices) {
            this.initDevices();
        }
        
        // Handle window resize to adjust canvas dimensions
        window.addEventListener('resize', initVolumeMeter);
    };

    onKeyPressed = (e) => {
        // Minus key ('-' на английской и русской раскладке)
        if(e.code === "Minus" || e.key === "-" || e.key === "-") {
            // Toggle the right microphone when '-' is pressed
            this.micMute(2);  // Right microphone (second microphone)
        }
        // Backquote key ('`' на английской, 'ё' на русской раскладке)
        else if(e.code === "Backquote" || e.key === "`" || e.key === "ё" || e.key === "Ё") {
            // Toggle the left microphone when '`' is pressed
            this.micMute(1);  // Left microphone (first microphone)
        }
    };

    initClient = () => {
        const user = {id: "bb_trl", email: "trl@merkaz.bb", name: "BB TRL", role: "user", display: "BB TRL"};
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
        mqtt.init("trl1", user, (reconnected, error) => {
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

        let audiobridge1 = new AudiobridgePlugin();
        let audiobridge2 = new AudiobridgePlugin();
        audiobridge1.onFeedEvent = this.onFeedEvent1
        audiobridge2.onFeedEvent = this.onFeedEvent2
        audiobridge1.onTrack = this.onTrack1
        audiobridge2.onTrack = this.onTrack2
        audiobridge1.onLeave = this.onLeave1
        audiobridge2.onLeave = this.onLeave2

        janus.init().then(data => {
            log.info("[client] Janus init", data)
            janus.attach(audiobridge1).then(data => {
                log.info('[client1] Publisher Handle: ', data);
                this.setState({janus, audiobridge1});
                this.joinRoom(data, reconnect, 1);
            })
            janus.attach(audiobridge2).then(data => {
                log.info('[client2] Publisher Handle: ', data);
                this.setState({audiobridge2});
                this.joinRoom(data, reconnect, 2);
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
                if(this.refs?.canvas1) {
                    micVolume(this.refs.canvas1, 1);
                    // Ensure audio context is active
                    device1.initMicLevel();
                    // Reset the mute callback
                    device1.onMute = ((muted, rms) => {
                        const {muted1} = this.state;
                        if(muted1 !== muted) {
                            log.info("MIC1 - muted: " + muted + " rms: " + rms);
                            this.setState({muted1: muted});
                        }
                    });
                }
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
                if(this.refs?.canvas2) {
                    micVolume(this.refs.canvas2, 2);
                    // Ensure audio context is active
                    device2.initMicLevel();
                    // Reset the mute callback
                    device2.onMute = ((muted, rms) => {
                        const {muted2} = this.state;
                        if(muted2 !== muted) {
                            log.info("MIC2 - muted: " + muted + " rms: " + rms);
                            this.setState({muted2: muted});
                        }
                    });
                }
                this.setState({audio2: audio, init_devices: true, delay: false})
            }
        })
    };

    setDevice = (device, c, io) => {
        if(io === "in") {
            if(c === 1) {
                device1.setAudioDevice(device, c).then(audio => {
                    if(audio.device) {
                        this.setState({audio1: audio});
                        const {audiobridge1, mystream} = this.state;
                        if(this.refs?.canvas1) {
                            micVolume(this.refs.canvas1, 1);
                            device1.initMicLevel();
                        }
                        if (audiobridge1 && mystream) {
                            audio.stream.getAudioTracks()[0].enabled = false;
                            audiobridge1.audio(audio.stream);
                        }
                    }
                });
            }
            if(c === 2) {
                device2.setAudioDevice(device, c).then(audio => {
                    if(audio.device) {
                        this.setState({audio2: audio});
                        const {audiobridge2, mystream} = this.state;
                        if(this.refs?.canvas2) {
                            micVolume(this.refs.canvas2, 2);
                            device2.initMicLevel();
                        }
                        if (audiobridge2 && mystream) {
                            audio.stream.getAudioTracks()[0].enabled = false;
                            audiobridge2.audio(audio.stream);
                        }
                    }
                });
            }
        }
        if(io === "out") {
            if(c === 1) {
                localStorage.setItem("audio1_out", device);
                this.setState({audio1_out: device});
                this.stream.setAudioOut(device, 1)
                window["trl"+1].setSinkId(device)
            }
            if(c === 2) {
                localStorage.setItem("audio2_out", device);
                this.setState({audio2_out: device});
                this.stream.setAudioOut(device, 2)
                window["trl"+2].setSinkId(device)
            }
        }
    };

    onFeedEvent1 = (list) => {
        log.debug("[client] Got feed event: ", list);
        const {feeds} = this.state;
        for(let f in list) {
            let id = list[f]["id"];
            let user = JSON.parse(list[f]["display"]);
            if(user.role === "admin" || user.id === "bb_trl")
                continue
            list[f]["display"] = user;
            feeds[id] = list[f];
        }
        this.setState({feeds});
    }

    onLeave1 = (id) => {
        const {feeds} = this.state;
        delete feeds[id];
        this.setState({feeds});
    }

    onTrack1 = (track, mid, on) => {
        log.debug("[client1] >> This track is coming from feed :", mid, on);
        let stream = new MediaStream([track]);
        log.debug("[client1] Created remote audio stream: ", stream);
        let remoteaudio1 = this.refs.remoteAudio1;
        if(remoteaudio1) remoteaudio1.srcObject = stream;
        cloneTrl(stream, 1);
    }

    onFeedEvent2 = (list) => {
        // log.debug("[client2] Got feed event: ", list);
        // const {feeds} = this.state;
        // for(let f in list) {
        //     let id = list[f]["id"];
        //     let user = JSON.parse(list[f]["display"]);
        //     if(user.role === "admin")
        //         continue
        //     list[f]["display"] = user;
        //     feeds[id] = list[f];
        // }
        // this.setState({feeds});
    }

    onLeave2 = (id) => {
        // const {feeds} = this.state;
        // delete feeds[id];
        // this.setState({feeds});
    }

    onTrack2 = (track, mid, on) => {
        log.debug("[client2] >> This track is coming from feed :", mid, on);
        let stream = new MediaStream([track]);
        log.debug("[client2] Created remote audio stream: ", stream);
        let remoteaudio2 = this.refs.remoteAudio2;
        if(remoteaudio2) remoteaudio2.srcObject = stream;
        cloneTrl(stream, 2);
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

    joinRoom = (audiobridge, reconnect = false, t) => {
        let {selected_room, user, tested, audio1, audio2} = this.state;
        localStorage.setItem("room", selected_room);
        user.self_test = tested;

        if(t === 1) {
            audiobridge.join(selected_room, user).then(data => {
                log.debug('[client1] Joined :', user)
                log.debug('[client1] Joined respond :', data)
                audiobridge.publish(audio1.stream).then(data => {
                    log.debug('[client1] publish respond :', data)
                    this.setState({mystream: audio1.stream})
                    this.micMute(1)
                }).catch(err => {
                    log.error('[client1] Publish error :', err);
                    this.exitRoom(false);
                })

                this.onFeedEvent1(data.participants)

                mqtt.join("trl/room/" + selected_room);
                mqtt.join("trl/room/" + selected_room + "/chat", true);

                this.chat.initChatEvents();

                this.stream.initJanus();

                //this.setState({muted1: true, muted2: true});
            }).catch(err => {
                log.error('[client1] Join error :', err);
                this.exitRoom(false);
            })
        }

        if(t === 2) {
            audiobridge.join(selected_room, user).then(data => {
                log.debug('[client2] Joined respond :', data)
                audiobridge.publish(audio2.stream).then(data => {
                    log.debug('[client2] publish respond :', data)
                    this.micMute(2)
                }).catch(err => {
                    log.error('[client2] Publish error :', err);
                    this.exitRoom(false);
                })
            }).catch(err => {
                log.error('[client2] Join error :', err);
                this.exitRoom(false);
            })
        }


        this.setState({user, room: selected_room});
    };

    exitRoom = (reconnect = false) => {
        let {audiobridge1, audiobridge2, room, janus} = this.state;
        this.stream.exitJanus()
        audiobridge2.leave()
        audiobridge1.leave().then(() => {
            janus.destroy().then(() => {
                mqtt.exit("trl/room/" + room);
                mqtt.exit("trl/room/" + room + "/chat");
                this.setState({muted1: false, muted2: false, mystream: null, room: "", selected_room: (reconnect ? room : ""), i: "", feeds: {}, trl_room: null, delay: false});
                if(reconnect) this.initJanus(reconnect)
                if(!reconnect) {
                    window.location.reload()
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
        let {audiobridge1,audiobridge2,muted1,muted2,audio1,audio2} = this.state;
        if(d === 1) {
            if(muted1) {
                audio1.stream.getAudioTracks()[0].enabled = true;
                device1.audio.context.resume()
            } else {
                audio1.stream.getAudioTracks()[0].enabled = false;
                device1.audio.context.suspend()
            }
            audiobridge1.mute(!muted1);
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
            audiobridge2.mute(!muted2);
            this.setState({muted2: !muted2});
        }
    };

    setAudio = (audios,options,t) => {
        if(t === 1) {
            this.setState({audios1: audios});
            this.stream.setAudio(audios, options, t)
        }
        if(t === 2) {
            this.setState({audios2: audios});
            this.stream.setAudio(audios, options, t)
        }
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

    setTrlVolume = (value, trl) => {
        try { const audioEl = window["trl"+trl]; if(audioEl) { audioEl.volume = value; } } catch(e) { console.warn("Audio element not ready"); }
    };

    muteTrl = (trl) => {
        if(trl === 1) {
            const {trl_muted1} = this.state;
            this.setState({trl_muted1: !trl_muted1});
            try { const audioEl = window["trl"+trl]; if(audioEl) { audioEl.muted = !trl_muted1; } } catch(e) {}
        }
        if(trl === 2) {
            const {trl_muted2} = this.state;
            this.setState({trl_muted2: !trl_muted2});
            try { const audioEl = window["trl"+trl]; if(audioEl) { audioEl.muted = !trl_muted2; } } catch(e) {}
        }
        // Safely handled
    };

    toggleStudyModal = () => {
        this.setState({ studyModalOpen: !this.state.studyModalOpen });
    };

    render() {

        const {feeds, room, audio1, audio2, audios1, audios2, i, muted1, muted2, delay,
               mystream, selected_room, audio1_out, audio2_out, trl_stream, user,
               video, janus, studyModalOpen} = this.state;
        const autoPlay = true;
        const controls = false;

        let adevice1_list_in = audio1.devices.in.map((device,i) => {
            const {label, deviceId} = device;
            return ({ value: deviceId, label: label });
        });

        let adevice2_list_in = audio2.devices.in.map((device,i) => {
            const {label, deviceId} = device;
            return ({ value: deviceId, label: label });
        });

        let adevice1_list_out = audio1.devices.out.map((device,i) => {
            const {label, deviceId} = device;
            return ({ value: deviceId, label: label });
        });

        let adevice2_list_out = audio2.devices.out.map((device,i) => {
            const {label, deviceId} = device;
            return ({ value: deviceId, label: label });
        });

        // Format the langs_list for Mantine Select
        const langs_options = langs_list.map((lang, index) => ({
            value: index.toString(),
            label: lang.text
        }));

        const list = Object.values(feeds).map((feed,i) => {
            if(feed) {
                const {muted, display: {rfid, role, name}} = feed;
                let color = !muted ? 'green' : role === "user" ? 'red' : 'blue';
                return (
                    <Text key={rfid} color={color} weight="bold" size="md">
                        {name}
                    </Text>
                );
            }
            return null;
        }).filter(item => item !== null);

        let login = (<LoginPage user={user} checkPermission={this.checkPermission} />);

        let content = (
            <div className="vclient" >
                <Container fluid>
                    <Grid>
                        <Grid.Col span={2} style={{ position: 'relative' }}>
                            {/* Large background volume indicator */}
                            <div style={{ 
                                position: 'absolute', 
                                top: 0, 
                                left: 0, 
                                width: '100%', 
                                height: '100%', 
                                zIndex: 0,
                                display: 'flex',
                                justifyContent: 'center',
                                padding: '0',
                            }}>
                                <canvas 
                                    ref="canvas1" 
                                    id="canvas1" 
                                    width="190" 
                                    height="450" 
                                    style={{ 
                                        width: '100%',
                                        background: '#f0f0f0',
                                        opacity: 0.8,
                                        position: 'absolute',
                                        top: '200px',
                                        left: 0
                                    }} 
                                />
                            </div>
                            
                            {/* Content on top of volume indicator */}
                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <div className="vclient__toolbar">
                                    <Group position="center" style={{ marginTop: '20px', marginBottom: '20px' }}>
                                        <div style={{ 
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            alignItems: 'center',
                                            marginBottom: '10px'
                                        }}>
                                            <div 
                                                style={{ 
                                                    width: '120px', 
                                                    height: '120px', 
                                                    borderRadius: '50%', 
                                                    backgroundColor: muted1 ? '#ffebee' : '#e8f5e9',
                                                    border: `4px solid ${muted1 ? '#f44336' : '#4caf50'}`,
                                                    display: 'flex', 
                                                    flexDirection: 'column',
                                                    justifyContent: 'center', 
                                                    alignItems: 'center',
                                                    cursor: mystream ? 'pointer' : 'not-allowed',
                                                    opacity: mystream ? 1 : 0.6,
                                                    transition: 'all 0.3s ease'
                                                }}
                                                onClick={mystream ? () => this.micMute(1) : undefined}
                                            >
                                                {muted1 ? 
                                                    <IconMicrophoneOff size={60} color="#f44336" /> : 
                                                    <IconMicrophone size={60} color="#4caf50" />
                                                }
                                                <Text size="md" weight="bold" mt={5} color={muted1 ? '#f44336' : '#4caf50'}>
                                                    {!muted1 ? "ON" : "OFF"}
                                                </Text>
                                            </div>
                                        </div>
                                    </Group>
                                    <SimpleGrid cols={2}>
                                        <div>
                                            <VolumeSlider orientation='vertical' label='Source'
                                                        volume={(value) => this.setStrVolume(value,1)}
                                                        mute={() => this.muteStream(1)} />
                                        </div>
                                        <div>
                                            <VolumeSlider orientation='vertical' label='Self'
                                                        volume={(value) => this.setTrlVolume(value,1)}
                                                        mute={() => this.muteTrl(1)} />
                                        </div>
                                    </SimpleGrid>
                                </div>
                            </div>
                        </Grid.Col>
                        <Grid.Col span={8}>
                            <Paper shadow="xs" p="md" withBorder>
                                <div className="vclient__toolbar">
                                    <Group>
                                        <Button 
                                            variant="subtle" 
                                            disabled
                                        >
                                            <IconPower color={mystream ? 'green' : 'red'} size={20} style={{marginRight: '5px'}} />
                                            {!mystream ? "Disconnected" : "Connected"}
                                        </Button>
                                        <Button
                                            variant="subtle"
                                            onClick={this.toggleStudyModal}
                                        >
                                            <IconBook size={20} style={{marginRight: '5px'}} />
                                            Study Material
                                        </Button>
                                        <Modal
                                            opened={this.state.studyModalOpen}
                                            onClose={this.toggleStudyModal}
                                            title="Study Material"
                                        >
                                            <HomerLimud />
                                        </Modal>
                                        <Group style={{alignItems: 'center'}}>
                                            <Select
                                                placeholder="Translate to:"
                                                data={langs_options}
                                                value={i !== undefined && i !== "" ? i.toString() : null}
                                                disabled={mystream}
                                                error={!selected_room ? "No language selected" : null}
                                                onChange={(value) => this.selectRoom(Number(value))}
                                                style={{width: '200px'}}
                                            />
                                            {mystream ?
                                                <Button color="red" size="lg" onClick={() => this.exitRoom(false)}>
                                                    Exit <IconLogout size={20} style={{marginLeft: '5px'}} />
                                                </Button>:""}
                                            {!mystream ?
                                                <Button color="green" size="lg" disabled={delay || !selected_room || !audio2.device} onClick={this.initJanus}>
                                                    Join <IconLogin size={20} style={{marginLeft: '5px'}} />
                                                </Button>:""}
                                        </Group>
                                    </Group>
                                </div>
                                {/*<Segment >*/}
                                    <MerkazStream ref={stream => {this.stream = stream;}} trl_stream={trl_stream} video={video} janus={janus} />
                                {/*</Segment>*/}
                                <Paper shadow="xs" p="sm" withBorder mt="sm">
                                    <Group position="apart">
                                        <div className='stream_langs'>
                                            <Select
                                                placeholder="Audio:"
                                                data={audios_options.map(option => ({
                                                    value: option.value.toString(),
                                                    label: option.text
                                                }))}
                                                value={audios1 ? audios1.toString() : null}
                                                disabled={!mystream}
                                                error={!audios1 ? "No audio selected" : null}
                                                onChange={(value) => {
                                                    const selectedOption = audios_options.find(opt => opt.value.toString() === value);
                                                    this.setAudio(Number(value), selectedOption ? [selectedOption] : [], 1);
                                                }}
                                            />
                                        </div>
                                        <div className='stream_langs'>
                                            <Select
                                                placeholder="Audio:"
                                                data={audios_options.map(option => ({
                                                    value: option.value.toString(),
                                                    label: option.text
                                                }))}
                                                value={audios2 ? audios2.toString() : null}
                                                disabled={!mystream}
                                                error={!audios2 ? "No audio selected" : null}
                                                onChange={(value) => {
                                                    const selectedOption = audios_options.find(opt => opt.value.toString() === value);
                                                    this.setAudio(Number(value), selectedOption ? [selectedOption] : [], 2);
                                                }}
                                            />
                                        </div>
                                    </Group>
                                </Paper>
                                <Paper shadow="xs" p="sm" withBorder mt="sm">
                                    <Alert icon={<IconInfoCircle size={16} />} title="Online Translators" color="gray">
                                        <Stack spacing="xs">
                                            {list.length > 0 ? list : <Text>No translators online</Text>}
                                        </Stack>
                                    </Alert>
                                </Paper>
                            </Paper>
                            <MarkazChat {...this.state}
                                        ref={chat => {this.chat = chat;}}
                                        visible={this.state.visible}
                                        onCmdMsg={this.handleCmdData}
                                        room={room}
                                        user={this.state.user} />

                            <audio ref="localAudio1" id="localAudio1" autoPlay={autoPlay} controls={controls} muted={true} playsInline={true}/>
                            <audio ref="localAudio2" id="localAudio2" autoPlay={autoPlay} controls={controls} muted={true} playsInline={true}/>
                            <audio ref="remoteAudio1" id="remoteAudio1" autoPlay={autoPlay} controls={controls} muted={true} playsInline={true}/>
                            <audio ref="remoteAudio2" id="remoteAudio2" autoPlay={autoPlay} controls={controls} muted={true} playsInline={true}/>

                        </Grid.Col>
                        <Grid.Col span={2} style={{ position: 'relative' }}>
                            {/* Large background volume indicator */}
                            <div style={{ 
                                position: 'absolute', 
                                top: 0, 
                                left: 0, 
                                width: '100%', 
                                height: '100%', 
                                zIndex: 0,
                                display: 'flex',
                                justifyContent: 'center',
                                padding: '0',
                            }}>
                                <canvas 
                                    ref="canvas2" 
                                    id="canvas2" 
                                    width="190" 
                                    height="450" 
                                    style={{ 
                                        width: '100%',
                                        background: '#f0f0f0',
                                        opacity: 0.8,
                                        position: 'absolute',
                                        top: '200px',
                                        left: 0
                                    }} 
                                />
                            </div>
                            
                            {/* Content on top of volume indicator */}
                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <div className="vclient__toolbar">
                                    <Group position="center" style={{ marginTop: '20px', marginBottom: '20px' }}>
                                        <div style={{ 
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            alignItems: 'center',
                                            marginBottom: '10px'
                                        }}>
                                            <div 
                                                style={{ 
                                                    width: '120px', 
                                                    height: '120px', 
                                                    borderRadius: '50%', 
                                                    backgroundColor: muted2 ? '#ffebee' : '#e8f5e9',
                                                    border: `4px solid ${muted2 ? '#f44336' : '#4caf50'}`,
                                                    display: 'flex', 
                                                    flexDirection: 'column',
                                                    justifyContent: 'center', 
                                                    alignItems: 'center',
                                                    cursor: mystream ? 'pointer' : 'not-allowed',
                                                    opacity: mystream ? 1 : 0.6,
                                                    transition: 'all 0.3s ease'
                                                }}
                                                onClick={mystream ? () => this.micMute(2) : undefined}
                                            >
                                                {muted2 ? 
                                                    <IconMicrophoneOff size={60} color="#f44336" /> : 
                                                    <IconMicrophone size={60} color="#4caf50" />
                                                }
                                                <Text size="md" weight="bold" mt={5} color={muted2 ? '#f44336' : '#4caf50'}>
                                                    {!muted2 ? "ON" : "OFF"}
                                                </Text>
                                            </div>
                                        </div>
                                    </Group>
                                    <SimpleGrid cols={2}>
                                        <div>
                                            <VolumeSlider orientation='vertical' label='Source'
                                                        volume={(value) => this.setStrVolume(value,2)}
                                                        mute={() => this.muteStream(2)} />
                                        </div>
                                        <div>
                                            <VolumeSlider orientation='vertical' label='Self'
                                                        volume={(value) => this.setTrlVolume(value,2)}
                                                        mute={() => this.muteTrl(2)} />
                                        </div>
                                    </SimpleGrid>
                                </div>
                            </div>
                        </Grid.Col>
                    </Grid>

                    {/* Add the input/output buttons at the bottom of the page */}
                    <Grid mt={80}>
                        <Grid.Col span={1}>
                            <Popover
                                width={200}
                                position="top"
                                withArrow
                                shadow="md"
                            >
                                <Popover.Target>
                                    <Button 
                                        variant="outline" 
                                        color="blue"
                                        radius="xl"
                                        leftIcon={<IconMicrophone color={!audio1.device ? 'red' : 'blue'} size={16} />}
                                        sx={{ paddingLeft: 12, paddingRight: 12, width: '100%', borderWidth: '1px' }}
                                    >
                                        INPUT
                                    </Button>
                                </Popover.Target>
                                <Popover.Dropdown>
                                    <Select
                                        placeholder="Select Device:"
                                        data={adevice1_list_in}
                                        value={audio1.device}
                                        disabled={mystream}
                                        error={!audio1.device ? "No device selected" : null}
                                        onChange={(value) => this.setDevice(value, 1, "in")}
                                    />
                                </Popover.Dropdown>
                            </Popover>
                        </Grid.Col>
                        <Grid.Col span={1}>
                            <Popover
                                width={200}
                                position="top"
                                withArrow
                                shadow="md"
                            >
                                <Popover.Target>
                                    <Button 
                                        variant="outline" 
                                        color="blue"
                                        radius="xl"
                                        rightIcon={<span style={{fontSize: '12px'}}>▼</span>}
                                        sx={{ paddingLeft: 12, paddingRight: 12, width: '100%', borderWidth: '1px', position: 'relative' }}
                                    >
                                        <IconHeadphones color={!audio1_out ? 'red' : 'blue'} size={20} style={{marginRight: '8px'}} />
                                        OUTPUT
                                    </Button>
                                </Popover.Target>
                                <Popover.Dropdown>
                                    <Select
                                        placeholder="Select Device:"
                                        data={adevice1_list_out}
                                        value={audio1_out}
                                        disabled={!mystream}
                                        error={!audio1_out ? "No output selected" : null}
                                        onChange={(value) => this.setDevice(value, 1, "out")}
                                    />
                                </Popover.Dropdown>
                            </Popover>
                        </Grid.Col>
                        <Grid.Col span={8}>
                        </Grid.Col>
                        <Grid.Col span={1}>
                            <Popover
                                width={200}
                                position="top"
                                withArrow
                                shadow="md"
                            >
                                <Popover.Target>
                                    <Button 
                                        variant="outline" 
                                        color="blue"
                                        radius="xl"
                                        leftIcon={<IconMicrophone color={!audio2.device ? 'red' : 'blue'} size={16} />}
                                        sx={{ paddingLeft: 12, paddingRight: 12, width: '100%', borderWidth: '1px' }}
                                    >
                                        INPUT
                                    </Button>
                                </Popover.Target>
                                <Popover.Dropdown>
                                    <Select
                                        placeholder="Select Device:"
                                        data={adevice2_list_in}
                                        value={audio2.device}
                                        disabled={mystream}
                                        error={!audio2.device ? "No device selected" : null}
                                        onChange={(value) => this.setDevice(value, 2, "in")}
                                    />
                                </Popover.Dropdown>
                            </Popover>
                        </Grid.Col>
                        <Grid.Col span={1}>
                            <Popover
                                width={200}
                                position="top"
                                withArrow
                                shadow="md"
                            >
                                <Popover.Target>
                                    <Button 
                                        variant="outline" 
                                        color="blue"
                                        radius="xl"
                                        rightIcon={<span style={{fontSize: '12px'}}>▼</span>}
                                        sx={{ paddingLeft: 12, paddingRight: 12, width: '100%', borderWidth: '1px', position: 'relative' }}
                                    >
                                        <IconHeadphones color={!audio2_out ? 'red' : 'blue'} size={20} style={{marginRight: '8px'}} />
                                        OUTPUT
                                    </Button>
                                </Popover.Target>
                                <Popover.Dropdown>
                                    <Select
                                        placeholder="Select Device:"
                                        data={adevice2_list_out}
                                        value={audio2_out}
                                        disabled={!mystream}
                                        error={!audio2_out ? "No output selected" : null}
                                        onChange={(value) => this.setDevice(value, 2, "out")}
                                    />
                                </Popover.Dropdown>
                            </Popover>
                        </Grid.Col>
                    </Grid>
                </Container>
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