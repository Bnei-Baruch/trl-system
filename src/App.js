import React, { Component, Fragment } from 'react';
import 'semantic-ui-css/semantic.min.css';
// import Main from "./apps/Main";
import MqttClient from "./apps/Client/MqttClient";
// import MqttAdmin from "./apps/Admin/MqttAdmin";
// import TrlChat from "./apps/Chat/TrlChat";
// import MqttMerkaz from "./apps/Merkaz/MqttMerkaz";
// import WeMain from "./apps/WeMain";
// import WeClient from "./apps/Client/WeClient";
// import WeHttpStream from "./apps/Stream/WeHttpStream";

class App extends Component {

    state = {};

    render() {

        return (
            <Fragment>
                {/*<Main />*/}
                {/*<MqttMerkaz />*/}
                <MqttClient />
                {/*<MqttAdmin />*/}
                {/*<TrlChat />*/}
                {/*<WeMain />*/}
                {/*<WeClient />*/}
                {/*<WeHttpStream />*/}
            </Fragment>

        );
    }
}

export default App;
