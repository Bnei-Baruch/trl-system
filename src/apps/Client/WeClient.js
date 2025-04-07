import React, { Component } from 'react';
import { Box, Text, Button, Group, ActionIcon, Popover, Select as MantineSelect, Indicator, Divider, Paper, Alert, MantineProvider, ColorSchemeProvider, useMantineColorScheme, Transition, Skeleton, Center } from "@mantine/core";
import { IconPower, IconSettings, IconMicrophone, IconMicrophoneOff, IconVolume, IconLogin, IconLogout, IconDeviceSpeaker, IconAlertCircle, IconVolumeOff, IconSun, IconMoon } from '@tabler/icons-react';
import {geoInfo, checkNotification, testMic, micVolume} from "../../shared/tools";
import './Client.scss'
import './WeClient.scss'
import {lnglist, GEO_IP_INFO, langs_list} from "../../shared/consts";
import {kc} from "../../components/UserManager";
import VolumeSlider from "../../components/VolumeSlider";
import mqtt from "../../shared/mqtt";
import log from "loglevel";
import {JanusMqtt} from "../../lib/janus-mqtt";
import {AudiobridgePlugin} from "../../lib/audiobridge-plugin";
import devices from "../../lib/devices";
import LoginPageMantine from "../../components/LoginPageMantine";

