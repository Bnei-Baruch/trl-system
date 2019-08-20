var server = null;
var srv = "trl.kbb1.com";
if(window.location.protocol === 'http:')
    window.location = "https://" + srv + "/trl";
else
    server = "https://" + srv + "/janustrl";

var trluser = null;
var janus = null;
var mcutest = null;
var textroom = null;
var started = false;
var janusStream;
var datalive = null;
var myusername = null;
var rmusername = null;
var mydisplayname = null;
var myid = null;
var mychatid = null;
var mystream = null;
var publisher_id = null;
var fwlist = [];
var fwport = null;
var muted = false;


var ip = "10.66.23.104";

var vport = 9884;
var lang;
var device = "default";
var suproom = 1000;

var feeds = [];

var pluginHandles = [];
var participants = {};
var tvals = {};

var transactions = {};

var srcaudio;
var trlaudio;
var srcvideo;


var lnglist = {
    "Hebrew"	:5150,
    "Russian"	:5230,
    "English"	:5240,
    "French"	:5250,
    "Spanish"	:5260,
    "German"	:5270,
    "Italian"	:5280,
    "Turkish"	:5300,
    "Portuguese"	:5320,
    "Bulgarian"	:5340,
    "Georgian"	:5360,
    "Romanian"	:5380,
    "Hungarian"	:5400,
    "Swedish"	:5420,
    "Lithuanian"	:5440,
    "Croatian"	:5460,
    "Japanese"	:5480,
    "Slovenian"	:5500,
    "Polish"	:5520,
    "Norvegian"	:5540,
    "Latvian"	:5560,
    "Ukrainian"	:5580,
    "Niderland"     :5600,
    "China"         :5620
}

if(localStorage.translate) {
    console.log("  -- Storage Translate: " + localStorage.translate);
    console.log("  -- Storage Video Text: " + localStorage.translatetext);
    var translate = Number(localStorage.translate);
    lang = localStorage.translatetext;
    room = Number("1"+translate+"0");
    fwport = lnglist[lang];
} else {
    var translate = null;
}

$(document).on('click', '#translatelist li a', function () {
    console.log("Selected Option:"+$(this).text());
    translate = Number($(this).attr("id"));
    room = Number("1"+translate+"0");
    localStorage.translate = translate;
    localStorage.translatetext = $(this).text();
    lang = localStorage.translatetext;
    fwport = lnglist[lang];
    console.log("  -- Selected Translate: " + translate);
    $('#translate').removeClass('hide').html("Translate to: " + $(this).text()).show();
    validateSelection();
});

$(document).on('click', '#deviceslist li a', function () {
    console.log("Selected Option:"+$(this).text());
    device = $(this).attr("id");
    localStorage.device = device;
    localStorage.devicetext = $(this).text();
    devicetext = localStorage.devicetext;
    console.log("  -- Selected Device: " + devicetext);
    $('#devices').removeClass('hide').html("Input: " + $(this).text()).show();
    micLevel();
    validateSelection();
});

$(document).on('keydown', function(e) {
    if (e.keyCode === 18) {
        console.log("--:: ALT key pressed!");
    }
});

function validateSelection() {
    if(device != undefined && device != null && device != "default" && translate != undefined && translate != null) {
        $('#start').removeClass('disabled')
    } else {
        $('#start').addClass('disabled');
    }
}

$(document).ready(function() {
    oidcLogin(appname);
});

function initJanus() {

    if(translate != undefined && translate != null) {
        $('#translate').removeClass('hide').html("Translate to: " + localStorage.translatetext).show();
    }

    if(device != undefined && device != null && device != "default") {
        $('#devices').removeClass('hide').html("Input: " + localStorage.devicetext).show();
    }

    validateSelection();

    Janus.init({ debug: false, callback: function() {
            $('#start').click(initPlugins);
        }
    });
}

