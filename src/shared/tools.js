import {Janus} from "../lib/janus";
import {JANUS_SRV_ADMIN, JANUS_SRV_TRL, ADMIN_SECRET, STUN_SRV1, STUN_SRV2} from "./consts";
import devices from "../lib/devices";
import device1 from "../apps/Merkaz/device1";
import device2 from "../apps/Merkaz/device2";

export const randomString = (len) => {
    let charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let randomString = "";
    for (let i = 0; i < len; i++) {
        let randomPoz = Math.floor(Math.random() * charSet.length);
        randomString += charSet.substring(randomPoz, randomPoz + 1);
    }
    return randomString;
};

export const initJanus = (cb) => {
    Janus.init({
        debug: process.env.NODE_ENV !== 'production' ? ["debug", "log", "error"] : ["debug", "log", "error"],
        callback: () => {
            let janus = new Janus({
                server: JANUS_SRV_TRL,
                iceServers: [{urls: [STUN_SRV1, STUN_SRV2]}],
                success: () => {
                    Janus.log(" :: Connected to JANUS");
                    cb(janus);
                },
                error: (error) => {
                    Janus.log(error + " -- reconnect after 10 sec");
                    cb(true);
                },
                destroyed: () => {
                    Janus.log(" :: Janus destroyed -- reconnect after 10 sec :: ");
                    setTimeout(() => {
                        window.location.reload();
                    }, 10000);
                }
            });
        }
    })
};

export const notifyMe = (title, message, tout) => {
    if (!Notification) {
        alert('Desktop notifications not available in your browser. Try Chromium.');
        return;
    }
    if (Notification.permission !== "granted")
        Notification.requestPermission();
    else {
        var notification = new Notification(title+":", {
            icon: 'nlogo.png',
            body: message,
            requireInteraction: tout
        });
        notification.onclick = function () {
            window.focus();
        }
    }
};

export const getHiddenProp = () => {
    var prefixes = ['webkit','moz','ms','o'];
    if ('hidden' in document) return 'hidden';
    for (var i = 0; i < prefixes.length; i++){
        if ((prefixes[i] + 'Hidden') in document)
            return prefixes[i] + 'Hidden';
    }
    return null;
};

export const getDateString = (jsonDate) => {
    var when = new Date();
    if(jsonDate) {
        when = new Date(Date.parse(jsonDate));
    }
    var dateString =
        ("0" + when.getHours()).slice(-2) + ":" +
        ("0" + when.getMinutes()).slice(-2) + ":" +
        ("0" + when.getSeconds()).slice(-2);
    return dateString;
};

export const micVolume = (c, d) => {
    let cc = c.getContext("2d");
    let gradient = cc.createLinearGradient(0, c.height, 0, 0);
    gradient.addColorStop(0, "green");
    gradient.addColorStop(0.65, "#80ff00");
    gradient.addColorStop(0.90, "orange");
    gradient.addColorStop(1, "red");
    
    // Define the threshold for auto-muting
    const MUTE_THRESHOLD = 0.000006;
    
    if(d === 1) {
        device1.micLevel = (volume) => {
            cc.clearRect(0, 0, c.width, c.height);
            cc.fillStyle = gradient;
            // Scale the volume value to fill more of the large indicator
            const scaledHeight = Math.min(c.height, volume * 5000);
            // Fill the entire width of the canvas
            cc.fillRect(0, c.height - scaledHeight, c.width, scaledHeight);
            
            // Make sure we call onMute with the right parameters
            if (typeof device1.onMute === 'function') {
                const isMuted = volume < MUTE_THRESHOLD;
                device1.onMute(isMuted, volume);
            }
        }
    } else if(d === 2) {
        device2.micLevel = (volume) => {
            cc.clearRect(0, 0, c.width, c.height);
            cc.fillStyle = gradient;
            // Scale the volume value to fill more of the large indicator
            const scaledHeight = Math.min(c.height, volume * 5000);
            // Fill the entire width of the canvas
            cc.fillRect(0, c.height - scaledHeight, c.width, scaledHeight);
            
            // Make sure we call onMute with the right parameters
            if (typeof device2.onMute === 'function') {
                const isMuted = volume < MUTE_THRESHOLD;
                device2.onMute(isMuted, volume);
            }
        }
    } else {
        devices.micLevel = (volume) => {
            cc.clearRect(0, 0, c.width, c.height);
            cc.fillStyle = gradient;
            // Fill the entire width of the canvas
            cc.fillRect(0, c.height - volume * 3000, c.width, c.height);
        }
    }
}

