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
    this.microphone = null
    this.isInitialized = false
    
    // Bind methods to ensure consistent this context
    this.init = this.init.bind(this);
    this.getMediaStream = this.getMediaStream.bind(this);
    this.initMicLevel = this.initMicLevel.bind(this);
    this.cleanupAudioResources = this.cleanupAudioResources.bind(this);
    this.setAudioDevice = this.setAudioDevice.bind(this);
  }

  init = async () => {
    // If already initialized, clean up first
    if (this.isInitialized) {
      this.cleanupAudioResources();
    }
    
    let devices = [], ts = 0;

    // Check saved devices in local storage
    let storage_audio = localStorage.getItem(`audio_device${this.deviceNumber}`);
    this.audio.device = !!storage_audio ? storage_audio : null;
    
    try {
      [this.audio.stream, this.audio.error] = await this.getMediaStream(this.audio.device);
      devices = await navigator.mediaDevices.enumerateDevices();
      
      console.log(`Device ${this.deviceNumber} init:`, devices);
      this.audio.devices.in = devices.filter((a) => !!a.deviceId && a.kind === "audioinput");
      this.audio.devices.out = devices.filter((a) => !!a.deviceId && a.kind === "audiooutput");

      if (this.audio.stream) {
        // Clone the stream before using it
        this.audio_stream = this.audio.stream.clone();
        await this.initMicLevel();
        this.audio.device = this.audio.stream.getAudioTracks()[0].getSettings().deviceId;
      } else {
        this.audio.device = "";
      }

      // Set up device change listener - only once per instance
      if (!this.isInitialized) {
        navigator.mediaDevices.addEventListener('devicechange', async (e) => {
          if(e.timeStamp - ts < 1000) return;
          ts = e.timeStamp;
          
          try {
            devices = await navigator.mediaDevices.enumerateDevices();
            log.debug(`[devices${this.deviceNumber}] devices list refreshed: `, devices);
            
            this.audio.devices.in = devices.filter((a) => !!a.deviceId && a.kind === "audioinput");
            this.audio.devices.out = devices.filter((a) => !!a.deviceId && a.kind === "audiooutput");
            
            // Refresh audio devices list
            let storage_audio = localStorage.getItem(`audio_device${this.deviceNumber}`);
            let isSavedAudio = this.audio.devices.in.find(d => d.deviceId === storage_audio);
            let default_audio = this.audio.devices.in.length > 0 ? this.audio.devices.in[0].deviceId : null;
            this.audio.device = isSavedAudio ? storage_audio : default_audio;

            if(typeof this.onChange === "function") {
              this.onChange(this.audio);
            }
          } catch (err) {
            log.error(`[devices${this.deviceNumber}] Error handling device change: `, err);
          }
        });
      }
      
      // Mark as initialized
      this.isInitialized = true;
      log.debug(`[devices${this.deviceNumber}] init complete: `, this);
      
    } catch (err) {
      log.error(`[devices${this.deviceNumber}] Error during initialization: `, err);
    }
    
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
    if (!this.audio_stream) {
      log.error(`[devices${this.deviceNumber}] No audio stream available for initMicLevel`);
      return;
    }
    
    // Clean up previous audio resources if they exist
    this.cleanupAudioResources();

    try {
      // Create a new AudioContext
      this.audio.context = new AudioContext();
      log.debug(`[devices${this.deviceNumber}] AudioContext created: `, this.audio.context);
      
      // Add the audio worklet
      await this.audio.context.audioWorklet.addModule(workerUrl);
      
      // Create and connect the source
      this.microphone = this.audio.context.createMediaStreamSource(this.audio_stream);
      this.node = new AudioWorkletNode(this.audio.context, 'volume_meter');

      this.node.port.onmessage = event => {
        if (!event.data || !event.data.volume) return;
        
        let _volume = event.data.volume;
        let _rms = event.data.rms;
        let _muted = event.data.rms < LocalDevice.RMS_MUTE_THRESHOLD;

        if (typeof this.micLevel === "function") {
          try {
            this.micLevel(_volume);
          } catch (err) {
            log.error(`[devices${this.deviceNumber}] Error in micLevel callback: `, err);
          }
        }
        
        if (typeof this.onMute === "function") {
          try {
            this.onMute(_muted, event.data.rms);
          } catch (err) {
            log.error(`[devices${this.deviceNumber}] Error in onMute callback: `, err);
          }
        }
      };

      // Connect the nodes
      this.microphone.connect(this.node);
      log.debug(`[devices${this.deviceNumber}] Audio processing chain connected`);
      
    } catch (err) {
      log.error(`[devices${this.deviceNumber}] Error initializing mic level: `, err);
    }
  };
  
  cleanupAudioResources = () => {
    log.debug(`[devices${this.deviceNumber}] Cleaning up audio resources`);
    
    // Disconnect microphone source if it exists
    if (this.microphone) {
      try {
        this.microphone.disconnect();
        this.microphone = null;
        log.debug(`[devices${this.deviceNumber}] Microphone disconnected`);
      } catch (err) {
        log.error(`[devices${this.deviceNumber}] Error disconnecting microphone: `, err);
      }
    }
    
    // Reset node reference
    this.node = null;
    
    // Close any existing audio context
    if (this.audio.context) {
      try {
        if (this.audio.context.state !== 'closed') {
          this.audio.context.close();
          log.debug(`[devices${this.deviceNumber}] AudioContext closed`);
        }
        this.audio.context = null;
      } catch (err) {
        log.error(`[devices${this.deviceNumber}] Error closing AudioContext: `, err);
      }
    }
  };

  setAudioDevice = (device, cam_mute) => {
    log.debug(`[devices${this.deviceNumber}] Setting audio device: `, device);
    
    return this.getMediaStream(device)
      .then((data) => {
        log.debug(`[devices${this.deviceNumber}] setAudioDevice stream received: `, data);
        const [stream, error] = data;
        
        if (error) {
          this.audio.error = error;
          log.error(`[devices${this.deviceNumber}] setAudioDevice error: `, error);
        } else {
          localStorage.setItem(`audio_device${this.deviceNumber}`, device);
          this.audio.stream = stream;
          this.audio.device = device;
          
          // Clone the stream before using it
          if (this.audio_stream) {
            // Stop all tracks in the old stream
            this.audio_stream.getTracks().forEach(track => track.stop());
          }
          this.audio_stream = stream.clone();
          
          // Clean up and reinitialize the audio processing
          this.cleanupAudioResources();
          this.initMicLevel();
        }
        
        return this.audio;
      });
  };
}

// Create and export isolated instances for device1 and device2
export const device1 = new LocalDevice(1);
export const device2 = new LocalDevice(2); 