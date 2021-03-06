import Keycloak from 'keycloak-js';
import {updateSentryUser} from "../shared/sentry";

const userManagerConfig = {
    url: 'https://accounts.kab.info/auth',
    realm: 'main',
    clientId: 'trl',
    scope: 'profile',
    enableLogging: true,
};

export const kc = new Keycloak(userManagerConfig);

kc.onTokenExpired = () => {
    console.debug(" -- Renew token -- ");
    renewToken(0);
};

kc.onAuthLogout = () => {
    console.debug("-- Detect clearToken --");
    kc.logout();
}

const renewToken = (retry) => {
    kc.updateToken(70)
        .then(refreshed => {
            if(refreshed) {
                console.debug("-- Refreshed --");
            } else {
                console.warn('Token is still valid?..');
            }
        })
        .catch(err => {
            retry++;
            if(retry > 5) {
                console.error("Refresh retry: failed");
                console.debug("-- Refresh Failed --");
                kc.clearToken();
            } else {
                setTimeout(() => {
                    console.error("Refresh retry: " + retry);
                    renewToken(retry);
                }, 10000);
            }
        });
}



export const getUser = (callback) => {
    kc.init({onLoad: 'check-sso', checkLoginIframe: false, flow: 'standard', pkceMethod: 'S256'})
        .then(authenticated => {
        if(authenticated) {
            const {realm_access: {roles},sub,given_name,name,email} = kc.tokenParsed;
            let user = {id: sub, title: given_name, username: given_name, name, email, roles};
            updateSentryUser(user);
            callback(user)
        } else {
            updateSentryUser(null);
            callback(null)
        }
    }).catch((err) => console.log(err));
};

export default kc;
