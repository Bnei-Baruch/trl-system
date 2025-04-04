import React, { Component, Fragment } from 'react';
import 'semantic-ui-css/semantic.min.css';
import Main from "./apps/Main";
import MqttClient from "./apps/Client/MqttClient";
import HttpClient from "./apps/Client/HttpClient";
import MqttAdmin from "./apps/Admin/MqttAdmin";
import HttpAdmin from "./apps/Admin/HttpAdmin";
import TrlChat from "./apps/Chat/TrlChat";
import MqttMerkaz from "./apps/Merkaz/MqttMerkaz";
import WeMain from "./apps/WeMain";
import WeClient from "./apps/Client/WeClient";
import WeHttpStream from "./apps/Stream/WeHttpStream";

class App extends Component {
    state = {};

    render() {
        // Get the app name from the build-time environment variable
        const appName = process.env.REACT_APP_TARGET || 'MqttMerkaz'; // Default to MqttMerkaz
        
        return (
            <Fragment>
                {appName === 'Main' && <Main />}
                {appName === 'MqttMerkaz' && <MqttMerkaz />}
                {appName === 'MqttClient' && <MqttClient />}
                {appName === 'HttpClient' && <HttpClient />}
                {appName === 'MqttAdmin' && <MqttAdmin />}
                {appName === 'HttpAdmin' && <HttpAdmin />}
                {appName === 'TrlChat' && <TrlChat />}
                {appName === 'WeMain' && <WeMain />}
                {appName === 'WeClient' && <WeClient />}
                {appName === 'WeHttpStream' && <WeHttpStream />}
            </Fragment>
        );
    }
}

export default App;
