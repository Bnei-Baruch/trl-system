import {randomString} from "../shared/tools";
import {EventEmitter} from "events";
import log from "loglevel";
import mqtt from "../shared/mqtt";
import {STUN_SRV1, STUN_SRV2} from "../shared/consts";

export class AudiobridgePlugin extends EventEmitter {
  constructor (list = [{urls: [STUN_SRV1, STUN_SRV2]}]) {
    super()
    this.id = randomString(12)
    this.janus = undefined
    this.janusHandleId = undefined
    this.pluginName = 'janus.plugin.audiobridge'
    this.roomId = null
    this.onTrack = null
    this.onLeave = null
    this.onFeedEvent = null
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

  join(roomId, user) {
    this.roomId = roomId
    const volume_param = new URL(window.location.href).searchParams.get("volume");
    const bitrate_param = new URL(window.location.href).searchParams.get("bitrate");
    const volume = volume_param ? parseInt(volume_param, 10) : 100;
    const bitrate = bitrate_param ? parseInt(bitrate_param, 10) : 128000;
    const body = {request: "join", prebuffer: 10, quality: 10, expected_loss: 10, bitrate, volume, room: roomId, muted: true, display: JSON.stringify(user)};
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        log.info("[audiobridge] join: ", param)
        const {data, json } = param

        this.initPcEvents()

        if(data)
          resolve(data);

      }).catch((err) => {
        log.error('[audiobridge] error join room', err)
        reject(err)
      })
    })
  }

  leave(roomId) {
    const room = roomId || this.roomId
    const body = {request: "leave", room};
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
      this.pc.addTrack(stream.getAudioTracks()[0], stream);

      let audioTransceiver = null;

      let tr = this.pc.getTransceivers();
      if (tr && tr.length > 0) {
        for (let t of tr) {
          if(t?.sender?.track?.kind === "audio") {
            audioTransceiver = t;
            if (audioTransceiver.setDirection) {
              audioTransceiver.setDirection("sendrecv");
            } else {
              audioTransceiver.direction = "sendrecv";
            }
            break;
          }
        }
      }

      this.pc.createOffer().then((offer) => {
        this.pc.setLocalDescription(offer);
        offer.sdp = offer.sdp.replace(/a=rtcp:9 IN IP4 0.0.0.0\r\n/g, 'b=AS:128000\r\na=rtcp:9 IN IP4 0.0.0.0\r\n');
        offer.sdp = offer.sdp.replace(/a=fmtp:111 minptime=10;useinbandfec=1/g, 'a=fmtp:111 minptime=10;useinbandfec=1;maxaveragebitrate=510000\r\n');
        const jsep = {type: offer.type, sdp: offer.sdp}
        const body = {request: 'configure', muted: true}
        return this.transaction('message', {body, jsep}, 'event').then((param) => {
          const {data, json} = param || {}
          const jsep = json.jsep
          log.info('[audiobridge] Configure respond: ', param)
          resolve(data)
          json.jsep.sdp = json.jsep.sdp.replace(/a=rtcp:9 IN IP4 0.0.0.0\r\n/g, 'b=AS:128000\r\na=rtcp:9 IN IP4 0.0.0.0\r\n');
          json.jsep.sdp = json.jsep.sdp.replace(/a=fmtp:111 minptime=10;useinbandfec=1/g, 'a=fmtp:111 minptime=10;useinbandfec=1;maxaveragebitrate=510000\r\n');
          this.pc.setRemoteDescription(json.jsep)

        }).catch(error => reject(error))
      })
    })
  };

  listen() {
    return new Promise((resolve, reject) => {

      let audioTransceiver = null;
      let tr = this.pc.getTransceivers();
      if (tr && tr.length > 0) {
        for (let t of tr) {
          if(t?.sender?.track?.kind === "audio") {
            audioTransceiver = t;
            if (audioTransceiver.setDirection) {
              audioTransceiver.setDirection("recvonly");
            } else {
              audioTransceiver.direction = "recvonly";
            }
            break;
          }
        }
      }

      const body = {request: 'configure', generate_offer: true}
      this.transaction('message', {body}, 'event').then((param) => {
        const {data, json} = param || {}
        log.info('[audiobridge] Configure offer: ', param)
        log.debug('[audiobridge] Handle jsep: ', json.jsep)
        this.pc.setRemoteDescription(new RTCSessionDescription(json.jsep)).then(() => {
          return this.pc.createAnswer()
        }).then(answer => {
          log.info('[audiobridge] answerCreated: ', answer)
          this.pc.setLocalDescription(answer)
          const body = {request: 'configure'}
          this.transaction('message', {body, jsep: answer}, 'event').then((param) => {
            log.info('[audiobridge] Configure answerCreated: ', answer)
          })
        })
      }).catch(error => reject(error))

    })
  };

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
      audioTransceiver.setDirection("sendrecv");
    }

    audioTransceiver.sender.replaceTrack(stream.getAudioTracks()[0])
    this.configure()
  }

  list() {
    const body = {request: "list"};
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'success').then((param) => {
        log.debug("[audiobridge] list: ", param)
        const {data, json } = param

        if(data)
          resolve(data);

      }).catch((err) => {
        log.error('[audiobridge] error list', err)
        reject(err)
      })
    })
  }

  switch(room, user) {
    this.roomId = room
    const body = {request: "changeroom", room, muted: true, display: JSON.stringify(user)};
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        log.info("[audiobridge] changeroom: ", param)
        const {data, json } = param

        if(data)
          resolve(data);

      }).catch((err) => {
        log.error('[audiobridge] error changeroom room', err)
        reject(err)
      })
    })
  }

  mute(muted) {
    const body = {request: 'configure', muted}
    return this.transaction('message', {body}, 'event').then((param) => {
      const {data, json} = param || {}
      const jsep = json.jsep
      log.info('[audiobridge] Mute respond: ', param)
    })
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

    this.pc.ontrack = (e) => {
      log.info("[audiobridge] Got track: ", e)
      this.onTrack(e.track, e.transceiver.mid, true)

      e.track.onmute = (ev) => {
        log.debug("[audiobridge] onmute event: ", ev)
      }

      e.track.onunmute = (ev) => {
        log.debug("[audiobridge] onunmute event: ", ev)
      }

      e.track.onended = (ev) => {
        log.debug("[audiobridge] onended event: ", ev)
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
          window.location.reload()
          alert("- Lost Peer Connection to TRL System -")
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
    if(data?.participants) {
      log.debug('[audiobridge] Feed event: ', data.participants[0])
      this.onFeedEvent(data.participants)
    }

    if(data?.leaving) {
      log.debug('[audiobridge] Feed leave: ', data.leaving)
      this.onLeave(data.leaving)
    }

    // if(data?.videoroom === "talking") {
    //   log.debug('[audiobridge] talking: ', data.id)
    //   this.talkEvent(data.id, true)
    // }
    //
    // if(data?.videoroom === "stopped-talking") {
    //   log.debug('[audiobridge] stopped talking: ', data.id)
    //   this.talkEvent(data.id, false)
    // }
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
