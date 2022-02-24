import React, { Component } from 'react';
import platform from "platform";
import {Segment, Menu, Button, Input, Table, Grid, Message, Select, Icon, Popup, List, Tab, Label, Confirm, Header} from "semantic-ui-react";
import {initJanus, getDateString, getPublisherInfo, notifyMe} from "../../shared/tools";
import './Admin.css';
import {SECRET} from "../../shared/consts";
import {kc} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import VolumeSlider from "../../components/VolumeSlider";
import mqtt from "../../shared/mqtt";
import log from "loglevel";
import {JanusMqtt} from "../../lib/janus-mqtt";
import {AudiobridgePlugin} from "../../lib/audiobridge-plugin";

class MqttAdmin extends Component {

    state = {
        bitrate: 150000,
        chatroom: null,
        forwarders: [],
        groups: [],
        janus: null,
        feeds: {},
        rooms: [],
        feed_id: null,
        feed_user: null,
        feed_info: null,
        feed_talk: false,
        feed_rtcp: {},
        current_room: "",
        room_id: "",
        room_name: "Forward",
        audiobridge: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        msg_type: "room",
        audio: null,
        muted: true,
        user: null,
        description: "",
        messages: [],
        visible: false,
        input_value: "",
        users: {},
        root: false,
        support_chat: {},
        active_tab: null,
        trl_muted: true,
    };

    componentDidMount() {
        document.addEventListener("keydown", this.onKeyPressed);
    };

    componentWillUnmount() {
        document.removeEventListener("keydown", this.onKeyPressed);
        this.state.janus.destroy();
    };

    checkPermission = (user) => {
        const gxy_group = kc.hasRealmRole("trl_admin");
        const gxy_root = kc.hasRealmRole("trl_root");
        if (gxy_group) {
            this.setState({root: gxy_root});
            delete user.roles;
            user.role = "admin";
            this.initMQTT(user);
        } else {
            alert("Access denied!");
            kc.logout();
        }
    };

    onKeyPressed = (e) => {
        if(e.code === "Enter")
            this.sendMessage();
    };

    initMQTT = (user) => {
        mqtt.init(user, (reconnected, error) => {
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
        log.info("[client] Got feed event: ", list);
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

        this.setState({current_room: room, room_name, feeds: {}, feed_user: null, feed_id: null});

        audiobridge.switch(room, user).then(data => {
            log.info("[admin] swtch respond: ", data)
            this.onFeedEvent(data.participants)
        })

        mqtt.exit("trl/room/" + current_room);
        mqtt.exit("trl/room/" + current_room + "/chat");

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

    supportMessage = () => {
        const {current_room,input_value,user,active_tab,support_chat} = this.state;
        let msg = { type: "support", room: current_room, user, text: input_value, to: active_tab.id};
        msg.time = getDateString();
        support_chat[active_tab.id].msgs.push(msg);

        const topic = `trl/users/${active_tab.id}`
        mqtt.send(JSON.stringify(msg), false, topic);

        log.info("-:: It's support message: "+msg);
        this.setState({support_chat, input_value: "", msg_type: "support"}, () => {
            this.scrollToBottom();
        });
    };

    sendBroadcastMessage = () => {
        const {current_room, input_value, user} = this.state;
        let msg = { type: "client-chat", room: current_room, user, text: input_value};
        const topic = `trl/users/broadcast`;
        mqtt.send(JSON.stringify(msg), false, topic);
        this.setState({input_value: ""});
    };

    sendRemoteCommand = (command_type) => {
        const {feed_user} = this.state;
        let msg

        if (command_type === "client-reload-all") {
            msg = {type: "client-reload-all", status: true, id: null, user: null, room: null};
        }

        if(feed_user) {
            msg = {type: command_type, id: feed_user.id};
        }

        const topic = `trl/users/${feed_user.id}`
        mqtt.send(JSON.stringify(msg), false, topic);
    };

    sendMessage = () => {
        const {msg_type} = this.state;
        if(msg_type === "support") {
            this.supportMessage();
        } else if(msg_type === "room") {
            this.sendDataMessage();
        } else if(msg_type === "all") {
            this.sendBroadcastMessage();
        }
    };

    scrollToBottom = () => {
        if(this.refs.end)
            this.refs.end.scrollIntoView({ behavior: 'smooth' })
        if(this.supt)
            this.supt.scrollIntoView({ behavior: 'smooth' })
    };

    setBitrate = (bitrate) => {
        this.setState({bitrate});
    };

    disableRoom = (e, data, i) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            log.info(data)
            // let {disabled_rooms} = this.state;
            // disabled_rooms.push(data);
            // this.setState({disabled_rooms});
            // this.getRoomList();
        }
    };

    getUserInfo = (feed) => {
        log.info(" :: Selected feed: ",feed);
        let {display,id,talking} = feed;
        let feed_info = display.system ? platform.parse(display.system) : null;
        this.setState({feed_id: id, feed_user: display, feed_talk: talking, feed_info});
        log.info(display,id,talking);
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

    tabChange = (e, data) => {
        let {active_tab,support_chat} = this.state;
        active_tab.index = data.activeIndex;
        active_tab.id = data.panes[data.activeIndex].menuItem.key;
        support_chat[active_tab.id].count = 0;
        this.setState({support_chat,active_tab} ,() => {
            this.scrollToBottom();
        });
    };

    muteTrl = () => {
        const {trl_muted} = this.state;
        this.setState({trl_muted: !trl_muted});
    };

    setTrlVolume = (value) => {
        this.refs.remoteAudio.volume = value;
    };

    removeFromSupport = (e,id) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {support_chat} = this.state;
            delete support_chat[id];
            this.setState({support_chat});
            if(Object.keys(support_chat).length === 0) {
                this.setState({msg_type: "room"});
            }
        }
    };

