import workerUrl from 'worker-plugin/loader!./volmeter-processor';
import log from "loglevel";

class LocalDevice {
  // Class constants
  static RMS_MUTE_THRESHOLD = 0.000006;
  
  constructor(deviceNumber) {
    this.deviceNumber = deviceNumber;
    this.audio = {
        context: null,
        device: null,
        devices: {in: [], out: []},
        error: null,
        stream: null,
    }
    this.onChange = null
    this.onMute = null
    this.audio_stream = null
    this.micLevel = null
    this.node = null
  }

  init = async () => {
    let devices = [], ts = 0;

    //TODO: Translate exceptions - https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#Exceptions

    // Check saved devices in local storage
    let storage_audio = localStorage.getItem(`audio_device${this.deviceNumber}`);
    this.audio.device = !!storage_audio ? storage_audio : null;
    [this.audio.stream, this.audio.error] = await this.getMediaStream(this.audio.device);
    devices = await navigator.mediaDevices.enumerateDevices();
    console.log(`Device ${this.deviceNumber} init:`, devices);
    this.audio.devices.in = devices.filter((a) => !!a.deviceId && a.kind === "audioinput");
    this.audio.devices.out = devices.filter((a) => !!a.deviceId && a.kind === "audiooutput");

    if (this.audio.stream) {
      this.audio_stream = this.audio.stream.clone()
      await this.initMicLevel()
      this.audio.device = this.audio.stream.getAudioTracks()[0].getSettings().deviceId;
    } else {
      this.audio.device = "";
    }

    navigator.mediaDevices.ondevicechange = async(e) => {
      if(e.timeStamp - ts < 1000) return
      ts = e.timeStamp
      devices = await navigator.mediaDevices.enumerateDevices();
      log.debug(`[devices${this.deviceNumber}] devices list refreshed: `, devices);
      this.audio.devices.in = devices.filter((a) => !!a.deviceId && a.kind === "audioinput");
      this.audio.devices.out = devices.filter((a) => !!a.deviceId && a.kind === "audiooutput");
      // Refresh audio devices list
      let storage_audio = localStorage.getItem(`audio_device${this.deviceNumber}`);
      let isSavedAudio = this.audio.devices.in.find(d => d.deviceId === storage_audio);
      let default_audio = this.audio.devices.in.length > 0 ? this.audio.devices.in[0].deviceId : null;
      this.audio.device = isSavedAudio ? storage_audio : default_audio;

      if(typeof this.onChange === "function") this.onChange(this.audio)
    }

    log.debug(`[devices${this.deviceNumber}] init: `, this)
    return this.audio;
  };

  getMediaStream = (deviceId) => {
    let audio = {noiseSuppression: true, echoCancellation: false, highpassFilter: true, autoGainControl: true};
    if(deviceId) audio.deviceId = {exact: deviceId};
    return navigator.mediaDevices
      .getUserMedia({audio, video: false})
      .then((data) => [data, null])
      .catch((error) => Promise.resolve([null, error.name]));
  };

  initMicLevel = async() => {
    if(!this.audio_stream) return
    
    // Clean up previous audio resources if they exist
    this.cleanupAudioResources();

    try {
      // Create a new AudioContext
      this.audio.context = new AudioContext();
      log.debug(`[devices${this.deviceNumber}] AudioContext: `, this.audio.context);
      
      // Add the audio worklet
      await this.audio.context.audioWorklet.addModule(workerUrl);
      
      // Create and connect the source
      let microphone = this.audio.context.createMediaStreamSource(this.audio_stream);
      this.node = new AudioWorkletNode(this.audio.context, 'volume_meter');

      this.node.port.onmessage = event => {
        if (!event.data.volume) return;
        
        let _volume = event.data.volume;
        let _rms = event.data.rms;
        let _dB = event.data.dB;
        let _muted = event.data.rms < LocalDevice.RMS_MUTE_THRESHOLD;

        if(typeof this.micLevel === "function")
          this.micLevel(_volume);
        if(typeof this.onMute === "function")
          this.onMute(_muted, event.data.rms);
      };

      // Connect the nodes
      microphone.connect(this.node);
    } catch (err) {
      log.error(`[devices${this.deviceNumber}] Error initializing mic level:`, err);
    }
  };
  
  cleanupAudioResources = () => {
    // Close any existing audio context
    if (this.audio.context && this.audio.context.state !== 'closed') {
      try {
        this.audio.context.close();
        log.debug(`[devices${this.deviceNumber}] Closed previous AudioContext`);
      } catch (err) {
        log.error(`[devices${this.deviceNumber}] Error closing AudioContext:`, err);
      }
    }
    
    // Reset node reference
    this.node = null;
  };

  setAudioDevice = (device, cam_mute) => {
    return this.getMediaStream(device)
      .then((data) => {
        log.debug(`[devices${this.deviceNumber}] setAudioDevice: `, data);
        const [stream, error] = data;
        if (error) {
          this.audio.error = error;
          log.error(`[devices${this.deviceNumber}] setAudioDevice: `, error);
        } else {
          localStorage.setItem(`audio_device${this.deviceNumber}`, device);
          this.audio.stream = stream;
          this.audio.device = device;
          this.audio_stream = stream.clone();
          
          // Clean up and reinitialize the audio processing
          this.cleanupAudioResources();
          this.initMicLevel();
        }
        return this.audio;
      });
  };
}

// Export instances for device1 and device2
export const device1 = new LocalDevice(1);
export const device2 = new LocalDevice(2); 