function initPlugins() {
    if(started)
        return;
    started = true;
    $(this).attr('disabled', true).unbind('click');
    janus = new Janus({
        server: server,
        iceServers: [{urls: "stun:v4g.kbb1.com:3478"}],
        success: function() {
            attachVideo();
            $('#support').click(supportReq);
        },
        error: function(error) {
            console.log(error);
            bootbox.alert(error, function() {
                window.location.reload();
            });
        },
        destroyed: function() {
            window.location.reload();
        }
    });
}

function attachVideo() {
    janus.attach({ plugin: "janus.plugin.videoroom",
        success: function(pluginHandle) {
            $('#details').remove();
            mcutest = pluginHandle;
            console.log("Plugin attached! (" + mcutest.getPlugin() + ", id=" + mcutest.getId() + ")");
            console.log("  -- This is a publisher/manager");
            // Prepare the username registration
            registerUsername();
            $('#start').removeAttr('disabled').html("Disconnect")
                .click(function() {
                    $(this).attr('disabled', true);
                    client.signoutRedirect();
                    //window.location.reload();
                    //janus.destroy();
                });

        },
        error: function(error) {
            console.log("  -- Error attaching plugin... " + error);
            bootbox.alert("Error attaching plugin... " + error);
        },
        mediaState: function(medium, on) {
            Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
        },
        webrtcState: function(on) {
            Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
            // Enter chat with videoroom plugin username
            enterChat(myusername);
        },
        onmessage: function(msg, jsep) {
            //console.log(" ::: Got a message (publisher) :::");
            //console.log(JSON.stringify(msg));
            var event = msg["videoroom"];
            //console.log("Event: " + event);
            if(event != undefined && event != null) {
                if(event === "joined") {
                    // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                    myid = msg["id"];
                    console.log("Successfully joined room " + msg["room"] + " with ID " + myid + " with Name:  " + myusername);
                    publishOwnFeed(true);
                    // Any new feed to attach to?
                    if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                        var list = msg["publishers"];
                        console.log("Got a list of available publishers/feeds:");
                        getFWlist(setPort);
                        console.log(list);
                        for(var f in list) {
                            var id = list[f]["id"];
                            var displayname = list[f]["display"];
                            var talk = list[f]["talking"];
                            getListener(id, displayname);
                            newRemoteFeed(id, displayname, talk)
                        }
                    }
                } else if(event === "talking") {
                    var tid = msg["id"];
                    var troom = msg["room"];
                    console.log("TRL "+tid+" - start talking");
                    for(var i=1; i<9; i++) {
                        if(feeds[i] != null && feeds[i] != undefined && feeds[i].rfid == tid) {
                            var chatid = feeds[i].rfchat;
                            $('#rp'+chatid).css('background-color', '#a9e0b5');
                        }
                    }
                } else if(event === "stopped-talking") {
                    var tid = msg["id"];
                    var troom = msg["room"];
                    console.log("TRL "+tid+" - stop talking");
                    for(var i=1; i<9; i++) {
                        if(feeds[i] != null && feeds[i] != undefined && feeds[i].rfid == tid) {
                            var chatid = feeds[i].rfchat;
                            $('#rp'+chatid).css('background-color', 'white');
                        }
                    }
                } else if(event === "destroyed") {
                    // The room has been destroyed
                    console.log("The room has been destroyed!");
                    bootbox.alert(error, function() {
                        window.location.reload();
                    });
                } else if(event === "event") {
                    // Any new feed to attach to?
                    if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                        var list = msg["publishers"];
                        console.log("Got a list of available publishers/feeds:");
                        console.log("--== Someone enter :| ==--");
                        console.log(list);
                        for(var f in list) {
                            var id = list[f]["id"];
                            var displayname = list[f]["display"];
                            getListener(id, displayname);
                            newRemoteFeed(id, displayname)
                        }
                    } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                        // One of the publishers has gone away?
                        var leaving = msg["leaving"];
                        console.log("Publisher left: " + leaving);
                        $('#'+leaving).hide();
                        $('#a'+leaving).remove();
                        var remoteFeed = null;
                        for(var i=1; i<9; i++) {
                            if(feeds[i] != null && feeds[i] != undefined && feeds[i].rfid == leaving) {
                                remoteFeed = feeds[i];
                                break;
                            }
                        }
                        if(remoteFeed != null) {
                            console.log("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
                            var display = remoteFeed.rfdisplay;
                            var dstatus = display.split("_");
                            var t = remoteFeed.rfindex;
                            clearInterval(tvals[t]);
                            if(dstatus[1] === "bb") {
                                console.log("-- ::Leaving BB translator");
                                $('#mixname').empty().hide();
                            } else if(dstatus[1] === "shidur") {
                                console.log("-- ::Leaving Shidur modrator");
                            } else {
                                console.log("-- ::Leaving 2nd tranlator");
                                $('#trlname').empty().hide();
                            }
                            $('#trl2panel').addClass('hide').show();
                            feeds[remoteFeed.rfindex] = null;
                            remoteFeed.detach();
                        }
                    } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                        // One of the publishers has unpublished?
                        var unpublished = msg["unpublished"];
                        console.log("Publisher unpublished: " + unpublished);
                        $('#'+unpublished).hide();
                        $('#a'+unpublished).remove();
                        var remoteFeed = null;
                        for(var i=1; i<9; i++) {
                            if(feeds[i] != null && feeds[i] != undefined && feeds[i].rfid == unpublished) {
                                remoteFeed = feeds[i];
                                break;
                            }
                        }
                        if(remoteFeed != null) {
                            console.log("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
                            var display = remoteFeed.rfdisplay;
                            var dstatus = display.split("_");
                            var t = remoteFeed.rfindex;
                            clearInterval(tvals[t]);
                            console.log("-- ::STATUS: " + dstatus[1]);
                            if(dstatus[1] === "bb") {
                                console.log("-- ::Leaving BB translator");
                                $('#mixname').empty().hide();
                            } else if(dstatus[1] === "shidur") {
                                console.log("-- ::Leaving Shidur modrator");
                            } else {
                                console.log("-- ::Leaving 2nd tranlator");
                                $('#trlname').empty().hide();
                            }
                            $('#trl2panel').addClass('hide').show();
                            feeds[remoteFeed.rfindex] = null;
                            remoteFeed.detach();
                        }
                    } else if(msg["error"] !== undefined && msg["error"] !== null) {
                        bootbox.alert(msg["error"]);
                    }
                }
            }
            if(jsep !== undefined && jsep !== null) {
                console.log("Handling SDP as well...");
                console.log(jsep);
                mcutest.handleRemoteJsep({jsep: jsep});
            }
        },
        onlocalstream: function(stream) {
            console.log(" ::: Got a local stream :::");
            mystream = stream;
            console.log(JSON.stringify(stream));
            $('#videos').removeClass('hide').show();
            $('#micpanel').removeClass('hide').show();
            $('#mute').click(toggleMute);
            $('#publisher').removeClass('hide').html(mydisplayname).show();
            //attachMediaStream($('#myvideo').get(0), stream);
            if(localStorage.makor) {
                console.log("  -- Storage Makor: " + localStorage.makor);
                console.log("  -- Storage Makor Text: " + localStorage.makortext);
                var makor = Number(localStorage.makor);
            } else {
                var makor = null;
            }
            $(document).on('click', '#makorlist li a', function () {
                console.log("Selected Option:"+$(this).text());
                makor = Number($(this).attr("id"));
                localStorage.makor = makor;
                localStorage.makortext = $(this).text();
                console.log("  -- Selected Makor: " + makor);
                $('#makor').removeClass('hide').html("Source: " + $(this).text()).show();
                if(myusername != undefined && myusername != null) {
                    attachStreamingHandle(makor, '#remoteAudio');
                }
            });
            if(makor != undefined && makor != null) {
                $('#makor').removeClass('hide').html("Source: " + localStorage.makortext).show();
            }
            $('#makor').html("Source: " + localStorage.makortext).show();
            $('#translate').addClass('disabled');
            $('#devices').addClass('disabled');
            $('#srcaudpanel').removeClass('hide').html(localStorage.makortext).show();
            $('#trlaudpanel').removeClass('hide').html(localStorage.translatetext).show();
            toggleMute();
            $('#togglevideo').click(toggleVideo);
            attachStreamingHandle(makor, '#remoteAudio');
            //mystream.getAudioTracks()[0].enabled = false;
            attachStreamingHandle(translate, '#mixAudio');
        },
        onremotestream: function(stream) {
            // The publisher stream is sendonly, we don't expect anything here
        },
        ondataopen: function(data) {
            Janus.log("The DataChannel is available!");
            $('#videos').removeClass('hide').show();
        },
        ondata: function(rmusername, data) {
            Janus.debug("We got LOCAL data from: " + rmusername + data);
            $('#datarecv').val(data);
        },
        oncleanup: function() {
            console.log(" ::: Got a cleanup notification: we are unpublished now :::");
            mystream = null;
            muted = false;
            stopForward();
        }
    });
}

