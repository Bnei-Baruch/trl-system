import React, { Component, Fragment } from 'react';
import 'semantic-ui-css/semantic.min.css';
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