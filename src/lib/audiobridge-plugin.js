import {randomString} from "../shared/tools";
import {EventEmitter} from "events";
import log from "loglevel";
import mqtt from "../shared/mqtt";
import {STUN_SRV_TRL} from "../shared/consts";

export class AudiobridgePlugin extends EventEmitter {
  constructor (list = [{urls: STUN_SRV_TRL}]) {
    super()
    this.id = randomString(12)
    this.janus = undefined
    this.janusHandleId = undefined
    this.pluginName = 'janus.plugin.audiobridge'
    this.roomId = null
    this.onFeed = null
    this.onTrack = null
    this.talkEvent = null
    this.iceState = null
    this.pc = new RTCPeerConnection({
      iceServers: list
    })
  }

  getPluginName () {
    return this.pluginName
  }

  transaction (message, additionalFields, replyType) {
    const payload = Object.assign({}, additionalFields, { handle_id: this.janusHandleId })

    if (!this.janus) {
      return Promise.reject(new Error('[audiobridge] JanusPlugin is not connected'))
    }
    return this.janus.transaction(message, payload, replyType)
  }

  join (roomId, user) {
    this.roomId = roomId
    const param = new URL(window.location.href).searchParams.get("volume");
    const volume = param ? parseInt(param, 10) : 100;
    const body = {request: "join", prebuffer: 10, quality: 10, volume, room: roomId, muted : true, display: JSON.stringify(user)};
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        log.info("[audiobridge] join: ", param)
        const {data, json } = param

        if(data)
          resolve(data);

      }).catch((err) => {
        log.error('[audiobridge] error join room', err)
        reject(err)
      })
    })
  }

  leave() {
    const body = {request: "leave", room: this.roomId};
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        log.info("[audiobridge] leave: ", param)
        const {data, json } = param

        if(data)
          resolve(data);

      }).catch((err) => {
        log.error('[audiobridge] error leave room', err)
        reject(err)
      })
    })
  }

  publish(stream) {
    return new Promise((resolve, reject) => {
      this.pc.addTrack(audio.getAudioTracks()[0], stream);

      let audioTransceiver = null;

      let tr = this.pc.getTransceivers();
      if (tr && tr.length > 0) {
        for (let t of tr) {
          if (t.sender && t.sender.track && t.sender.track.kind === "audio") {
            audioTransceiver = t;
            if (audioTransceiver.setDirection) {
              audioTransceiver.setDirection("sendonly");
            } else {
              audioTransceiver.direction = "sendonly";
            }
            break;
          }
        }
      }

      this.initPcEvents()

      this.pc.createOffer().then((offer) => {
        this.pc.setLocalDescription(offer)
        const jsep = {type: offer.type, sdp: offer.sdp}
        const body = {request: 'configure', muted: true}
        return this.transaction('message', {body, jsep}, 'event').then((param) => {
          const {data, json} = param || {}
          const jsep = json.jsep
          log.info('[audiobridge] Configure respond: ', param)
          resolve(data)
          this.pc.setRemoteDescription(jsep)
        }).catch(error => reject(error))
      })
    })
  };

  list() {
    const body = {request: "list"};
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'success').then((param) => {
        log.info("[audiobridge] list: ", param)
        const {data, json } = param

        if(data)
          resolve(data);

      }).catch((err) => {
        log.error('[audiobridge] error list', err)
        reject(err)
      })
    })
  }

  mute(video, stream) {

    let videoTransceiver = null;
    let tr = this.pc.getTransceivers();
    if(tr && tr.length > 0) {
      for(let t of tr) {
        if(t?.sender?.track?.kind === "video") {
          videoTransceiver = t;
          break;
        }
      }
    }

    let d = video ? "inactive" : "sendonly"

    if (videoTransceiver?.setDirection) {
      videoTransceiver.setDirection(d);
    } else {
      videoTransceiver.direction = d;
    }

    if(!video) videoTransceiver.sender.replaceTrack(stream.getVideoTracks()[0])
    if(stream) this.configure()

  }

  audio(stream) {
    let audioTransceiver = null;
    let tr = this.pc.getTransceivers();
    if(tr && tr.length > 0) {
      for(let t of tr) {
        if(t?.sender?.track?.kind === "audio") {
          audioTransceiver = t;
          break;
        }
      }
    }

    if (audioTransceiver?.setDirection) {
      audioTransceiver.setDirection("sendonly");
    } else {
      audioTransceiver.direction = "sendonly";
    }

    audioTransceiver.sender.replaceTrack(stream.getAudioTracks()[0])
    this.configure()
  }

  configure(restart) {
    this.pc.createOffer().then((offer) => {
      this.pc.setLocalDescription(offer).catch(error => log.error("[audiobridge] setLocalDescription: ", error))
      const body = {request: 'configure', restart}
      return this.transaction('message', {body, jsep: offer}, 'event').then((param) => {
        const {data, json} = param || {}
        const jsep = json.jsep
        log.info('[audiobridge] Configure respond: ', param)
        this.pc.setRemoteDescription(jsep)
      })
    })
  }

  initPcEvents() {
    this.pc.onicecandidate = (e) => {
      let candidate = {completed: true}
      if (!e.candidate || e.candidate.candidate.indexOf('endOfCandidates') > 0) {
        log.debug("[audiobridge] End of candidates")
      } else {
        // JSON.stringify doesn't work on some WebRTC objects anymore
        // See https://code.google.com/p/chromium/issues/detail?id=467366
        candidate = {
          "candidate": e.candidate.candidate,
          "sdpMid": e.candidate.sdpMid,
          "sdpMLineIndex": e.candidate.sdpMLineIndex
        };
      }

      return this.transaction('trickle', { candidate })
    };

    this.pc.ontrack = (e) => {
      log.info("[audiobridge] Got track: ", e)
    };

    this.pc.onconnectionstatechange = (e) => {
      log.info("[audiobridge] ICE State: ", e.target.connectionState)
      this.iceState = e.target.connectionState

      if(this.iceState === "disconnected") {
        this.iceRestart()
      }

      // ICE restart does not help here, peer connection will be down
      if(this.iceState === "failed") {
        //TODO: handle failed ice state
      }

    };
  }

  iceRestart() {
    setTimeout(() => {
      let count = 0;
      let chk = setInterval(() => {
        count++;
        if (count < 10 && this.iceState !== "disconnected") {
          clearInterval(chk);
        } else if (mqtt.mq.connected) {
          log.debug("[audiobridge] - Trigger ICE Restart - ");
          this.pc.restartIce();
          this.configure(true)
          clearInterval(chk);
        } else if (count >= 10) {
          clearInterval(chk);
          log.error("[audiobridge] - ICE Restart failed - ");
        } else {
          log.debug("[audiobridge] ICE Restart try: " + count)
        }
      }, 1000);
    },1000)
  }

  success (janus, janusHandleId) {
    this.janus = janus
    this.janusHandleId = janusHandleId

    return this
  }

  error (cause) {
    // Couldn't attach to the plugin
  }

  onmessage (data) {
    log.debug('[audiobridge] onmessage: ', data)
    if(data?.publishers) {
      log.info('[audiobridge] New feed enter: ', data.publishers[0])
      this.onFeed(data.publishers)
    }

    if(data?.unpublished) {
      log.info('[audiobridge] Feed leave: ', data.unpublished)
      if (data?.unpublished === "ok") {
        // That's us
        this.janus.detach(this)
        return;
      }
      this.unsubFrom([data.unpublished], false)
    }

    if(data?.leaving) {
      log.info('[audiobridge] Feed leave: ', data.leaving)
      this.unsubFrom([data.leaving], false)
    }

    if(data?.videoroom === "talking") {
      log.debug('[audiobridge] talking: ', data.id)
      this.talkEvent(data.id, true)
    }

    if(data?.videoroom === "stopped-talking") {
      log.debug('[audiobridge] stopped talking: ', data.id)
      this.talkEvent(data.id, false)
    }
  }

  oncleanup () {
    log.info('[audiobridge] - oncleanup - ')
    // PeerConnection with the plugin closed, clean the UI
    // The plugin handle is still valid so we can create a new one
  }

  detached () {
    log.info('[audiobridge] - detached - ')
    // Connection with the plugin closed, get rid of its features
    // The plugin handle is not valid anymore
  }

  hangup () {
    log.info('[audiobridge] - hangup - ')
    //this.emit('hangup')
  }

  slowLink (uplink, lost, mid) {
    const direction = uplink ? "sending" : "receiving";
    log.info("[audiobridge] slowLink on " + direction + " packets on mid " + mid + " (" + lost + " lost packets)");
    //this.emit('slowlink')
  }

  mediaState (media, on) {
    log.info('[audiobridge] mediaState: Janus ' + (on ? "start" : "stop") + " receiving our " + media)
    //this.emit('mediaState', medium, on)
  }

  webrtcState (isReady) {
    log.info('[audiobridge] webrtcState: RTCPeerConnection is: ' + (isReady ? "up" : "down"))
    //this.emit('webrtcState', isReady, cause)
  }

  detach () {
    this.pc.close()
    this.removeAllListeners()
    this.janus = null
  }
}
