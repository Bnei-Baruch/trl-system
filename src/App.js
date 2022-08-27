import React, { Component, Fragment } from 'react';
import 'semantic-ui-css/semantic.min.css';
// import Main from "./apps/Main";
// import MqttClient from "./apps/Client/MqttClient";
// import HttpClient from "./apps/Client/HttpClient";
import MqttAdmin from "./apps/Admin/MqttAdmin";
// import HttpAdmin from "./apps/Admin/HttpAdmin";
// import TrlChat from "./apps/Chat/TrlChat";
// import WeMain from "./apps/WeMain";
// import WeClient from "./apps/Client/WeClient";
// import WeStream from "./apps/Stream/WeStream";

class App extends Component {

    state = {};

    render() {

        return (
            <Fragment>
                {/*<Main />*/}
                {/*<MqttClient />*/}
                {/*<HttpClient />*/}
                <MqttAdmin />
                {/*<HttpAdmin />*/}
                {/*<TrlChat />*/}
                {/*<WeMain />*/}
                {/*<WeClient />*/}
                {/*<WeStream />*/}
            </Fragment>

        );
    }
}

export default App;
