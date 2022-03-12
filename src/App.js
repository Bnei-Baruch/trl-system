import React, { Component, Fragment } from 'react';
import 'semantic-ui-css/semantic.min.css';
// import Main from "./apps/Main";
// import MqttClient from "./apps/Client/MqttClient";
// import MqttAdmin from "./apps/Admin/MqttAdmin";
// import HttpClient from "./apps/Client/HttpClient";
// import HttpAdmin from "./apps/Admin/HttpAdmin";
// import WeApp from "./apps/WeApp";
import WeClient from "./apps/Client/WeClient";
// import WeLive from "./apps/Client/App";

class App extends Component {

    state = {};

    render() {

        return (
            <Fragment>
                {/*<Main />*/}
                {/*<MqttClient />*/}
                {/*<MqttAdmin />*/}
                {/*<HttpClient />*/}
                {/*<HttpAdmin />*/}
                {/*<WeApp />*/}
                <WeClient />
                {/*<WeLive />*/}
            </Fragment>

        );
    }
}

export default App;
