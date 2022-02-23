import React, { Component, Fragment } from 'react';
import 'semantic-ui-css/semantic.min.css';
// import Main from "./apps/Main";
import MqttClient from "./apps/Client/MqttClient";
// import HttpClient from "./apps/Client/HttpClient";
// import HttpAdmin from "./apps/Admin/HttpAdmin";

class App extends Component {

    state = {};

    render() {

        return (
            <Fragment>
                {/*<Main />*/}
                <MqttClient />
                {/*<HttpClient />*/}
                {/*<HttpAdmin />*/}
            </Fragment>

        );
    }
}

export default App;
