import React, { Component } from 'react';
import { Segment } from 'semantic-ui-react';
import './Stream.css'
import {StreamingPlugin} from "../../lib/streaming-plugin";
import {cloneStream} from "../../shared/tools";


class MerkazStream extends Component {

    state = {
        janus: null,
        videostream: null,
        audiostream1: null,
        audiostream2: null,
        audio: null,
        videos: Number(localStorage.getItem("video")) || 1,
        audios: Number(localStorage.getItem("lang")) || 15,
        room: Number(localStorage.getItem("room")) || null,
        str1_muted: true,
        str2_muted: true,
        mixvolume: null,
        user: null,
        talking: null,
    };

    componentWillUnmount() {
        this.exitJanus();
    };

    exitJanus = () => {
        const {janus} = this.props;
        if(this.state.videostream)
            janus.detach(this.state.videostream);
        if(this.state.audiostream1)
            janus.detach(this.state.audiostream1);
        if(this.state.audiostream2)
            janus.detach(this.state.audiostream2);
        this.setState({video_stream: null, audio_stream1: null, audio_stream2: null});
    };

    initJanus = () => {
        const {janus} = this.props
        this.setState({janus});
        this.initVideoStream(janus);
        this.initAudioStream(janus,1);
        this.initAudioStream(janus,2);
    };

    initVideoStream = (janus) => {
        let videostream = new StreamingPlugin();
        janus.attach(videostream).then(() => {
            this.setState({videostream});
            videostream.watch(11).then(stream => {
                let video = this.refs.remoteVideo;
                video.srcObject = stream;
            })
        })
    };

    initAudioStream = (janus,trl) => {
        if(trl === 1) {
            let audiostream1 = new StreamingPlugin();
            let {audios} = this.state;
            janus.attach(audiostream1).then(() => {
                this.setState({audiostream1});
                audiostream1.watch(audios).then(stream => {
                    let audio = this.refs.remoteAudio1;
                    audio.srcObject = stream;
                    this.setState({audio_stream1: stream});
                    cloneStream(stream, 1, true);
                })
            })
        }
        if(trl === 2) {
            let audiostream2 = new StreamingPlugin();
            let {audios} = this.state;
            janus.attach(audiostream2).then(() => {
                this.setState({audiostream2});
                audiostream2.watch(audios).then(stream => {
                    let audio = this.refs.remoteAudio2;
                    audio.srcObject = stream;
                    this.setState({audio_stream2: stream});
                    cloneStream(stream, 2, true);
                })
            })
        }
    };

    setVideo = (videos) => {
        this.setState({videos});
        this.state.videostream.switch(videos);
        localStorage.setItem("video", videos);
    };

    setAudio = (audios,options,trl) => {
        if(trl === 1) {
            let text = options.filter(k => k.value === audios)[0].text;
            this.setState({audios});
            this.state.audiostream1.switch(audios);
            localStorage.setItem("lang_trl1", audios);
            localStorage.setItem("langtext_trl1", text);
        }
        if(trl === 2) {
            let text = options.filter(k => k.value === audios)[0].text;
            this.setState({audios});
            this.state.audiostream2.switch(audios);
            localStorage.setItem("lang_trl2", audios);
            localStorage.setItem("langtext_trl2", text);
        }
    };

    setAudioOut = (d,t) => {
        if(t === 1) {
            //this.refs.remoteAudio1.setSinkId(d)
            window["out"+t].setSinkId(d)
        }
        if(t === 2) {
            //this.refs.remoteAudio2.setSinkId(d)
            window["out"+t].setSinkId(d)
        }
    }

    setVolume = (value,trl) => {
        window["out"+trl].srcObject.volume = value;
        // if(trl === 1) {
        //     this.refs.remoteAudio1.volume = value;
        // }
        // if(trl === 2) {
        //     this.refs.remoteAudio2.volume = value;
        // }
    };

    audioMute = (trl) => {
        if(trl === 1) {
            const {audio_stream1,str1_muted} = this.state;
            this.setState({str1_muted: !str1_muted});
            window["out"+trl].muted = !str1_muted;
            //audio_stream1.getAudioTracks()[0].enabled = str1_muted;
        }
        if(trl === 2) {
            const {audio_stream2,str2_muted} = this.state;
            this.setState({str2_muted: !str2_muted});
            window["out"+trl].muted = !str2_muted;
            //audio_stream2.getAudioTracks()[0].enabled = str2_muted;
        }
        console.log(window["out"+trl])
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

    videoMute = (video) => {
        const {janus} = this.props;
        if(video) {
            this.initVideoStream(janus);
        } else {
            janus.detach(this.state.videostream)
            this.setState({videostream: null, video_stream: null});
        }
    };


    render() {

        const {str1_muted,str2_muted} = this.state;

        return (
            <Segment textAlign='center'>
                {this.props.video ?
                <div className='video'>
                    <video ref="remoteVideo"
                           id="remoteVideo"
                           width="450"
                           height="250"
                           autoPlay={true}
                           controls={false}
                           muted={true}
                           playsInline={true}/>
                </div> : ""}
                <audio ref="remoteAudio1"
                       id="remoteAudio1"
                       autoPlay={true}
                       controls={false}
                       muted={true}
                       playsInline={true}/>
                <audio ref="remoteAudio2"
                       id="remoteAudio2"
                       autoPlay={true}
                       controls={false}
                       muted={true}
                       playsInline={true}/>
            </Segment>
        )
    }
}

export default MerkazStream;
