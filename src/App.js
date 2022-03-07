import React, { Component, Fragment } from 'react';
import 'semantic-ui-css/semantic.min.css';
// import Main from "./apps/Main";
import MqttClient from "./apps/Client/MqttClient";
// import MqttAdmin from "./apps/Admin/MqttAdmin";
// import HttpClient from "./apps/Client/HttpClient";
// import HttpAdmin from "./apps/Admin/HttpAdmin";
// import WeApp from "./apps/WeApp";
// import WeClient from "./apps/WeClient/App";
import WeLive from "./apps/WeLive/App";
// import TrlApp from "./apps/App";
// import TrlChat from "./apps/Chat/App";
// import TrlClient from "./apps/Client/App";
// import TrlAdmin from "./apps/Admin/App";

class App extends Component {

    state = {};

    render() {

        return (
            <Fragment>
                {/*<Main />*/}
                <MqttClient />
                {/*<MqttAdmin />*/}
                {/*<HttpClient />*/}
                {/*<HttpAdmin />*/}
                {/*<TrlApp />*/}
                {/*<TrlChat />*/}
                {/*<TrlClient/>*/}
                {/*<TrlAdmin />*/}
                {/*<WeApp />*/}
                {/*<WeClient />*/}
                <WeLive />
            </Fragment>

        );
    }
}

export default App;
