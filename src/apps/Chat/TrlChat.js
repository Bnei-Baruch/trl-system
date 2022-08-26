import React, { Component } from 'react';
import {Segment, Button, Input, Table, Grid, Message, Icon} from "semantic-ui-react";
import {getDateString, notifyMe, getPublisherInfo} from "../../shared/tools";
import './TrlChat.css';
import {kc} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import mqtt from "../../shared/mqtt";
import log from "loglevel";
import {JanusMqtt} from "../../lib/janus-mqtt";
import {AudiobridgePlugin} from "../../lib/audiobridge-plugin";

class TrlChat extends Component {

    state = {
        bitrate: 150000,
        chatroom: null,
        forwarders: [],
        groups: [],
        janus: null,
        feedStreams: {},
        mids: [],
        feeds: [],
        rooms: [],
        feed_id: null,
        feed_user: null,
        feed_talk: false,
        feed_rtcp: {},
        current_room: "",
        room_id: "",
        room_name: "Forward",
        videoroom: null,
        remotefeed: null,
        switchFeed: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        msg_type: "support",
        audio: null,
        muted: true,
        user: null,
        description: "",
        messages: [],
        visible: false,
        input_value: "",
        switch_mode: false,
        users: {},
        root: false,
        support_chat: {},
        active_tab: null,
    };

    componentDidMount() {
        document.addEventListener("keydown", this.onKeyPressed);
    };

    checkPermission = (user) => {
        const gxy_group = kc.hasRealmRole("bb_user");
        if (gxy_group) {
            delete user.roles;
            user.role = "chat";
            user.name = "Petah-Tikva";
            this.initMQTT(user);
        } else {
            alert("Access denied!");
            kc.logout();
        }
    };

    componentWillUnmount() {
        document.removeEventListener("keydown", this.onKeyPressed);
        this.state.janus.destroy();
    };

    onKeyPressed = (e) => {
        if(e.code === "Enter")
            this.sendDataMessage();
    };

    initMQTT = (user) => {
        mqtt.init("trl", user, (reconnected, error) => {
            if (error) {
                log.info("[client] MQTT disconnected");
                this.setState({mqttOn: false});
                window.location.reload()
                alert("- Lost Connection to TRL System -")
            } else if (reconnected) {
                this.setState({mqttOn: true});
                log.info("[client] MQTT reconnected");
            } else {
                this.setState({mqttOn: true});
                mqtt.join("trl/users/broadcast");
                mqtt.join("trl/users/support");
                mqtt.join("trl/users/" + user.id);
                this.initChatEvents();
                this.initJanus(user, false)
                mqtt.watch((message) => {
                    this.onProtocolData(message);
                });
            }
        });
        setInterval(() => {
            this.getRoomList();
            if(this.state.feed_user)
                this.getFeedInfo()
        }, 5000 );
    };

    initJanus = (user, reconnect) => {
        let janus = new JanusMqtt(user, "trl1")
        janus.onStatus = (srv, status) => {
            if(status === "offline") {
                alert("Janus Server - " + srv + " - Offline")
                window.location.reload()
            }

            if(status === "error") {
                log.error("[client] Janus error, reconnecting...")
                this.exitRoom(true);
            }
        }

        let audiobridge = new AudiobridgePlugin();
        audiobridge.onFeedEvent = this.onFeedEvent
        audiobridge.onTrack = this.onTrack
        audiobridge.onLeave = this.onLeave

        janus.init().then(data => {
            log.info("[client] Janus init", data)
            janus.attach(audiobridge).then(data => {
                this.setState({janus, audiobridge, user, delay: false});
                log.info('[client] Publisher Handle: ', data);
                this.getRoomList(audiobridge);
            })
        }).catch(err => {
            log.error("[client] Janus init", err);
            this.exitRoom(true);
        })

    }

    onFeedEvent = (list) => {
        log.debug("[client] Got feed event: ", list);
        let {feeds, users} = this.state;
        for(let f in list) {
            let id = list[f]["id"];
            let user = JSON.parse(list[f]["display"]);
            if(user.role !== "user")
                continue
            list[f]["display"] = user;
            feeds[id] = list[f];
            feeds[id].talking = false;
            users[user.id] = user;
            users[user.id].rfid = id;
        }
        this.setState({feeds, users});
    }

    onLeave = (id) => {
        const {feeds} = this.state;
        delete feeds[id];
        this.setState({feeds});
    }

    onTrack = (track, mid, on) => {
        log.info("[client] >> This track is coming from feed :", mid, on);
        let stream = new MediaStream();
        stream.addTrack(track.clone());
        log.info("[client] Created remote audio stream: ", stream);
        let remoteaudio = this.refs.remoteAudio;
        if(remoteaudio) remoteaudio.srcObject = stream;
    }