function getFWlist(setPort) {
    var req = {"request":"listforwarders", "room":room, "secret":"adminpwd"};
    mcutest.send ({"message": req,
        success: function(data) {
            for(var i=0; i<data.rtp_forwarders.length; i++) {
                var fwname = data.rtp_forwarders[i].display;
                var fwid = data.rtp_forwarders[i].publisher_id;
                for(var p=0; p<data.rtp_forwarders[i].rtp_forwarder.length; p++) {
                    if(data.rtp_forwarders[i].rtp_forwarder[p].audio_stream_id !== undefined) {
                        var aport = data.rtp_forwarders[i].rtp_forwarder[p].port;
                        fwlist.push(aport);
                    }
                }
            }
            setPort(fwlist);
        }
    });
}

function setPort(fwlist) {
    if(fwlist.length == 0) {
        console.log("-- ::We alone here");
        console.log("--  Going to set: "+fwport+" port");
        startForward();
    } else if(fwlist.length == 9) {
        console.log("-- ::Only 9 Translator avalabale - exiting!");
        window.alert("Only 9 connection possible");
        janus.destroy();
    } else {
        do {
            console.log("--  Port: "+fwport+" TAFUS");
            fwport = fwport + 1;
            console.log("--  Let's check: "+fwport+" port");
            var result = $.inArray(fwport, fwlist);
        } while (result !== -1)
        console.log("--  Going to set: "+fwport+" port");
        startForward();
    }
}

