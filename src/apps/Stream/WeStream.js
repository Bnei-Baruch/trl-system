import React, { Component } from 'react';
import {Menu, Select, Button, Icon, Segment, Message, Table, Divider} from "semantic-ui-react";
import '../Client/Client.scss'
import VolumeSlider from "../../components/VolumeSlider";
import {StreamingPlugin} from "../../lib/streaming-plugin";
import {kc} from "../../components/UserManager";
import mqtt from "../../shared/mqtt";
import log from "loglevel";
import {geoInfo} from "../../shared/tools";
import {GEO_IP_INFO, langs_list, lnglist} from "../../shared/consts";
import LoginPage from "../../components/LoginPage";
import {JanusMqtt} from "../../lib/janus-mqtt";

class WeStream extends Component {

    state = {
        janus: null,
        audiostream: null,
        audio_stream: null,
        audios: Number(localStorage.getItem("lang")) || 15,
        str_muted: true,
        trl_muted: true,
        mixvolume: null,
        user: null,
        talking: null,
    };

    checkPermission = (user) => {
        if (user) {
            delete user.roles;
            user.role = "listener";
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
                mqtt.join("we/users/broadcast");
                mqtt.join("we/users/" + user.id);
                mqtt.watch((message) => {
                    this.handleCmdData(message);
                });
            }
        });
    };

    initJanus = () => {
        this.setState({delay: true});
        const {user, audios} = this.state;
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

        let audiostream = new StreamingPlugin();

        janus.init().then(data => {
            log.info("[client] Janus init", data)
            janus.attach(audiostream).then(() => {
                this.setState({audiostream});
                audiostream.watch(audios).then(stream => {
                    let audio = this.refs.remoteAudio;
                    audio.srcObject = stream;
                    this.setState({janus, audio_stream: stream});
                })
            })
        }).catch(err => {
            log.error("[client] Janus init", err);
            this.exitRoom(false);
        })
    };

    selectRoom = (i) => {
        localStorage.setItem("we_room", i);
        let selected_room = langs_list[i].key;
        let name = langs_list[i].text;
        if (this.state.room === selected_room)
            return;
        let trl_stream = lnglist[name].streamid;
        this.setState({selected_room,name,i,trl_stream});
    };

    exitRoom = () => {
        let {room, janus} = this.state;
        janus.destroy().then(() => {
            this.setState({muted: false, audio_stream: null, room: "", selected_room : "", i: "", feeds: {}, we_room: null, delay: false});
        })
    };

    setAudio = (audios, options) => {
        let text = options.filter(k => k.value === audios)[0].text;
        this.setState({audios});
        this.state.audiostream.switch(audios);
        localStorage.setItem("lang", audios);
        localStorage.setItem("langtext", text);
    };

    muteTrl = () => {
        const {trl_muted} = this.state;
        this.setState({trl_muted: !trl_muted});
    };

    setTrlVolume = (value) => {
        this.refs.remoteAudio.volume = value;
    };


    render() {

        const {i,delay,audio_stream,selected_room,user,trl_muted} = this.state;
        const autoPlay = true;
        const controls = false;

        let login = (<LoginPage user={user} checkPermission={this.checkPermission} />);

        let content = (
            <div className="vclient" >
                <div className="vclient__toolbar">
                    <Menu icon='labeled' size="mini">
                        <Menu.Item disabled >
                            <Icon color={audio_stream ? 'green' : 'red'} name='power off'/>
                            {!audio_stream ? "Disconnected" : "Connected"}
                        </Menu.Item>
                        {/*<Popup*/}
                        {/*    trigger={<Menu.Item><Icon name="settings" color={!audio_device ? 'red' : ''} />Input Device</Menu.Item>}*/}
                        {/*    on='click'*/}
                        {/*    position='bottom left'*/}
                        {/*>*/}
                        {/*    <Popup.Content>*/}
                        {/*        <Select fluid*/}
                        {/*                disabled={audio_stream}*/}
                        {/*                error={!audio_device}*/}
                        {/*                placeholder="Select Device:"*/}
                        {/*                value={audio_device}*/}
                        {/*                options={adevices_list}*/}
                        {/*                onChange={(e, {value}) => this.setDevice(value)}/>*/}
                        {/*    </Popup.Content>*/}
                        {/*</Popup>*/}
                    </Menu>
                    <Menu icon='labeled' secondary size="mini">
                        <Select className='trl_select'
                                attached='left'
                                compact
                                disabled={audio_stream}
                                error={!selected_room}
                                placeholder="Translation: "
                                value={i}
                                options={langs_list}
                                onChange={(e, {value}) => this.selectRoom(value)} />
                        {audio_stream ?
                            <Button attached='right' size='huge' warning icon='sign-out' onClick={() => this.exitRoom(false)} />:""}
                        {!audio_stream ?
                            <Button attached='right' size='huge' positive loading={delay} icon='sign-in' disabled={delay || !selected_room} onClick={this.initJanus} />:""}
                    </Menu>
                    {/*<Menu icon='labeled' secondary size="mini" floated='right'>*/}
                    {/*    {!audio_stream ?*/}
                    {/*        <Menu.Item position='right' disabled={selftest !== "Mic Test" || audio_stream} onClick={this.selfTest}>*/}
                    {/*            <Icon color={tested ? 'green' : 'red'} name="sound" />*/}
                    {/*            {selftest}*/}
                    {/*        </Menu.Item> : ""}*/}
                    {/*    <Menu.Item disabled={!audio_stream} onClick={this.micMute} className="mute-button">*/}
                    {/*        <canvas className={muted ? 'hidden' : 'vumeter'} ref="canvas1" id="canvas1" width="15" height="35" />*/}
                    {/*        <Icon color={muted ? "red" : ""} name={!muted ? "microphone" : "microphone slash"} />*/}
                    {/*        {!muted ? "ON" : "OFF"}*/}
                    {/*    </Menu.Item>*/}
                    {/*</Menu>*/}
                </div>

                <audio
                    ref="remoteAudio"
                    id="remoteAudio"
                    autoPlay={autoPlay}
                    controls={controls}
                    muted={trl_muted}
                    playsInline={true}/>

                {audio_stream ? '' : <Divider fitted />}

                <Segment basic color='blue' className={audio_stream ? '' : 'hidden'}>
                    <Table basic='very' fixed>
                        <Table.Row>
                            <Table.Cell width={8}>
                                <Segment padded color='green'>
                                    <VolumeSlider icon='address card' label='Volume' volume={this.setTrlVolume} mute={this.muteTrl} />
                                </Segment>
                                {/*<Message color='grey' header='Online Translators:' list={list} />*/}
                            </Table.Cell>
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

export default WeStream;