export const micLevel = (stream, canvas, cb) => {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    //let audioContext = null;
    //let mn = 25/128;
    let audioContext = new AudioContext();
    cb(audioContext);
    let analyser = audioContext.createAnalyser();
    let microphone = audioContext.createMediaStreamSource(stream);
    let javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 2048;

    microphone.connect(analyser);
    analyser.connect(javascriptNode);

    javascriptNode.connect(audioContext.destination);

    let canvasContext = canvas.getContext("2d");
    let gradient = canvasContext.createLinearGradient(0,0,0,55);
    gradient.addColorStop(1,'green');
    gradient.addColorStop(0.35,'#80ff00');
    gradient.addColorStop(0.10,'orange');
    gradient.addColorStop(0,'red');

    javascriptNode.onaudioprocess = function() {
        var array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        var values = 0;

        var length = array.length;
        for (var i = 0; i < length; i++) {
            values += (array[i]);
        }

        var average = values / length;

//          Janus.log(Math.round(average - 40));

        canvasContext.clearRect(0, 0, 15, 35);
        canvasContext.fillStyle = gradient;
        //canvasContext.fillRect(0, 35-average*mn, 15, 35);
        canvasContext.fillRect(0, 35-average, 15, 35);
    }
};

export const checkNotification = () => {
    var iOS = !!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform);
    if ( !iOS && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
};

export const getDevicesStream = (audioid,cb) => {
    let audio = audioid ? {noiseSuppression: true, highpassFilter: true, deviceId: {exact: audioid}} : "";
        navigator.mediaDevices
            .getUserMedia({ audio: audio, video: false }).then(stream => {
            cb(stream);
        });
};

export const testDevices = (video,audio,cb) => {
    navigator.mediaDevices.getUserMedia({ audio: audio, video: video }).then(stream => {
        cb(stream);
    }, function (e) {
        var message;
        switch (e.name) {
            case 'NotFoundError':
            case 'DevicesNotFoundError':
                message = 'No input devices found.';
                break;
            case 'SourceUnavailableError':
                message = 'Your input device is busy';
                break;
            case 'PermissionDeniedError':
            case 'SecurityError':
                message = 'Permission denied!';
                break;
            default: Janus.log('Permission devices usage is Rejected! You must grant it.', e);
                return;
        }
        Janus.log(message);
    });
};

export const getData = (url, request, cb) => fetch(`${url}`,{
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body:  JSON.stringify(request)
    }).then((response) => {
        if (response.ok) {
            return response.json().then(data => cb(data));
        }
    })
    .catch(ex => Janus.log(`get ${url}`, ex));

export const geoInfo = (url,cb) => fetch(`${url}`)
    .then((response) => {
    if (response.ok) {
        return response.json().then(data => cb(data));
    }
})
    .catch(ex => console.log(`get geoInfo`, ex));

export const getPublisherInfo = (session, handle,cb) => {
    if(handle === null || handle === undefined)
        return;
    let request = { "janus": "handle_info", "transaction": Janus.randomString(12), "admin_secret": ADMIN_SECRET };
    getData(`${JANUS_SRV_ADMIN}/${session}/${handle}`,request,(json) => {
        cb(json);
    })
};

export const recordAudio = (stream) =>
    new Promise(async resolve => {
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks = [];

        mediaRecorder.addEventListener("dataavailable", event => {
            audioChunks.push(event.data);
        });

        const start = () => mediaRecorder.start();

        const stop = () =>
            new Promise(resolve => {
                mediaRecorder.addEventListener("stop", () => {
                    const audioBlob = new Blob(audioChunks);
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    const play = () => audio.play();
                    resolve({ audioBlob, audioUrl, play });
                });

                mediaRecorder.stop();
            });

        resolve({ start, stop });
    });

export const sleep = time => new Promise(resolve => setTimeout(resolve, time));

export const testMic = async (stream) => {
    const recorder = await recordAudio(stream);
    recorder.start();
    await sleep(5000);
    const audio = await recorder.stop();
    audio.play();
    await sleep(5000);
};