function getListener(id, display) {
    var dparse = display.split("_");
    var displayname = dparse[0];
    var userstatus = dparse[1];
    // Chek who enter to room
    if(userstatus === "bb") {
        console.log("-- ::BB translator in the room");
        $('#sessions-list').append('<a id="'+id+'" class="list-group-item list-group-item-info">'+displayname+'</a>');
    } else if(userstatus === "shidur") {
        console.log("-- ::Shidur modrator in the room");
    } else {
        console.log("-- ::Tranlator in the room");
        $('#sessions-list').append('<a id="'+id+'" class="list-group-item list-group-item-info">'+displayname+'</a>');
    }
}

function registerUsername() {
    var username = trluser.given_name;
    var username = username + "_trl";
    var register = { "request": "join", "room": room, "ptype": "publisher", "display": username };
    myusername = username ;
    localStorage.username = myusername;
    var dparse = myusername.split("_");
    mydisplayname = dparse[0];
    mcutest.send({"message": register});
    // Here we going to attach Chat plugin
    attachChat();
}

function errorMessage(message, e) {
    console.error(message, typeof e == 'undefined' ? '' : e);
    bootbox.alert(message);
}

function initApp() {

    intializePlayer();

    var iOS = !!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform);
    if ( !iOS && Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    if (navigator.getUserMedia) {
        navigator.getUserMedia({ audio: true, video: false }, function (stream) {
            //document.querySelector('video').src = window.URL.createObjectURL(stream);
            //var mediaStreamTrack = stream.getVideoTracks()[0];
            //if (typeof mediaStreamTrack != "undefined") {
            //    mediaStreamTrack.onended = function () {//for Chrome.
            //        errorMessage('Your webcam is busy!')
            //    }
            //} else errorMessage('Permission denied!');
            initDevices(devices);
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
                default: errorMessage('Permission devices usage is Rejected! You must grant it.', e);
                    return;
            }
            errorMessage(message);
            $('#start').addClass('disabled');
        });
    } else {
        errorMessage('Uncompatible browser!');
        $('#start').addClass('disabled');
    }
}

