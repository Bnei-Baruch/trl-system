import React, { Component } from 'react';
import { Segment } from 'semantic-ui-react';
import './Stream.css'
import {StreamingPlugin} from "../../lib/streaming-plugin";


class MerkazStream extends Component {

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

    componentWillUnmount() {
        this.exitJanus();
    };

    exitJanus = () => {
        const {janus} = this.props;
        if(this.state.videostream)
            janus.detach(this.state.videostream);
        if(this.state.audiostream)
            janus.detach(this.state.audiostream);
        if(this.state.trlstream)
            janus.detach(this.state.trlstream);
        this.setState({video_stream: null, audio_stream: null, trlaudio_stream: null});
    };

    initJanus = () => {
        const {janus} = this.props
        this.setState({janus});
        this.initVideoStream(janus);
        this.initAudioStream(janus);
        this.initTranslationStream(janus, this.props.trl_stream);
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

    initAudioStream = (janus) => {
        let audiostream = new StreamingPlugin();
        let {audios} = this.state;
        janus.attach(audiostream).then(() => {
            this.setState({audiostream});
            audiostream.watch(audios).then(stream => {
                let audio = this.refs.remoteAudio;
                audio.srcObject = stream;
                this.setState({audio_stream: stream});
            })
        })
    };

    initTranslationStream = (janus, streamId) => {
        let trlstream = new StreamingPlugin();
        janus.attach(trlstream).then(() => {
            this.setState({trlstream});
            trlstream.watch(streamId).then(stream => {
                let audio = this.refs.trlAudio;
                audio.srcObject = stream;
                this.setState({trlaudio_stream: stream});
            })
        })
    };

    setVideo = (videos) => {
        this.setState({videos});
        this.state.videostream.switch(videos);
        localStorage.setItem("video", videos);
    };

    setAudio = (audios,options) => {
        let text = options.filter(k => k.value === audios)[0].text;
        this.setState({audios});
        this.state.audiostream.switch(audios);
        localStorage.setItem("lang", audios);
        localStorage.setItem("langtext", text);
    };

    setVolume = (value,trl) => {
        trl ? this.refs.trlAudio.volume = value : this.refs.remoteAudio.volume = value;
    };

    audioMute = (trl) => {
        if(trl) {
            const {trlaudio_stream,trl_muted} = this.state;
            this.setState({trl_muted: !trl_muted});
            trlaudio_stream.getAudioTracks()[0].enabled = trl_muted;
        } else {
            const {audio_stream,str_muted} = this.state;
            this.setState({str_muted: !str_muted});
            audio_stream.getAudioTracks()[0].enabled = str_muted;
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

        const {str_muted,trl_muted} = this.state;

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
                <audio ref="remoteAudio"
                       id="remoteAudio"
                       autoPlay={true}
                       controls={false}
                       muted={str_muted}
                       playsInline={true}/>
                <audio ref="trlAudio"
                       id="trlAudio"
                       autoPlay={true}
                       controls={false}
                       muted={trl_muted}
                       playsInline={true}/>
            </Segment>
        )
    }
}

export default MerkazStream;