    initChatEvents = () => {
        // Public chat
        mqtt.mq.on("MqttChatEvent", (data) => {
            let json = JSON.parse(data);
            if(json?.type === "client-chat") {
                this.onChatMessage(json);
            } else {
                this.onData(json);
            }
        });

        // Private chat
        mqtt.mq.on("MqttPrivateMessage", (data) => {
            let json = JSON.parse(data);
            json["whisper"] = true;
            if(json?.type === "client-chat") {
                this.onChatMessage(json);
            } else {
                this.onData(json);
            }
        });

        // Broadcast message
        mqtt.mq.on("MqttBroadcastMessage", (data) => {
            let json = JSON.parse(data);
            if(json?.type === "client-chat") {
                json.time = getDateString(json["date"]);
                notifyMe("Arvut System", json.text, true);
            } else {
                this.props.onCmdMsg(json);
            }

        });
    };

    getRoomList = () => {
        const {audiobridge} = this.state;
        if (audiobridge) {
            audiobridge.list().then(data => {
                log.debug("[client] Get Rooms List: ", data.list);
                data.list.sort((a, b) => {
                    if (a.description > b.description) return 1;
                    if (a.description < b.description) return -1;
                    return 0;
                });
                this.setState({rooms: data.list});
            })
        }
    };

    joinRoom = (data, i) => {
        log.info(" -- joinRoom: ", data, i);
        const {rooms, user, audiobridge, current_room} = this.state;
        let room = rooms[i].room;
        let room_name = rooms[i].description;
        if (current_room === room)
            return;

        log.info(" :: Enter to room: ", room);

        if(!current_room) {
            audiobridge.join(room, user).then(data => {
                log.info('[client] Joined respond :', data)
                this.setState({current_room: room, room_name, feeds: {}, feed_user: null, feed_id: null});
                audiobridge.listen()

                this.onFeedEvent(data.participants)

                mqtt.join("trl/room/" + room);
                mqtt.join("trl/room/" + room + "/chat", true);

            }).catch(err => {
                log.error('[client] Join error :', err);
                this.exitRoom(false);
            })

            return;
        }

        mqtt.exit("trl/room/" + current_room);
        mqtt.exit("trl/room/" + current_room + "/chat");

        this.setState({current_room: room, room_name, feeds: {}, feed_user: null, feed_id: null});

        audiobridge.switch(room, user).then(data => {
            log.info("[admin] swtch respond: ", data)
            mqtt.join("trl/room/" + room);
            mqtt.join("trl/room/" + room + "/chat", true);
            this.onFeedEvent(data.participants)
        })
    };

    exitRoom = (room) => {
        let {audiobridge} = this.state;
        audiobridge.leave(room).then(() => {
            mqtt.exit("trl/room/" + room);
            mqtt.exit("trl/room/" + room + "/chat");
        });
    };

    onChatMessage = (message) => {
        message.time = getDateString();
        if (message.whisper) {
            let {messages} = this.state;
            log.info("-:: It's private message: ", message);
            messages.push(message);
            this.setState({messages});
            this.scrollToBottom();
        } else {
            let {messages} = this.state;
            log.info("-:: It's public message: ", message);
            messages.push(message);
            this.setState({messages}, () => {
                this.scrollToBottom();
            });
        }
    };

    onData = (data) => {
        let {users,rooms} = this.state;

        if(data.type === "support") {
            if(data.user.role === "admin")
                return;
            if(users[data.user.id]) {
                users[data.user.id].support = data.status;
                this.setState({users});
            } else {
                users[data.user.id] = {support: data.status};
                this.setState({users});
            }
            let {support_chat,active_tab} = this.state;
            if(!support_chat[data.user.id]) {
                let room  = rooms.filter(r => r.room === data.room);
                support_chat[data.user.id] = {};
                support_chat[data.user.id].msgs = [];
                support_chat[data.user.id].count = 0;
                support_chat[data.user.id].name = data.user.name;
                support_chat[data.user.id].lang = room[0].description;
            }
            if(!active_tab) {
                this.setState({active_tab:{index: 0, id: data.user.id}});
                support_chat[data.user.id].count = 0;
            } else if(active_tab.id !== data.user.id) {
                support_chat[data.user.id].count = support_chat[data.user.id].count + 1;
            } else {
                support_chat[data.user.id].count = 0;
            }
            //data.text = "test";
            support_chat[data.user.id].msgs.push(data);
            this.setState({support_chat, msg_type: "support"},() => {
                this.scrollToBottom();
            });
            if(document.hidden)
                notifyMe(data.user.name, data.text,true);
        } else if(data.type === "sound-test") {
            if(users[data.id]) {
                users[data.id].sound_test = true;
                this.setState({users});
            } else {
                users[data.id] = {sound_test: true};
                this.setState({users});
            }
        }
    };

