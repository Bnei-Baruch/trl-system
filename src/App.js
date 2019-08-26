import React, { Component, Fragment } from 'react';
import 'semantic-ui-css/semantic.min.css';
// import TrlApp from "./apps/App";
// import TrlChat from "./apps/Chat/App";
// import TrlClient from "./apps/Client/App";
import TrlAdmin from "./apps/Admin/App";

class App extends Component {

    state = {};

    render() {

        return (
            <Fragment>
                {/*<TrlApp />*/}
                {/*<TrlChat />*/}
                {/*<TrlClient/>*/}
                <TrlAdmin/>
            </Fragment>

        );
    }
}

export default App;