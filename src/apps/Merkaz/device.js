import workerUrl from 'worker-plugin/loader!./volmeter-processor';
import log from "loglevel";

// Factory function to create completely isolated device instances
const createLocalDevice = (deviceNumber) => {
  // Static constants - copied to each instance
  const RMS_MUTE_THRESHOLD = 0.000006;
  
  // Create an isolated instance
  const instance = {
    deviceNumber,
    audio: {
      context: null,
      device: null,
      devices: {in: [], out: []},
      error: null,
      stream: null,
    },
    onChange: null,
    onMute: null,
    audio_stream: null,
    micLevel: null
  };
  
  // Initialize the device - keep method isolated within this closure
  instance.init = async () => {
    let devices = [], ts = 0;

    // Check saved devices in local storage
    let storage_audio = localStorage.getItem(`audio_device${deviceNumber}`);
    instance.audio.device = !!storage_audio ? storage_audio : null;
    [instance.audio.stream, instance.audio.error] = await getMediaStream(instance.audio.device);
    devices = await navigator.mediaDevices.enumerateDevices();
    console.log(`Device ${deviceNumber} init:`, devices);
    instance.audio.devices.in = devices.filter((a) => !!a.deviceId && a.kind === "audioinput");
    instance.audio.devices.out = devices.filter((a) => !!a.deviceId && a.kind === "audiooutput");

    if (instance.audio.stream) {
      instance.audio_stream = instance.audio.stream.clone();
      await initMicLevel();
      instance.audio.device = instance.audio.stream.getAudioTracks()[0].getSettings().deviceId;
    } else {
      instance.audio.device = "";
    }

    // Use native addEventListener instead of the ondevicechange property
    const deviceChangeHandler = async(e) => {
      if(e.timeStamp - ts < 1000) return;
      ts = e.timeStamp;
      devices = await navigator.mediaDevices.enumerateDevices();
      log.debug(`[devices${deviceNumber}] devices list refreshed: `, devices);
      instance.audio.devices.in = devices.filter((a) => !!a.deviceId && a.kind === "audioinput");
      instance.audio.devices.out = devices.filter((a) => !!a.deviceId && a.kind === "audiooutput");
      // Refresh audio devices list
      let storage_audio = localStorage.getItem(`audio_device${deviceNumber}`);
      let isSavedAudio = instance.audio.devices.in.find(d => d.deviceId === storage_audio);
      let default_audio = instance.audio.devices.in.length > 0 ? instance.audio.devices.in[0].deviceId : null;
      instance.audio.device = isSavedAudio ? storage_audio : default_audio;

      if(typeof instance.onChange === "function") instance.onChange(instance.audio);
    };
    
    // Remove any existing handlers for this instance and add new one
    navigator.mediaDevices.removeEventListener('devicechange', deviceChangeHandler);
    navigator.mediaDevices.addEventListener('devicechange', deviceChangeHandler);

    log.debug(`[devices${deviceNumber}] init: `, instance);
    return instance.audio;
  };

  // Get media stream - isolated within the closure
  const getMediaStream = (deviceId) => {
    let audio = {noiseSuppression: true, echoCancellation: false, highpassFilter: true, autoGainControl: true};
    if(deviceId) audio.deviceId = {exact: deviceId};
    return navigator.mediaDevices
      .getUserMedia({audio, video: false})
      .then((data) => [data, null])
      .catch((error) => Promise.resolve([null, error.name]));
  };

  // Initialize mic level monitor - isolated within the closure
  const initMicLevel = async() => {
    if(!instance.audio_stream) return;

    // Close any existing audio context first
    if (instance.audio.context) {
      try {
        await instance.audio.context.close();
      } catch (err) {
        log.error(`[devices${deviceNumber}] Error closing existing AudioContext:`, err);
      }
    }

    instance.audio.context = new AudioContext();
    log.debug(`[devices${deviceNumber}] AudioContext: `, instance.audio.context);
    
    try {
      await instance.audio.context.audioWorklet.addModule(workerUrl);
      let microphone = instance.audio.context.createMediaStreamSource(instance.audio_stream);
      const node = new AudioWorkletNode(instance.audio.context, 'volume_meter');

      node.port.onmessage = event => {
        let _volume = 0;
        let _rms = 0;
        let _dB = 0;
        let _muted = false;

        if (event.data.volume) {
          _volume = event.data.volume;
          _rms = event.data.rms;
          _dB = event.data.dB;
          _muted = event.data.rms < RMS_MUTE_THRESHOLD;

          if(typeof instance.micLevel === "function")
            instance.micLevel(_volume);
          if(typeof instance.onMute === "function")
            instance.onMute(_muted, event.data.rms);
        }
      };

      microphone.connect(node);
    } catch (err) {
      log.error(`[devices${deviceNumber}] Error in initMicLevel:`, err);
    }
  };

  // Set audio device - method exposed on the instance
  instance.setAudioDevice = (device, cam_mute) => {
    return getMediaStream(device)
      .then((data) => {
        log.debug(`[devices${deviceNumber}] setAudioDevice: `, data);
        const [stream, error] = data;
        if (error) {
          instance.audio.error = error;
          log.error(`[devices${deviceNumber}] setAudioDevice: `, error);
        } else {
          localStorage.setItem(`audio_device${deviceNumber}`, device);
          instance.audio.stream = stream;
          instance.audio.device = device;
          
          // Stop previous audio stream if it exists
          if (instance.audio_stream) {
            instance.audio_stream.getTracks().forEach(track => {
              try { track.stop(); } catch(e) { /* ignore */ }
            });
          }
          
          instance.audio_stream = stream.clone();
          initMicLevel();
        }
        return instance.audio;
      });
  };

  return instance;
};

// Create two completely isolated instances
export const device1 = createLocalDevice(1);
export const device2 = createLocalDevice(2); 