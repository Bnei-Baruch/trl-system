import React, { Component } from 'react';
import {Menu, Select, Button, Icon, Segment, Message, Table, Divider} from "semantic-ui-react";
import '../Client/Client.scss'
import VolumeSlider from "../../components/VolumeSlider";
import {JANUS_SRV_STR, langs_list, lnglist, STUN_SRV1, STUN_SRV2} from "../../shared/consts";
import LoginPage from "../../components/LoginPage";
import {Janus} from "../../lib/janus";

class WeHttpStream extends Component {

    state = {
        janus: null,
        audiostream: null,
        audio_stream: null,
        streamId: Number(localStorage.getItem("streamId")) || 15,
        str_muted: true,
        trl_muted: true,
        mixvolume: null,
        user: null,
        talking: null,
    };

    componentDidMount() {
        //this.initJanus();
    };

    componentWillUnmount() {
        this.exitJanus();
    };

    exitJanus = () => {
        if(this.state.videostream)
            this.state.videostream.hangup();
        if(this.state.audiostream)
            this.state.audiostream.hangup();
        if(this.state.trlstream)
            this.state.trlstream.hangup();
        this.setState({muted: false, audio_stream: null, room: "", selected_room : "", i: "", feeds: {}, we_room: null, delay: false});
        this.state.janus.destroy();
    };

    initJanus = () => {
        this.setState({delay: true});
        if(this.state.janus)
            this.state.janus.destroy();
        Janus.init({
            debug: ["error"],
            callback: () => {
                let janus = new Janus({
                    server: JANUS_SRV_STR,
                    iceServers: [{urls: [STUN_SRV1, STUN_SRV2]}],
                    success: () => {
                        Janus.log(" :: Connected to JANUS");
                        this.setState({janus});
                        this.initAudioStream(janus);
                    },
                    error: (error) => {
                        Janus.log(error);
                    },
                    destroyed: () => {
                        Janus.log("kill");
                    }
                });
            }
        })
    };

    initAudioStream = (janus) => {
        let {audios} = this.state;
        janus.attach({
            plugin: "janus.plugin.streaming",
            opaqueId: "audiostream-"+Janus.randomString(12),
            success: (audio_stream) => {
                Janus.log(audio_stream);
                this.setState({audio_stream}, () => {
                    //this.audioMute();
                });
                audio_stream.send({message: {request: "watch", id: audios}});
                audio_stream.muteAudio()
            },
            error: (error) => {
                Janus.log("Error attaching plugin: " + error);
            },
            onmessage: (msg, jsep) => {
                this.onStreamingMessage(this.state.audio_stream, msg, jsep, false);
            },
            onremotetrack: (track, mid, on) => {
                Janus.debug(" ::: Got a remote audio track event :::");
                Janus.debug("Remote audio track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
                //if(this.state.audio_stream) return;
                let stream = new MediaStream();
                stream.addTrack(track.clone());
                //this.setState({audio_stream: stream});
                Janus.log("Created remote audio stream:", stream);
                let audio = this.refs.remoteAudio;
                Janus.attachMediaStream(audio, stream);
                //StreamVisualizer2(stream, this.refs.canvas1.current,50);
            },
            oncleanup: () => {
                Janus.log("Got a cleanup notification");
            }
        });
    };

    onStreamingMessage = (handle, msg, jsep) => {
        Janus.log("Got a message", msg);

        if(jsep !== undefined && jsep !== null) {
            Janus.log("Handling SDP as well...", jsep);

            // Answer
            handle.createAnswer({
                jsep: jsep,
                media: { audioSend: false, videoSend: false, data: false },
                success: (jsep) => {
                    Janus.log("Got SDP!", jsep);
                    let body = { request: "start" };
                    handle.send({message: body, jsep: jsep});
                },
                error: (error) => {
                    Janus.log("WebRTC error: " + error);
                }
            });
        }
    };

    selectRoom = (i) => {
        localStorage.setItem("we_room", i);
        let selected_room = langs_list[i].key;
        let name = langs_list[i].text;
        if (this.state.room === selected_room)
            return;
        let streamId = lnglist[name].streamid;
        this.setState({selected_room,name,i,streamId});
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
                            <Button attached='right' size='huge' warning icon='sign-out' onClick={() => this.exitJanus()} />:""}
                        {!audio_stream ?
                            <Button attached='right' size='huge' positive loading={delay} icon='sign-in' disabled={delay || !selected_room} onClick={this.initJanus} />:""}
                    </Menu>
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
                {content}
            </div>

        );
    }
}

export default WeHttpStream;