// Theme toggle component
const ThemeToggle = () => {
    const { colorScheme, toggleColorScheme } = useMantineColorScheme();
    const dark = colorScheme === 'dark';
    
    return (
        <ActionIcon
            variant="outline"
            color={dark ? 'yellow' : 'blue'}
            onClick={() => toggleColorScheme()}
            title="Toggle color scheme"
            size="lg"
        >
            {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
        </ActionIcon>
    );
};

class WeClient extends Component {

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
        we_room: localStorage.getItem("we_room"),
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
        init_devices: false,
        colorScheme: localStorage.getItem('mantine-color-scheme') || 'light',
        deviceLoading: false
    };

    checkPermission = (user) => {
        //const gxy_group = kc.hasRealmRole("trl_user");
        if (user) {
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
        if(this.state.we_room !== null)
            this.selectRoom(Number(this.state.we_room));
        checkNotification();
        geoInfo(`${GEO_IP_INFO}`, data => {
            user.ip = data.ip;
            user.system = navigator.userAgent;
            this.setState({user})
            this.initMQTT(user)
        });
    };

    initMQTT = (user) => {
        mqtt.init("we", user, (reconnected, error) => {
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
                mqtt.join("we/users/broadcast");
                mqtt.join("we/users/" + user.id);
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
        let janus = new JanusMqtt(user, "we")
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
        this.setState({ deviceLoading: true });
        devices.init().then(audio => {
            log.info("[client] init devices: ", audio);
            if (audio.error) {
                alert("audio device not detected");
            }
            if (audio.stream) {
                let myaudio = this.refs.localVideo;
                if (myaudio) myaudio.srcObject = audio.stream;
                if(this.refs?.canvas1) micVolume(this.refs.canvas1)
                this.setState({audio, init_devices: true, delay: false, deviceLoading: false})
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

            //this.chat.initChatEvents();

            //this.stream.initJanus();

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
            //this.stream.exitJanus()
            janus.destroy().then(() => {
                mqtt.exit("trl/room/" + room);
                mqtt.exit("trl/room/" + room + "/chat");
                this.setState({muted: false, mystream: null, room: "", selected_room: (reconnect ? room : ""), i: "", feeds: {}, we_room: null, delay: false});
                if(reconnect) this.initJanus(reconnect)
                if(!reconnect) devices.audio.context.resume()
            })
        });
    };

    selectRoom = (i) => {
        // Convert string to number since Mantine Select returns string values
        const numericI = parseInt(i, 10);
        localStorage.setItem("we_room", numericI);
        let selected_room = langs_list[numericI].key;
        let name = langs_list[numericI].text;
        if (this.state.room === selected_room)
            return;
        let trl_stream = lnglist[name].streamid;
        this.setState({selected_room, name, i: numericI, trl_stream});
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

    toggleColorScheme = () => {
        const newColorScheme = this.state.colorScheme === 'dark' ? 'light' : 'dark';
        this.setState({ colorScheme: newColorScheme });
        localStorage.setItem('mantine-color-scheme', newColorScheme);
    };

    render() {
        const {feeds,room,audio:{devices,device},audios,i,muted,delay,mystream,selected_room,selftest,tested,trl_stream,trl_muted,user,video,janus,colorScheme,deviceLoading} = this.state;
        const autoPlay = true;
        const controls = false;

        // Format device list for Mantine Select
        const adevices_list = devices.map((device) => {
            const {label, deviceId} = device;
            return { value: deviceId, label: label };
        });

        // Format language list for Mantine Select
        const langOptions = langs_list.map(lang => ({
            value: lang.value.toString(),
            label: lang.text
        }));

        const list = Object.values(feeds).map((feed,i) => {
            if(feed) {
                const {muted, display: {rfid, role, name}} = feed
                return (
                    <Alert 
                        key={rfid}
                        color={!muted ? 'green' : role === "user" ? 'red' : 'blue'}
                        mb={5}
                        radius="sm"
                        title={name}
                        icon={<IconAlertCircle size={16} />}
                    />
                );
            }
            return null;
        }).filter(Boolean);

        let login = (<LoginPageMantine user={user} checkPermission={this.checkPermission} />);

        let content = (
            <div className="vclient" >
                <div className="vclient__toolbar">
                    <Group position="apart" align="center" mb="sm" spacing="xs" style={{ width: '100%' }} className="mobile-only-header">
                        <Text weight={600} size="lg">TRL System</Text>
                        <ActionIcon
                            variant="outline"
                            color={colorScheme === 'dark' ? 'yellow' : 'blue'}
                            onClick={this.toggleColorScheme}
                            title="Toggle color scheme"
                            size="lg"
                        >
                            {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
                        </ActionIcon>
                    </Group>

                    <Group position="apart" align="center" spacing="md" p="xs" style={{ width: '100%' }}>
                        <Group spacing="xs">
                            <Box p="xs" sx={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Indicator color={mystream ? 'green' : 'red'} size={14}>
                                    <ActionIcon size="lg" variant="light" color={mystream ? 'green' : 'red'}>
                                        <IconPower size={20} />
                                    </ActionIcon>
                                </Indicator>
                                <Text size="sm">{!mystream ? "Disconnected" : "Connected"}</Text>
                            </Box>

                            <Popover width={200} position="bottom" withArrow shadow="md">
                                <Popover.Target>
                                    <ActionIcon size="lg" variant="light" color={!device ? 'red' : 'blue'}>
                                        <IconSettings size={20} />
                                    </ActionIcon>
                                </Popover.Target>
                                <Popover.Dropdown>
                                    {deviceLoading ? (
                                        <Box py="xs">
                                            <Skeleton height={8} radius="xl" mb="xs" />
                                            <Skeleton height={8} radius="xl" mb="xs" width="70%" />
                                            <Skeleton height={8} radius="xl" width="40%" />
                                        </Box>
                                    ) : (
                                        <MantineSelect
                                            data={adevices_list}
                                            disabled={mystream}
                                            placeholder="Select Device:"
                                            value={device}
                                            onChange={(value) => this.setDevice(value)}
                                            error={!device}
                                        />
                                    )}
                                </Popover.Dropdown>
                            </Popover>
                            
                            <ActionIcon
                                variant="outline"
                                color={colorScheme === 'dark' ? 'yellow' : 'blue'}
                                onClick={this.toggleColorScheme}
                                title="Toggle color scheme"
                                size="lg"
                                className="desktop-only-button"
                            >
                                {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
                            </ActionIcon>
                        </Group>
                        
                        <Group spacing="xs">
                            <MantineSelect
                                className='trl_select'
                                data={langOptions}
                                disabled={mystream}
                                placeholder="Translate to:"
                                value={i}
                                onChange={(value) => this.selectRoom(value)}
                                error={!selected_room}
                                width={150}
                            />
                            
                            {mystream ? (
                                <Button 
                                    color="red" 
                                    onClick={() => this.exitRoom(false)}
                                    leftIcon={<IconLogout size={20} />}
                                >
                                    Exit
                                </Button>
                            ) : (
                                <Button 
                                    color="green" 
                                    loading={delay}
                                    disabled={delay || !selected_room || !device}
                                    onClick={this.initJanus}
                                    leftIcon={<IconLogin size={20} />}
                                >
                                    Join
                                </Button>
                            )}
                        </Group>
                        
                        <Group spacing="xs">
                            {!mystream ? (
                                <Button 
                                    variant="outline"
                                    color={tested ? 'green' : 'red'}
                                    disabled={selftest !== "Mic Test" || mystream}
                                    onClick={this.selfTest}
                                    leftIcon={<IconVolume size={20} />}
                                >
                                    {selftest}
                                </Button>
                            ) : null}
                            
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <canvas className={muted ? 'hidden' : 'vumeter'} ref="canvas1" id="canvas1" width="15" height="35" />
                                <Button
                                    disabled={!mystream}
                                    color={muted ? "red" : "blue"}
                                    onClick={this.micMute}
                                    leftIcon={muted ? <IconMicrophoneOff size={20} /> : <IconMicrophone size={20} />}
                                >
                                    {!muted ? "ON" : "OFF"}
                                </Button>
                            </Box>
                        </Group>
                    </Group>
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

                {mystream ? '' : <Divider my="md" />}

                <Transition mounted={!!mystream} transition="fade" duration={400} timingFunction="ease">
                    {(styles) => (
                        <Paper shadow="xs" p="md" mt="md" radius="md" style={styles}>
                            <Paper shadow="xs" p="md" radius="md" withBorder mb="md" sx={{ borderColor: '#21ba45' }}>
                                <Group position="apart" mb="md">
                                    <Text weight={700} size="lg"><IconDeviceSpeaker size={20} style={{verticalAlign: 'middle', marginRight: '8px'}}/>Translator Audio</Text>
                                    <Button 
                                        size="xs"
                                        color={trl_muted ? "red" : "blue"}
                                        variant={trl_muted ? "filled" : "outline"}
                                        onClick={this.muteTrl}
                                        leftIcon={trl_muted ? <IconVolumeOff size={16} /> : <IconVolume size={16} />}
                                    >
                                        {trl_muted ? "Muted" : "Playing"}
                                    </Button>
                                </Group>
                                <Center py="lg">
                                    <VolumeSlider label='Volume' orientation='vertical' volume={this.setTrlVolume} mute={this.muteTrl} />
                                </Center>
                            </Paper>
                            <Paper shadow="xs" p="md" radius="md" withBorder>
                                <Text weight={700} size="lg" mb="md">Online Translators</Text>
                                {list.length > 0 ? (
                                    <Box className="translator-list">
                                        {list.map((item, index) => (
                                            <Transition mounted={true} transition="slide-up" duration={300} timingFunction="ease" key={index}>
                                                {(styles) => (
                                                    <div style={{...styles, transitionDelay: `${index * 50}ms`}}>
                                                        {item}
                                                    </div>
                                                )}
                                            </Transition>
                                        ))}
                                    </Box>
                                ) : (
                                    <Alert 
                                        color="gray"
                                        icon={<IconAlertCircle size={16} />}
                                        title="No translators online"
                                        radius="md"
                                    >
                                        Please wait for translators to connect.
                                    </Alert>
                                )}
                            </Paper>
                        </Paper>
                    )}
                </Transition>
            </div>
        );

        return (
            <MantineProvider theme={{ colorScheme: colorScheme }}>
                <div>
                    {user ? content : login}
                </div>
            </MantineProvider>
        );
    }
}

export default WeClient;