    sendDataMessage = () => {
        const {current_room, user, input_value} = this.state;
        let {id, role, name} = user;

        if (input_value === "") {
            return;
        }

        const msg = {user: {id, role, name}, type: "client-chat", text: input_value};
        const topic = `trl/room/${current_room}/chat`;

        mqtt.send(JSON.stringify(msg), false, topic);

        this.setState({input_value: ""});
        this.scrollToBottom();
    };

    scrollToBottom = () => {
        if(this.refs.end)
            this.refs.end.scrollIntoView({ behavior: 'smooth' })
        if(this.supt)
            this.supt.scrollIntoView({ behavior: 'smooth' })
    };

    getFeedInfo = () => {
        if(this.state.feed_user) {
            let {session,handle} = this.state.feed_user;
            if(session && handle) {
                getPublisherInfo(session, handle, json => {
                        //log.info(":: Publisher info", json);
                        let audio = json.info.webrtc.media[0].rtcp.main;
                        this.setState({feed_rtcp: {audio}});
                    }, true
                )
            }
        }
    };

  render() {

      const {rooms, current_room, user, feeds, messages} = this.state;

      const f = (<Icon name='volume up' />);

      let rooms_grid = rooms.map((data,i) => {
          const {room, num_participants, description} = data;
          return (
              <Table.Row active={current_room === room}
                         key={i} onClick={() => this.joinRoom(data, i)} >
                  <Table.Cell width={5}>{description}</Table.Cell>
                  <Table.Cell width={1}>{num_participants}</Table.Cell>
              </Table.Row>
          )
      });

      let users_grid = Object.values(feeds).map((feed,i) => {
          if(feed) {
              let muted = feed.muted;
              return (
                  <Table.Row active={feed.id === this.state.feed_id} key={i} positive={!muted} >
                      <Table.Cell width={10}>{feed.display.name}</Table.Cell>
                      <Table.Cell width={1}>{!muted ? f : ""}</Table.Cell>
                  </Table.Row>
              )
          }
      });


      let list_msgs = messages.map((msg,i) => {
          let {user,time,text} = msg;
          return (
              <div key={i} ref='end'><p>
                  <i style={{color: 'grey'}}>[{time}]</i>&nbsp;
                  <u style={{color: user.role === "admin" ? 'red' : 'blue'}}>{user.name}</u> : {text}</p>
              </div>
          );
      });

      let login = (<LoginPage user={user} checkPermission={this.checkPermission} />);

      let content = (
          <Segment className="virtual_segment" color='blue' raised>

              <Segment textAlign='center' className="ingest_segment">
              </Segment>

              <Grid>
                  <Grid.Row stretched columns='equal'>
                      <Grid.Column width={4}>
                          <Segment.Group>
                          <Segment textAlign='center' className="group_list" raised>
                              <Table selectable compact='very' basic structured className="admin_table" unstackable>
                                  <Table.Body>
                                      <Table.Row disabled>
                                          <Table.Cell width={10}></Table.Cell>
                                          <Table.Cell width={1}></Table.Cell>
                                          {/*<Table.Cell width={1}></Table.Cell>*/}
                                      </Table.Row>
                                      {users_grid}
                                  </Table.Body>
                              </Table>
                          </Segment>
                          </Segment.Group>
                      </Grid.Column>
                      <Grid.Column largeScreen={9}>
                          <Message className='messages_list'>
                              {list_msgs}
                              <div ref='end' />
                          </Message>
                          <Input className='room_input' fluid type='text' placeholder='Type your message' action value={this.state.input_value}
                                 onChange={(v,{value}) => this.setState({input_value: value})}>
                              <input />
                              <Button positive onClick={this.sendDataMessage}>Send</Button>
                          </Input>
                      </Grid.Column>
                      <Grid.Column width={3}>

                          <Segment textAlign='center' className="group_list" raised>
                              <Table selectable compact='very' basic structured className="admin_table" unstackable>
                                  <Table.Body>
                                      {rooms_grid}
                                  </Table.Body>
                              </Table>
                          </Segment>

                      </Grid.Column>
                  </Grid.Row>
              </Grid>
          </Segment>
      );

      return (

          <div>
              {user ? content : login}
          </div>

      );
  }
}

export default TrlChat;
