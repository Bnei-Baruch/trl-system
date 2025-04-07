import workerUrl from 'worker-plugin/loader!./volmeter-processor';
import log from "loglevel";

class LocalDevices {
  constructor() {
    this.audio = {
        context: null,
        device: null,
        devices: [],
        error: null,
        stream: null,
    }
    this.onChange = null
    this.onMute = null
    this.audio_stream = null
    this.micLevel = null
  }

  init = async () => {
    let devices = [], ts = 0;

    //TODO: Translate exceptions - https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#Exceptions

    // Check saved devices in local storage
    let storage_audio = localStorage.getItem("audio_device");
    
    // Get available devices first
    devices = await navigator.mediaDevices.enumerateDevices();
    console.log(devices);
    this.audio.devices = devices.filter((a) => !!a.deviceId && a.kind === "audioinput");
    
    // Check if the saved device exists in the available devices
    const deviceExists = !!storage_audio && this.audio.devices.some(d => d.deviceId === storage_audio);
    
    // Use the saved device only if it exists, otherwise use the first available device
    if (deviceExists) {
      this.audio.device = storage_audio;
    } else if (this.audio.devices.length > 0) {
      // If saved device doesn't exist but we have other devices, use the first one
      this.audio.device = this.audio.devices[0].deviceId;
      // Update localStorage with the new device
      if (this.audio.device) {
        localStorage.setItem("audio_device", this.audio.device);
      }
    } else {
      // No devices available
      this.audio.device = null;
    }
    
    [this.audio.stream, this.audio.error] = await this.getMediaStream(this.audio.device);

    if (this.audio.stream) {
      this.audio_stream = this.audio.stream.clone()
      await this.initMicLevel()
      this.audio.device = this.audio.stream.getAudioTracks()[0].getSettings().deviceId;
    } else {
      this.audio.device = "";
    }

    // navigator.mediaDevices.ondevicechange = async(e) => {
    //   if(e.timeStamp - ts < 1000) return
    //   ts = e.timeStamp
    //   devices = await navigator.mediaDevices.enumerateDevices();
    //   log.debug("[devices] devices list refreshed: ", devices);
    //   this.audio.devices = devices.filter((a) => !!a.deviceId && a.kind === "audioinput");
    //   // Refresh audio devices list
    //   let storage_audio = localStorage.getItem("audio_device");
    //   let isSavedAudio = this.audio.devices.find(d => d.deviceId === storage_audio)
    //   let default_audio = this.audio.devices.length > 0 ? this.audio.devices[0].deviceId : null;
    //   this.audio.device = isSavedAudio ? storage_audio : default_audio;
    //
    //   if(typeof this.onChange === "function") this.onChange(this.audio)
    // }

    log.debug("[devices] init: ", this)
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

    try {
      // Create new AudioContext
      this.audio.context = new AudioContext()
      log.debug("[devices] AudioContext: ", this.audio.context)
      
      // Check if processor is already registered
      const isRegistered = await this.isProcessorRegistered(this.audio.context, 'volume_meter').catch(() => false)
      
      // Only load the module if the processor isn't registered yet
      if (!isRegistered) {
        try {
          log.debug("[devices] Loading audio worklet module")
          await this.audio.context.audioWorklet.addModule(workerUrl)
          log.debug("[devices] Audio worklet module loaded successfully")
        } catch (error) {
          log.error("[devices] Failed to load audio worklet module:", error)
          return
        }
      }
      
      // Create source from the stream
      let microphone = this.audio.context.createMediaStreamSource(this.audio_stream)
      
      try {
        // Create the worklet node
        const node = new AudioWorkletNode(this.audio.context, 'volume_meter')
        
        node.port.onmessage = event => {
          let _volume = 0
          let _rms = 0
          let _dB = 0
          let _muted = false

          //log.debug('[devices] mic level: ', event.data)

          if (event.data.volume) {
            _volume = event.data.volume
            _rms = event.data.rms
            _dB = event.data.dB
            _muted = event.data.rms < 0.0000011

            if(typeof this.micLevel === "function")
              this.micLevel(_volume)
            if(typeof this.onMute === "function")
              this.onMute(_muted)
          }
        }

        microphone.connect(node)
        log.debug("[devices] Audio level monitoring initialized successfully")
      } catch (error) {
        log.error("[devices] Failed to create AudioWorkletNode:", error)
      }
    } catch (error) {
      log.error("[devices] Error initializing audio level monitoring:", error)
    }
  };

  setAudioDevice = (device, cam_mute) => {
    return this.getMediaStream(device)
      .then((data) => {
        log.debug("[devices] setAudioDevice: ", data);
        const [stream, error] = data;
        if (error) {
          this.audio.error = error
          log.error("[devices] setAudioDevice: ", error);
        } else {
          localStorage.setItem("audio_device", device);
          this.audio.stream = stream;
          this.audio.device = device;
          this.audio_stream = stream.clone()
          if (this.audio.context) {
            this.audio.context.close();
            this.initMicLevel()
            // if(cam_mute) {
            //   this.audio.context.suspend()
            // }
          }
        }
        return this.audio;
      });
  };

  // Helper method to check if a processor is registered
  isProcessorRegistered = async (context, processorName) => {
    try {
      // Create a test node - if this succeeds, the processor is registered
      new AudioWorkletNode(context, processorName);
      return true;
    } catch (error) {
      // If error indicates the processor isn't registered, return false
      return false;
    }
  }
}

const defaultDevices = new LocalDevices();

export default defaultDevices;