function initDevices() {
    navigator.mediaDevices.enumerateDevices().then(function(devices) {
        console.log(":: Devices: ", devices);
        // Does we need to continue if no input devices?
        if(devices.length === 0)
            console.log(":: We did not found any input device");
        devices.forEach(function(device) {
            var option = $("<li><a href=# id=" + device.deviceId + ">" + device.label + "</a></li>");
            if(device.kind === 'audioinput' && device.deviceId != "default") {
                $('#deviceslist').append(option);
            } else if(device.kind === 'videoinput') {
                $('#video-device').append(option);
            }
        });
        setDevices();
    });
}

function setDevices() {
    if(localStorage.device) {
        console.log("  -- Storage Device: " + localStorage.device);
        console.log("  -- Storage Device Text: " + localStorage.devicetext);
        device = localStorage.device;
        devicetext = localStorage.devicetext;
        micLevel();
    } else {
        device = "default";
        micLevel();
    }
    initJanus();
}


function publishOwnFeed(useAudio) {
    mcutest.createOffer({
        media: { audioRecv: false, videoRecv: false, audioSend: true , videoSend: false, audio: {deviceId: device }},
        //media: { audioRecv: false, videoRecv: false, audioSend: true , videoSend: false, audio: useAudio, data: true },
        success: function(jsep) {
            console.log("Got publisher SDP!");
            console.log(jsep);
            JSON.stringify(jsep)
            var publish = { "request": "configure", "audio": true, "video": false };
            mcutest.send({"message": publish, "jsep": jsep});
        },
        error: function(error) {
            console.log("WebRTC error:");
            console.log(error);
            if (useAudio) {
                publishOwnFeed(false);
            } else {
                bootbox.alert("WebRTC error... " + JSON.stringify(error));
                $('#publish').removeAttr('disabled').click(function() { publishOwnFeed(true); });
            }
        }
    });
}

function toggleVideo() {
    vstatus = document.getElementById('togglevideo').value;
    if(vstatus == "Off"){
        document.getElementById("togglevideo").value="On";
        $('#togglevideo').removeClass('btn-warning');
        $('#togglevideo').addClass('btn-success');
        $('#togglevideo').html("Video ON").show();
        console.log("Video is ON");
        attachStreamingHandle(11, '#remoteVideo');
    } else {
        document.getElementById("togglevideo").value="Off";
        $('#togglevideo').removeClass('btn-success');
        $('#togglevideo').addClass('btn-warning');
        $('#togglevideo').html("Video OFF").show();
        console.log("Video is OFF");
        var body = { "request": "stop" };
        srcvideo.send({"message": body});
        srcvideo.hangup();
    }
}

function toggleMute() {
    astatus = document.getElementById('mute').value;
    if(astatus == "Off") {
        document.getElementById("mute").value="On";
        $('#mute').removeClass('btn-success');
        $('#mute').addClass('btn-danger');
        $('#mute').html("OFF").show();
        mystream.getAudioTracks()[0].enabled = false;
        console.log("Audio is ON");
        if(datalive !== null) {
            //sendMicst('Off');
        }
    } else {
        document.getElementById("mute").value="Off";
        $('#mute').removeClass('btn-danger');
        $('#mute').addClass('btn-success');
        $('#mute').html("ON&nbsp;").show();
        mystream.getAudioTracks()[0].enabled = true;
        console.log("Audio is OFF");
        //sendMicst('On');
    }
}

function sendMicst(micst) {
    datamsg = "micst:" + mychatid + ":" + micst ;
    mcutest.data({
        text: datamsg,
        error: function(reason) { bootbox.alert(reason); },
        success: function() { console.log(" -- Status Mic sent!"); },
    });
}

function unpublishOwnFeed() {
    // Unpublish our stream
    $('#unpublish').attr('disabled', true).unbind('click');
    var unpublish = { "request": "unpublish" };
    mcutest.send({"message": unpublish});
}