export const cloneStream = (stream, n, stereo) => {
    let context = new AudioContext();
    let source = context.createMediaStreamSource(stream);
    let destination = context.createMediaStreamDestination();
    source.connect(destination);
    window["out"+n] = new Audio();
    window["out"+n].srcObject = destination.stream;
    window["out"+n].muted = true;
    window["out"+n].play();
    let device = localStorage.getItem("audio"+n+"_out");
    if(device) {
        window["out"+n].setSinkId(device)
            .then(() => console.log('Success, audio output device attached: ' + device))
            .catch((error) => console.error(error));
    }
    // if(stereo) {
    //     let analyser1 = context.createAnalyser();
    //     let analyser2 = context.createAnalyser();
    //     let splitter = context.createChannelSplitter(2);
    //     source.connect(splitter);
    //     splitter.connect(analyser1,0,0);
    //     splitter.connect(analyser2,1,0);
    //     stereoVisualizer(analyser1, analyser2, document.getElementById('canvas'+n),250,n);
    // } else {
    //     let analyzer = context.createAnalyser();
    //     source.connect(analyzer);
    //     streamVisualizer(analyzer, document.getElementById('canvas'+n),250,n);
    // }
};

export const cloneTrl = (stream, n, stereo) => {
    let context = new AudioContext();
    let source = context.createMediaStreamSource(stream);
    let destination = context.createMediaStreamDestination();
    source.connect(destination);
    window["trl"+n] = new Audio();
    window["trl"+n].srcObject = destination.stream;
    window["trl"+n].muted = true;
    window["trl"+n].play();
    let device = localStorage.getItem("audio"+n+"_out");
    if(device) {
        window["trl"+n].setSinkId(device)
            .then(() => console.log('Success, audio output device attached: ' + device))
            .catch((error) => console.error(error));
    }
};


const streamVisualizer = (analyser, canvas, width, n) => {
    let mn = width/128;

    let drawContext = canvas.getContext('2d');
    let gradient = drawContext.createLinearGradient(0,0,width,10);
    gradient.addColorStop(0,'green');
    gradient.addColorStop(0.20,'#80ff00');
    gradient.addColorStop(0.85,'orange');
    gradient.addColorStop(1,'red');

    let sampleAudioStream = () => {
        let average = getBufferAverage(analyser);
        drawContext.clearRect(0, 0, width, 40);
        drawContext.fillStyle=gradient;
        drawContext.fillRect(0,0,average*mn,10);
    };

    p[n] = setInterval(sampleAudioStream, 50);
};

const stereoVisualizer = (analyser1, analyser2, canvas, width, n) => {
    let mn = width/128;

    let drawContext = canvas.getContext('2d');
    let gradient = drawContext.createLinearGradient(0,0,width,10);
    gradient.addColorStop(0,'green');
    gradient.addColorStop(0.20,'#80ff00');
    gradient.addColorStop(0.85,'orange');
    gradient.addColorStop(1,'red');

    let sampleAudioStream = () => {
        let average1 = getBufferAverage(analyser1);
        let average2 = getBufferAverage(analyser2);
        drawContext.clearRect(0, 0, width, 40);
        drawContext.fillStyle=gradient;
        drawContext.fillRect(0,0,average1*mn,10);
        drawContext.fillRect(0,15, average2*mn,10);
    };

    p[n] = setInterval(sampleAudioStream, 50);
};

export const setupLogCapture = () => {
  const logs = [];
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };

  // Override console methods to capture logs
  console.log = function() {
    logs.push({type: 'log', args: Array.from(arguments), timestamp: new Date()});
    originalConsole.log.apply(console, arguments);
  };
  
  console.error = function() {
    logs.push({type: 'error', args: Array.from(arguments), timestamp: new Date()});
    originalConsole.error.apply(console, arguments);
  };
  
  console.warn = function() {
    logs.push({type: 'warn', args: Array.from(arguments), timestamp: new Date()});
    originalConsole.warn.apply(console, arguments);
  };
  
  console.info = function() {
    logs.push({type: 'info', args: Array.from(arguments), timestamp: new Date()});
    originalConsole.info.apply(console, arguments);
  };

  // Function to get all captured logs
  window.getLogs = () => logs;
  
  // Function to save logs to localStorage
  window.saveLogs = () => {
    localStorage.setItem('appLogs', JSON.stringify(logs));
    return "Logs saved to localStorage";
  };
  
  // Function to send logs to a server
  window.sendLogs = (url = '/api/logs') => {
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(logs)
    })
    .then(response => response.json())
    .then(data => console.log('Logs sent successfully'))
    .catch(error => console.error('Error sending logs:', error));
  };
  
  return "Log capture initialized. Use window.getLogs(), window.saveLogs(), or window.sendLogs() to access logs.";
};