    addToSupport = (e,id) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {support_chat,users,current_room,active_tab} = this.state;
            if(support_chat[id])
                return;
            if(Object.keys(support_chat).length === 0) {
                active_tab = {index: 0, id};
                this.setState({active_tab});
            }
            let user = users[id];
            let data = {user, room: current_room, time: getDateString(), type:"support", text:":: Admin request ::"};
            this.onData(data);
        }
    };

    onConfirmReloadAllCancel = (e, data) => {
        this.setState({showConfirmReloadAll: false});
    };

    onConfirmReloadAllConfirm = (e, data) => {
        console.log("RELOAD ALL")
        this.setState({showConfirmReloadAll: false});
        this.sendRemoteCommand("client-reload-all");
    };


  render() {

      const { bitrate,rooms,current_room,user,feeds,feed_id,feed_info,i,messages,description,room_id,room_name,root,support_chat,feed_rtcp,trl_muted,msg_type,showConfirmReloadAll} = this.state;

      const f = (<Icon name='volume up' />);
      const q = (<Icon color='red' name='help' />);
      const v = (<Icon name='checkmark' />);
      const x = (<Icon name='close' />);

      const bitrate_options = [
          { key: 1, text: '150Kb/s', value: 150000 },
          { key: 2, text: '300Kb/s', value: 300000 },
          { key: 3, text: '600Kb/s', value: 600000 },
      ];

      const send_options = [
          { key: 'all', text: 'All', value: 'all'},
          { key: 'room', text: 'Room', value: 'room' },
          { key: 'support', text: 'Support', value: 'support', disabled: Object.keys(support_chat).length === 0 },
      ];

      let rooms_grid = rooms.map((data,i) => {
          const {room, num_participants, description} = data;
          return (
              <Table.Row active={current_room === room}
                         key={i} onClick={() => this.joinRoom(data, i)}
                         onContextMenu={(e) => this.disableRoom(e, data, i)} >
                  <Table.Cell width={5}>{description}</Table.Cell>
                  <Table.Cell width={1}>{num_participants}</Table.Cell>
              </Table.Row>
          )
      });

      let users_grid = Object.values(feeds).map((feed,i) => {
          if(feed) {
              let muted = feed.muted;
              return (
                  <Table.Row active={feed.id === this.state.feed_id} key={i} positive={!muted}
                             onClick={() => this.getUserInfo(feed)}
                             onContextMenu={(e) => this.addToSupport(e,feed.display.id)} >
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

      let panes = Object.keys(support_chat).map((id, i) => {
          let {msgs,name,count,lang} = support_chat[id];
          let l = (<Label color='red'>{count}</Label>);
          return (
              {menuItem: (<Menu.Item key={id} onContextMenu={(e) => this.removeFromSupport(e,id)} >{name} [<i>{lang}</i>] {count > 0 ? l : ""}</Menu.Item>),
                  render: () => <Tab.Pane>
                      <Message className='messages_list'>
                          <div className="messages-wrapper">
                              {msgs.map((msg,i) => {
                                  let {user,time,text} = msg;
                                  return (
                                      <div key={i+id} ref={el => { this.supt = el; }}><p>
                                          <i style={{color: 'grey'}}>[{time}]</i>&nbsp;
                                          <u style={{color: user.role === "admin" ? 'red' : 'blue'}}>{user.name}</u> : {text}</p>
                                      </div>
                                  );
                              })}
                          </div>
                      </Message>
                  </Tab.Pane>,
              }
          );
      });

      let login = (<LoginPage user={user} checkPermission={this.checkPermission} />);

      let content = (
          <Segment className="virtual_segment" color='blue' raised>

              <Segment textAlign='center' className="ingest_segment">
                  {/*<Button color='blue' icon='sound' onClick={() => this.sendRemoteCommand("sound-test")} />*/}
                  <Popup
                      trigger={<Button positive icon='info' onClick={this.getFeedInfo} />}
                      position='bottom left'
                      content={
                          <List as='ul'>
                              <List.Item as='li'>System
                                  <List.List as='ul'>
                                      <List.Item as='li'>OS: {feed_info ? feed_info.os.toString() : ""}</List.Item>
                                      <List.Item as='li'>Browser: {feed_info ? feed_info.name : ""}</List.Item>
                                      <List.Item as='li'>Version: {feed_info ? feed_info.version : ""}</List.Item>
                                  </List.List>
                              </List.Item>
                              <List.Item as='li'>Audio
                                  <List.List as='ul'>
                                      <List.Item as='li'>in-link-quality: {feed_rtcp.audio ? feed_rtcp.audio["in-link-quality"] : ""}</List.Item>
                                      <List.Item as='li'>in-media-link-quality: {feed_rtcp.audio ? feed_rtcp.audio["in-media-link-quality"] : ""}</List.Item>
                                      <List.Item as='li'>jitter-local: {feed_rtcp.audio ? feed_rtcp.audio["jitter-local"] : ""}</List.Item>
                                      <List.Item as='li'>jitter-remote: {feed_rtcp.audio ? feed_rtcp.audio["jitter-remote"] : ""}</List.Item>
                                      <List.Item as='li'>lost: {feed_rtcp.audio ? feed_rtcp.audio["lost"] : ""}</List.Item>
                                  </List.List>
                              </List.Item>
                          </List>
                      }
                      on='click'
                      hideOnScroll
                  />
                  <Menu secondary className='volume' >
                      <VolumeSlider volume={this.setTrlVolume} mute={this.muteTrl} />
                  </Menu>
                  {/*{root ? root_content : ""}*/}
              </Segment>

              <Grid>
                  <Grid.Row stretched columns='equal'>
                      <Grid.Column width={4}>
                          <Segment.Group>
                              { root ?
                              <Segment textAlign='center'>
                                  {/*<Popup trigger={<Button color="orange" icon='bell slash' onClick={() => this.stopForward(feed_id)} />} content='Stop forward' inverted />*/}
                                  {/*<Popup trigger={<Button negative icon='user x' onClick={this.kickUser} />} content='Kick' inverted />*/}
                                      {/*<Popup trigger={<Button color="brown" icon='sync alternate' alt="test" onClick={() => this.sendRemoteCommand("client-reconnect")} />} content='Reconnect' inverted />*/}
                                      <Popup trigger={<Button color="olive" icon='redo alternate' onClick={() => this.sendRemoteCommand("client-reload")} />} content='Reload page(LOST FEED HERE!)' inverted />
                                      <Popup trigger={<Button color="teal" icon='microphone' onClick={() => this.sendRemoteCommand("client-mute")} />} content='Mute/Unmute' inverted />
                                      <Popup trigger={<Button color="blue" icon='power off' onClick={() => this.sendRemoteCommand("client-disconnect")} />} content='Disconnect(LOST FEED HERE!)' inverted />
                                      <Popup trigger={<Button color="red" icon='redo' onClick={() => this.setState({showConfirmReloadAll: !showConfirmReloadAll})} />} content='RELOAD ALL' inverted />
                                      {/*<Popup trigger={<Button color="yellow" icon='question' onClick={() => this.sendRemoteCommand("client-question")} />} content='Set/Unset question' inverted />*/}
                                  <Confirm
                                      open={showConfirmReloadAll}
                                      header={
                                          <Header><Icon name="warning circle" color="red"/>Caution</Header>
                                      }
                                      content="Are you sure you want to force ALL USERS to reload their page ?!"
                                      onCancel={this.onConfirmReloadAllCancel}
                                      onConfirm={this.onConfirmReloadAllConfirm}
                                  />
                              </Segment>
                                  : ""}
                          <Segment textAlign='center' className="group_list" raised>
                              <Table selectable compact='very' basic structured className="admin_table" unstackable>
                                  <Table.Body>
                                      <Table.Row disabled>
                                          <Table.Cell width={10} />
                                          <Table.Cell width={1} />
                                      </Table.Row>
                                      {users_grid}
                                      <audio
                                          ref={"remoteAudio"}
                                          id={"remoteAudio"}
                                          autoPlay={true}
                                          controls={false}
                                          muted={trl_muted}
                                          playsInline={true}/>
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
                          {/*<Input className='room_input' fluid type='text' placeholder='Type your message' action value={this.state.input_value}*/}
                          {/*       onChange={(v,{value}) => this.setState({input_value: value})}>*/}
                          {/*    <input />*/}
                          {/*    <Button positive onClick={this.sendDataMessage}>Send</Button>*/}
                          {/*</Input>*/}
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

              <Segment className='chat_segment'>
                  {this.state.active_tab ? <Tab panes={panes} onTabChange={this.tabChange} /> : ""}
                  <Input fluid type='text' placeholder='Type your message' action value={this.state.input_value}
                         onChange={(v,{value}) => this.setState({input_value: value})}>
                      <input />
                      <Select options={send_options}
                              value={msg_type}
                              error={msg_type === "all"}
                              onChange={(e,{value}) => this.setState({msg_type: value})} />
                      <Button positive negative={msg_type === "all"} onClick={this.sendMessage}>Send</Button>
                  </Input>
              </Segment>

          </Segment>
      );

      return (

          <div>
              {user ? content : login}
          </div>

      );
  }
}

export default MqttAdmin;