function startForward() {
    // Forward local rtp stream
    console.log(" --- ::Start forward rtp for id: " + myid);
    // decoder.il.kbb1.com = 62.219.8.116
    var forward = { "request": "rtp_forward","publisher_id":myid,"room":room,"secret":"adminpwd","host":ip,"audio_port":fwport, "video_port":vport};
    mcutest.send({"message": forward,
        success: function(data) {
            audio_id = data["rtp_stream"]["audio_stream_id"];
            video_id = data["rtp_stream"]["video_stream_id"];
            publisher_id = data["publisher_id"];
            console.log("  -- We got rtp forward video ID: " + video_id);
            console.log("  -- We got rtp forward audio ID: " + audio_id);
            console.log("  -- We got rtp forward publisher ID: " + publisher_id);
            console.log(JSON.stringify(data));
        },
    });
}

function stopForward() {
    // Forward local rtp stream
    if(publisher_id !== undefined && publisher_id !== null) {
        console.log("  -- We need to stop rtp forward video ID: " + video_id);
        console.log("  -- We need to stop rtp forward audio ID: " + audio_id);
        console.log("  -- We need to stop rtp forward publisher ID: " + publisher_id);
        var stopfw_video = { "request":"stop_rtp_forward","stream_id":video_id,"publisher_id":publisher_id,"room":room,"secret":"adminpwd" };
        var stopfw_audio = { "request":"stop_rtp_forward","stream_id":audio_id,"publisher_id":publisher_id,"room":room,"secret":"adminpwd" };
        mcutest.send({"message": stopfw_video});
        mcutest.send({"message": stopfw_audio});
    }
}

function attachStreamingHandle(streamId, mediaElementSelector) {
    var streaming;
    // Detach previos handle if any (Yeah it's look ugly)
    if(mediaElementSelector === '#remoteVideo' && srcvideo !== undefined && srcvideo !== null) {
        var body = { "request": "stop" };
        srcvideo.send({"message": body});
        srcvideo.hangup();
    }
    if (mediaElementSelector === '#remoteAudio' && srcaudio !== undefined && srcaudio !== null) {
        var body = { "request": "switch", "id": streamId };
        srcaudio.send({"message": body});
        return
    }
    if (mediaElementSelector === '#transAudio' && trlaudio !== undefined && trlaudio !== null) {
        var body = { "request": "stop" };
        trlaudio.send({"message": body});
        trlaudio.hangup();
    }

    janus.attach({
        plugin: "janus.plugin.streaming",
        success: function(pluginHandle) {
            streaming = pluginHandle;

            // We need to remember where audio and where video handle
            if(mediaElementSelector === '#remoteVideo'){
                srcvideo = streaming;
            } else if(mediaElementSelector === '#remoteAudio')  {
                srcaudio = streaming;
            } else if(mediaElementSelector === '#transAudio')  {
                trlaudio = streaming;
            }

            pluginHandles.push(streaming);

            // Play stream
            var body = { "request": "watch", id: streamId };
            streaming.send({"message": body});
        },
        error: function(error) {
            displayError("Error attaching plugin: " + error);
        },
        onmessage: function (msg, jsep) {
            onStreamingMessage(streaming, msg, jsep);
        },
        onremotestream: function(stream) {
            console.debug("Got a remote stream!", stream);
            Janus.attachMediaStream($(mediaElementSelector).get(0), stream);
            janusStream = stream;
        },
        oncleanup: function() {
            console.debug("Got a cleanup notification");
        }
    });
}

function onStreamingMessage(handle, msg, jsep) {
    console.debug("Got a message", msg);

    var result = msg.result;

    if(jsep !== undefined && jsep !== null) {
        console.debug("Handling SDP as well...", jsep);

        // Answer
        handle.createAnswer({
            jsep: jsep,
            media: { audioSend: false, videoSend: false },  // We want recvonly audio/video
            success: function(jsep) {
                console.log("Got SDP!");
                console.log(jsep);
                var body = { "request": "start" };
                handle.send({"message": body, "jsep": jsep});
            },
            error: function(error) {
                displayError("WebRTC error: " + error);
            }
        });
    }
}

