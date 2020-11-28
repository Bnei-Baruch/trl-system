import * as Sentry from '@sentry/react';
import {Integrations} from '@sentry/tracing';

//import {SENTRY_KEY} from './env';
//import version from '../Version';

export const updateSentryUser = (user) => {
    Sentry.setUser(user);
}

export const initSentry = () => {
    Sentry.init({
        dsn: "https://0072ad3d8e9345f685c9b2378119c9cb@sentry.kli.one/3",
        integrations: [
            new Integrations.BrowserTracing(),
        ],

        // We recommend adjusting this value in production, or using tracesSampler
        // for finer control
        tracesSampleRate: 1.0,
    });
}

export const initSentry2 = () => {
    Sentry.init({
        //dsn: `https://${SENTRY_KEY}@sentry.kli.one/2`,
        dsn: "https://0072ad3d8e9345f685c9b2378119c9cb@sentry.kli.one/3",
        //release: version,
        environment: process.env.NODE_ENV,
        attachStacktrace: true,
        maxBreadcrumbs: 100,
    });

    Sentry.configureScope((scope) => {
        const isDeb = window.location.host.startsWith('bbdev6') ||
            new URL(window.location.href).searchParams.has('deb');
        scope.setTag('deb', isDeb);
    });
};

export const captureException = (exception, data = {}) => {
    Sentry.withScope(scope => {
        scope.setExtras(data);
        Sentry.captureException(exception);
    });
}

export const captureMessage = (title, data = {}, level = 'info') => {
    Sentry.withScope(scope => {
        // Always group by title when reporting manually to Sentry.
        scope.setFingerprint([title]);
        scope.setExtras(data);
        scope.setLevel(level);
        Sentry.captureMessage(title);
    });
}

export const sentryDebugAction = () => {
    console.log('stack: ' + (new Error()).stack);
    captureMessage('Try capture message', {source: 'sentry-test'}, 'error');
}
