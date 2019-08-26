import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import { Segment } from 'semantic-ui-react';
import {JANUS_SRV_EURFR, STUN_SRV_STR,} from "../../shared/consts";
import './App.css'


class Stream extends Component {

    state = {
        janus: null,
        videostream: null,
        audiostream: null,
        trlstream: null,
        datastream: null,
        audio: null,
        videos: Number(localStorage.getItem("video")) || 1,
        audios: Number(localStorage.getItem("lang")) || 15,
        room: Number(localStorage.getItem("room")) || null,
        str_muted: true,
        trl_muted: true,
        mixvolume: null,
        user: null,
        talking: null,
    };

    componentDidMount() {
        //this.initJanus(JANUS_SRV_EURFR);
    };

    componentWillUnmount() {
        this.exitJanus();
    };

    exitJanus = () => {
        this.state.videostream.hangup();
        this.state.audiostream.hangup();
        this.state.trlstream.hangup();
        this.setState({video_stream: null, audio_stream: null, trlaudio_stream: null});
        this.state.janus.destroy();
    };

    initJanus = () => {
        if(this.state.janus)
            this.state.janus.destroy();
        Janus.init({
            debug: ["error"],
            callback: () => {
                let janus = new Janus({
                    server: JANUS_SRV_EURFR,
                    iceServers: [{urls: STUN_SRV_STR}],
                    success: () => {
                        Janus.log(" :: Connected to JANUS");
                        this.setState({janus});
                        this.initVideoStream(janus);
                        //this.initDataStream(janus);
                        this.initAudioStream(janus);
                        this.initTranslationStream(this.props.trl_stream);
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

    initVideoStream = (janus) => {
        janus.attach({
            plugin: "janus.plugin.streaming",
            opaqueId: "videostream-"+Janus.randomString(12),
            success: (videostream) => {
                Janus.log(videostream);
                this.setState({videostream});
                videostream.send({message: {request: "watch", id: 1}});
            },
            error: (error) => {
                Janus.log("Error attaching plugin: " + error);
            },
            iceState: (state) => {
                Janus.log("ICE state changed to " + state);
            },
            webrtcState: (on) => {
                Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
            },
            slowLink: (uplink, lost, mid) => {
                Janus.warn("Janus reports problems " + (uplink ? "sending" : "receiving") +
                    " packets on mid " + mid + " (" + lost + " lost packets)");
            },
            onmessage: (msg, jsep) => {
                this.onStreamingMessage(this.state.videostream, msg, jsep, false);
            },
            onremotetrack: (track, mid, on) => {
                Janus.debug(" ::: Got a remote video track event :::");
                Janus.debug("Remote video track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
                if(this.state.video_stream) return;
                let stream = new MediaStream();
                stream.addTrack(track.clone());
                this.setState({video_stream: stream});
                Janus.log("Created remote video stream:", stream);
                let video = this.refs.remoteVideo;
                Janus.attachMediaStream(video, stream);
            },
            oncleanup: () => {
                Janus.log("Got a cleanup notification");
            }
        });
    };

    initAudioStream = (janus) => {
        let {audios} = this.state;
        janus.attach({
            plugin: "janus.plugin.streaming",
            opaqueId: "audiostream-"+Janus.randomString(12),
            success: (audiostream) => {
                Janus.log(audiostream);
                this.setState({audiostream}, () => {
                    //this.audioMute();
                });
                audiostream.send({message: {request: "watch", id: audios}});
                audiostream.muteAudio()
            },
            error: (error) => {
                Janus.log("Error attaching plugin: " + error);
            },
            onmessage: (msg, jsep) => {
                this.onStreamingMessage(this.state.audiostream, msg, jsep, false);
            },
            onremotetrack: (track, mid, on) => {
                Janus.debug(" ::: Got a remote audio track event :::");
                Janus.debug("Remote audio track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
                if(this.state.audio_stream) return;
                let stream = new MediaStream();
                stream.addTrack(track.clone());
                this.setState({audio_stream: stream});
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

    initDataStream(janus) {
        janus.attach({
            plugin: "janus.plugin.streaming",
            opaqueId: "datastream-"+Janus.randomString(12),
            success: (datastream) => {
                Janus.log(datastream);
                this.setState({datastream});
                let body = { request: "watch", id: 101 };
                datastream.send({"message": body});
            },
            error: (error) => {
                Janus.log("Error attaching plugin: " + error);
            },
            onmessage: (msg, jsep) => {
                this.onStreamingMessage(this.state.datastream, msg, jsep, false);
            },
            ondataopen: () => {
                Janus.log("The DataStreamChannel is available!");
            },
            ondata: (data) => {
                let json = JSON.parse(data);
                Janus.log("We got data from the DataStreamChannel! ", json);
                this.checkData(json);
            },
            onremotestream: (stream) => {
                Janus.log("Got a remote stream!", stream);
            },
            oncleanup: () => {
                Janus.log("Got a cleanup notification");
            }
        });
    };

    initTranslationStream = (streamId) => {
        let {janus} = this.state;
        janus.attach({
            plugin: "janus.plugin.streaming",
            opaqueId: "trlstream-"+Janus.randomString(12),
            success: (trlstream) => {
                Janus.log(trlstream);
                this.setState({trlstream});
                trlstream.send({message: {request: "watch", id: streamId}});
                trlstream.muteAudio()
            },
            error: (error) => {
                Janus.log("Error attaching plugin: " + error);
            },
            onmessage: (msg, jsep) => {
                this.onStreamingMessage(this.state.trlstream, msg, jsep, false);
            },
            onremotetrack: (track, mid, on) => {
                Janus.debug(" ::: Got a remote audio track event :::");
                Janus.debug("Remote audio track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
                if(this.state.trlaudio_stream) return;
                let stream = new MediaStream();
                stream.addTrack(track.clone());
                this.setState({trlaudio_stream: stream});
                Janus.log("Created remote audio stream:", stream);
                let audio = this.refs.trlAudio;
                Janus.attachMediaStream(audio, stream);
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

    setVideo = (videos) => {
        this.setState({videos});
        this.state.videostream.send({message: { request: "switch", id: videos }});
        localStorage.setItem("video", videos);
    };

    setAudio = (audios,options) => {
        let text = options.filter(k => k.value === audios)[0].text;
        this.setState({audios});
        this.state.audiostream.send({message: {request: "switch", id: audios}});
        localStorage.setItem("lang", audios);
        localStorage.setItem("langtext", text);
    };

    setVolume = (value,trl) => {
        trl ? this.refs.trlAudio.volume = value : this.refs.remoteAudio.volume = value;
    };

    audioMute = (trl) => {
        if(trl) {
            const {trlstream,trl_muted} = this.state;
            this.setState({trl_muted: !trl_muted});
            trl_muted ? trlstream.muteAudio() : trlstream.unmuteAudio()
        } else {
            const {audiostream,str_muted} = this.state;
            this.setState({str_muted: !str_muted});
            str_muted ? audiostream.muteAudio() : audiostream.unmuteAudio()
        }
    };

    toggleFullScreen = () => {
        let vid = this.refs.remoteVideo;
        if(vid.requestFullScreen){
            vid.requestFullScreen();
        } else if(vid.webkitRequestFullScreen){
            vid.webkitRequestFullScreen();
        } else if(vid.mozRequestFullScreen){
            vid.mozRequestFullScreen();
        }
    };


    render() {

        const {str_muted,trl_muted} = this.state;

        return (
            <Segment textAlign='center'>
                <div className='video'>
                    <video ref="remoteVideo"
                           id="remoteVideo"
                           width="450"
                           height="250"
                           autoPlay={true}
                           controls={false}
                           muted={true}
                           playsinline={true}/>
                </div>
                <audio ref="remoteAudio"
                       id="remoteAudio"
                       autoPlay={true}
                       controls={false}
                       muted={str_muted}
                       playsinline={true}/>
                <audio ref="trlAudio"
                       id="trlAudio"
                       autoPlay={true}
                       controls={false}
                       muted={trl_muted}
                       playsinline={true}/>
            </Segment>
        )
    }
}

export default Stream;