function newRemoteFeed(id, display, talk) {
    var remoteFeed = null;
    janus.attach({
        plugin: "janus.plugin.videoroom",
        success: function(pluginHandle) {
            remoteFeed = pluginHandle;
            console.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
            console.log("  -- This is a subscriber");
            // We wait for the plugin to send us an offer
            var listen = { "request": "join", "room": room, "ptype": "listener", "feed": id };
            remoteFeed.send({"message": listen});
        },
        error: function(error) {
            console.log("  -- Error attaching plugin... " + error);
            bootbox.alert("Error attaching plugin... " + error);
        },
        onmessage: function(msg, jsep) {
            console.log(" ::: Got a message (listener) :::");
            console.log(JSON.stringify(msg));
            var event = msg["videoroom"];
            console.log("Event: " + event);
            if(event != undefined && event != null) {
                if(event === "attached") {
                    // Subscriber created and attached
                    for(var i=1;i<9;i++) {
                        if(feeds[i] === undefined || feeds[i] === null) {
                            feeds[i] = remoteFeed;
                            remoteFeed.rfindex = i;
                            break;
                        }
                    }
                    remoteFeed.rfid = msg["id"];
                    remoteFeed.rfdisplay = msg["display"];
                    remoteFeed.talk = talk;
                    remoteFeed.talktime = 0;
                    remoteFeed.talkcounter = 1;
                    console.log("Successfully attached to feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") in room " + msg["room"]);
                    rmusername = remoteFeed.rfdisplay;
                    $('#remote'+remoteFeed.rfindex).removeClass('hide').html(remoteFeed.rfdisplay).show();
                    $('#trl2panel').removeClass('hide').show();
                } else if(msg["error"] !== undefined && msg["error"] !== null) {
                    bootbox.alert(msg["error"]);
                } else {
                    // What has just happened?
                }
            }
            if(jsep !== undefined && jsep !== null) {
                console.log("Handling SDP as well...");
                console.log(jsep);
                // Answer and attach
                remoteFeed.createAnswer({
                    jsep: jsep,
                    media: { audioSend: false, video: false },  // We want recvonly audio/video
                    success: function(jsep) {
                        console.log("Got SDP!");
                        var body = { "request": "start", "room": room };
                        remoteFeed.send({"message": body, "jsep": jsep});
                        trlAudio.volume = trlaud.volume;
                        trlAudio.muted = trlaud.muted;
                    },
                    error: function(error) {
                        console.log("WebRTC error:");
                        console.log(error);
                        bootbox.alert("WebRTC error... " + JSON.stringify(error));
                    }
                });
            }
        },
        webrtcState: function(on) {
            Janus.log("-- ::Janus says this WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") is " + (on ? "up" : "down") + " now");
        },
        onlocalstream: function(stream) {
            // The subscriber stream is recvonly, we don't expect anything here
        },
        onremotestream: function(stream) {
            console.log("Remote feed #" + remoteFeed.rfindex);
            trlAudio = document.createElement('audio');
            trlAudio.setAttribute('id', 'a'+remoteFeed.rfid);
            trlAudio.setAttribute('class', 'trldAudio');
            //trlAudio.setAttribute('controls', 'yes');
            trlAudio.setAttribute('autoplay', 'yes');
            document.body.appendChild(trlAudio);
            Janus.attachMediaStream($('#a'+remoteFeed.rfid).get(0), stream);
            //var streamElementMuter = new StreamElementMuter(stream, remoteFeed.rfdisplay, remoteFeed.rfindex);
            $('#trl2panel').removeClass('hide').show();
            $('#datain').removeClass('hide').show();
            $('#dataout').removeClass('hide').show();
        },
        ondataopen: function(data) {
            Janus.log("The DataChannel is available!");
            datalive = 1;
            $('#videos').removeClass('hide').show();
            $('#datasend').removeAttr('disabled');
        },
        ondata: function(data) {
            console.log("Here happend something?");
        },
        oncleanup: function() {
            console.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
        }
    });
}

